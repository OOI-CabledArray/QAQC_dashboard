#!/usr/bin/env python3
"""
Recursively mirror https://rawdata-west.oceanobservatories.org/files/ into a local directory.

Usage:
    ./download_rawdata.py [GLOB] [--destination DIR] [--flatten] [--workers N] [--dry-run] [--verbose]

    GLOB  Optional glob pattern for files to download, relative to the archive root,
          e.g. "cruise_data/Cabled/*/Water_Sampling/CTD Data/*.btl"
"""

import argparse
import fnmatch
import logging
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from requests import Session
from requests.exceptions import RequestException

BASE_URL = "https://rawdata-west.oceanobservatories.org/files/"
DEFAULT_DESTINATION = Path("raw")
DEFAULT_WORKERS = 8
CHUNK_SIZE = 1024 * 256  # 256 KiB
RETRY_LIMIT = 3
RETRY_BACKOFF = 2.0  # Seconds, doubles on each retry.

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


def is_directory_url(href: str) -> bool:
    """Return True when the href points to a sub-directory (ends with '/')."""
    return href.endswith("/")


def url_to_relative_path(file_url: str) -> str:
    """
    Strip the BASE_URL prefix from a file URL and return the relative path string.

    Percent-encoding (e.g. %20 = ' ') is decoded so callers always receive a plain text path.
    """
    parsed = urlparse(file_url)
    remote_path = unquote(parsed.path)
    prefix = "/files/"
    if remote_path.startswith(prefix):
        return remote_path[len(prefix) :]
    return remote_path.lstrip("/")


def glob_matches(relative_path: str, pattern: str | None) -> bool:
    if pattern is None:
        return True

    return fnmatch.fnmatchcase(relative_path.lower(), pattern.lower())


def directory_could_match(directory: str, pattern: str) -> bool:
    """
    Return True if descending into `directory` could ever yield a file that matches `pattern`.

    Walks the leading segments of the pattern against the directory's relative path. Returns
    `False` only when a segment is provably incompatible so we never prune a directory that might
    contain matches. A '**' in the pattern always allows further descent.
    """
    relative_dir = url_to_relative_path(directory)
    if not relative_dir:
        return True

    pattern_parts = pattern.replace("\\", "/").split("/")
    directory_parts = relative_dir.rstrip("/").split("/")

    for i, directory_segment in enumerate(directory_parts):
        if i >= len(pattern_parts):
            # Pattern is shallower than the directory, can't match deeper files.
            return False
        pattern_segment = pattern_parts[i]
        if pattern_segment == "**":
            # The '**' matches everything from here down.
            return True

        if not fnmatch.fnmatchcase(directory_segment.lower(), pattern_segment.lower()):
            return False

    return True


def list_directory(
    session: Session,
    url: str,
    start_url: str,
) -> tuple[list[str], list[str]]:
    """
    Fetch an Apache-style directory listing and return absolute URLs of sub-directories and absolute
    URLs of downloadable files.

    The `start_url` is the root of the current crawl (used to reject links that escape back above
    it).
    """
    directories: list[str] = []
    files: list[str] = []

    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
    except RequestException as exc:
        log.error("Failed to list %s: %s", url, exc)
        return directories, files

    soup = BeautifulSoup(resp.text, "html.parser")

    for anchor in soup.find_all("a", href=True):
        href: str = str(anchor["href"])

        if (
            href in ("../", "/")
            or href.startswith("?")
            or "Parent Directory" in anchor.text
        ):
            continue

        # Resolve to absolute URL.
        absolute = urljoin(url, href)
        # Skip anything that escapes above the crawl root.
        if not absolute.startswith(start_url):
            continue

        if is_directory_url(href):
            directories.append(absolute)
        else:
            files.append(absolute)

    return directories, files


def crawl(
    session: Session,
    url: str,
    glob: str | None = None,
    *,
    _start_url: str | None = None,
) -> list[str]:
    """
    Recursively walk the remote directory tree starting at *url* and return
    a flat list of all file URLs whose relative paths match *glob*.

    Early pruning: if a glob pattern is given and its leading path segments
    cannot possibly match a directory's relative path, that entire subtree is
    skipped without being fetched.
    """
    if _start_url is None:
        _start_url = url

    all_files: list[str] = []
    directories, files = list_directory(session, url, _start_url)

    for file_url in files:
        relative = url_to_relative_path(file_url)
        if glob_matches(relative, glob):
            all_files.append(file_url)
        else:
            log.debug("Skipping (glob mismatch): %s", relative)

    for directory in directories:
        if glob is not None and not directory_could_match(directory, glob):
            log.debug("Ignoring directory '%s'.", directory)
            continue

        log.debug("Entering directory '%s'.", directory)
        all_files.extend(crawl(session, directory, glob, _start_url=_start_url))

    return all_files


def get_local_path(file_url: str, destination: Path, flatten: bool = False) -> Path:
    """Convert a remote file URL to the corresponding local Path under `destination`.

    If `flatten` is True the directory structure is collapsed and path separators are
    replaced with '__', so all files land directly in `destination`.
    """
    relative = url_to_relative_path(file_url)
    if flatten:
        return destination / relative.replace("/", "__")
    return destination / relative


def download_file(
    session: Session,
    url: str,
    destination: Path,
    flatten: bool = False,
) -> tuple[str, str]:
    """
    Download `url` to `destination`, preserving the remote directory structure. Returns (url,
    status) where status is 'ok', 'skipped', or 'error'.
    """
    local = get_local_path(url, destination, flatten=flatten)

    if local.exists():
        try:
            head = session.head(url, timeout=15)
            size = int(head.headers.get("Content-Length", -1))
            if size > 0 and local.stat().st_size == size:
                log.debug("Skipping (already complete): %s", local)
                return url, "skipped"
        except Exception:
            pass

    local.parent.mkdir(
        parents=True, exist_ok=True
    )  # no-op for the destination dir itself when flattened
    tmp = local.with_suffix(local.suffix + ".part")

    for attempt in range(1, RETRY_LIMIT + 1):
        try:
            with session.get(url, stream=True, timeout=60) as resp:
                resp.raise_for_status()
                with open(tmp, "wb") as fh:
                    for chunk in resp.iter_content(chunk_size=CHUNK_SIZE):
                        if chunk:
                            fh.write(chunk)
            tmp.rename(local)
            log.info("Downloaded: %s", local)
            return url, "ok"
        except requests.RequestException as exc:
            log.warning(
                "Attempt %d/%d failed for %s: %s", attempt, RETRY_LIMIT, url, exc
            )
            if tmp.exists():
                tmp.unlink()
            if attempt < RETRY_LIMIT:
                time.sleep(RETRY_BACKOFF * attempt)

    log.error("Giving up on '%s'.", url)
    return url, "error"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Mirror the OOI raw data archive (or a subdirectory) to a local folder.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
examples:
  # Download CTD .btl files across every Cabled cruise.
  ./download_rawdata.py 'cruise_data/Cabled/*/Water_Sampling/CTD Data/*.btl'

  # Download summary .csv files for all Global cruises.
  ./download_rawdata.py 'cruise_data/Cabled/*/Water_Sampling/*Discrete_Summary.csv'

glob pattern notes:
  Patterns are matched against the path relative to the archive root.
  Matching is case-insensitive.
    *      matches any characters within a single path segment
    **     matches any characters including path separators
    ?      matches any single character
    [seq]  matches any character in seq
        """,
    )
    parser.add_argument(
        "glob",
        nargs="?",
        default=None,
        metavar="GLOB",
        help=(
            "Glob pattern for files to download, relative to the archive root. "
            "Supports *, **, ?, and [seq]. Defaults to all files. "
            "Example: 'cruise_data/Cabled/*/Water_Sampling/CTD Data/*.btl'"
        ),
    )
    parser.add_argument(
        "--destination",
        type=Path,
        default=DEFAULT_DESTINATION,
        metavar="DIR",
        help=f"Local destination directory (default: {DEFAULT_DESTINATION})",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=DEFAULT_WORKERS,
        metavar="N",
        help=f"Number of parallel download threads (default: {DEFAULT_WORKERS})",
    )
    parser.add_argument(
        "--flatten",
        action="store_true",
        help=(
            "Store all files directly in the destination directory, replacing '/' in their "
            "relative paths with '__' to form the filename."
        ),
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable DEBUG-level logging.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    log.info("Start URL  : %s", BASE_URL)
    log.info("Destination: %s", args.destination.resolve())
    log.info("Workers    : %d", args.workers)
    if args.glob:
        log.info("Glob filter: %s", args.glob)
    if args.flatten:
        log.info("Flatten    : enabled")

    session = requests.Session()
    session.headers.update({"User-Agent": "ooi-cruise-data-mirror/1.0"})

    log.info("Crawling remote directory tree.")
    file_urls = crawl(session, BASE_URL, glob=args.glob)
    log.info("Found %d file(s) to download.", len(file_urls))

    if not file_urls:
        log.warning("No files found, nothing to do.")
        return 0

    counts: dict[str, int] = {"ok": 0, "skipped": 0, "error": 0}

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(
                download_file,
                session,
                url,
                args.destination,
                args.flatten,
            ): url
            for url in file_urls
        }
        for future in as_completed(futures):
            _, status = future.result()
            counts[status] = counts.get(status, 0) + 1

    log.info(
        "Done. downloaded=%d  skipped=%d  errors=%d",
        counts["ok"],
        counts["skipped"],
        counts["error"],
    )

    return 1 if counts["error"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
