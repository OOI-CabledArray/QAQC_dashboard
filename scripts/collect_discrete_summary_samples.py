#!/usr/bin/env python3
"""
Concatenate all discrete summary CSV files under a given root directory into a single CSV/JSON
file where every line/array element represents one sample.

The header of the first file found is used as the output header. Rows from files whose header
differs from the first are still included, missing fields are written as empty and extra fields
are ignored.

Usage:
    ./collect_discrete_summary_samples.py ROOT [--out FILE] [--format {csv,json}] [--indent N] [--verbose]

The output format is inferred from the extension of `--out` when it is ".csv" or ".json".

If the extension is unrecognised, `--format` is used instead (default: csv).
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import re
import sys
from pathlib import Path
from textwrap import dedent
from typing import Any

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)-8s %(message)s",
)
log = logging.getLogger(__name__)

# Matches a distance-offset suffix like " - 500 m SW".
_STATION_OFFSET_RE = re.compile(r"\s+-\s+\d+\s+m\b.*$")

# Matches "CTD " at the start of a column name, but not "CTD File" or "CTD Bottle".
_CTD_COLUMN_RE = re.compile(r"^CTD (?!File\b|Bottle\b)")


def strip_station_offset(station: str) -> str:
    return _STATION_OFFSET_RE.sub("", station).strip()


def rename_ctd_column(name: str) -> str:
    return _CTD_COLUMN_RE.sub("CTD Bottle ", name)


def parse(
    path: Path,
    columns: list[str] | None,
) -> tuple[list[str], list[dict[str, Any]]]:
    """Read `path` as a CSV file.

    Returns a (columns, rows) tuple.  If `columns` is provided (i.e. this is not the first file) it
    is used as the canonical column order. Rows with a differing header are still read but mapped
    onto the canonical columns.
    """
    try:
        text = path.read_text()
    except OSError as exc:
        log.error("Cannot read %s: %s", path, exc)
        return columns or [], []

    lines = text.splitlines()
    if not lines:
        log.warning("'%s' is empty, skipping.", path)
        return columns or [], []

    reader = csv.DictReader(lines)

    if columns is None:
        columns = [rename_ctd_column(c) for c in (reader.fieldnames or [])]

    expanded: list[dict[str, Any]] = []
    for row in reader:
        row = {rename_ctd_column(k): v for k, v in row.items()}
        if "Station" in row and row["Station"]:
            row["Station"] = strip_station_offset(row["Station"])

        # Split the "Target Asset" column into individual assets, if present.
        raw_asset = row.get("Target Asset") or ""
        assets = [
            designator.strip()
            for designator in raw_asset.split(",")
            if designator.strip()
        ]

        if len(assets) <= 1:
            expanded.append(row)
        else:
            for asset in assets:
                copy = dict(row)
                copy["Target Asset"] = asset
                expanded.append(copy)

    return columns, expanded


def write_as_csv(
    columns: list[str],
    rows: list[dict[str, Any]],
    output: Path,
) -> None:
    with output.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def write_as_json(
    rows: list[dict[str, Any]],
    output: Path,
    indent: int,
) -> None:
    with output.open("w", encoding="utf-8") as stream:
        json.dump(rows, stream, indent=indent or None, ensure_ascii=False)
        stream.write("\n")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Combine all discrete sample summary *.csv files under ROOT into a single CSV or JSON file.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=dedent("""
          examples:
            # Write to the default output path (<root_name>.csv).
            ./collect_discrete_summary_samples.py ./source-data/summary-sample-source-files
            # Write to a JSON file (format inferred from extension).
            ./collect_discrete_summary_samples.py ./source-data/summary-sample-source-files --out summary-samples.json
            # Override format explicitly.
            ./collect_discrete_summary_samples.py ./source-data/summary-sample-source-files --format json
            # Use compact JSON output with no indentation.
            ./collect_discrete_summary_samples.py ./source-data/summary-sample-source-files --out summary-samples.json --indent 0
        """),
    )
    parser.add_argument(
        "root",
        type=Path,
        metavar="ROOT",
        help="Root directory to search recursively for *.csv files.",
    )
    parser.add_argument(
        "--format",
        choices=["csv", "json"],
        default=None,
        dest="format",
        help=(
            "Output format: csv or json. Takes priority over the extension of `--out`. (default: csv)"
        ),
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        metavar="FILE",
        help=(
            "Output file path. Format is inferred from the extension (.csv or .json) when "
            "recognised, otherwise `--format` is used. "
            "Defaults to <root_directory_name>.csv in the current directory."
        ),
    )
    parser.add_argument(
        "--indent",
        type=int,
        default=2,
        metavar="N",
        help="JSON indentation level, use 0 for compact output. (default: 2)",
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

    root: Path = args.root
    if not root.exists():
        log.error("Root directory '%s' does not exist.", root)
        return 1

    if args.format is not None:
        fmt = args.format
        out = args.out if args.out is not None else Path(f"{root.name}.{fmt}")
    elif args.out is not None:
        extension = args.out.suffix.lower()[1:]
        if extension in {"csv", "json"}:
            fmt = extension
        else:
            log.warning(
                "Unrecognised extension '.%s' in --out, defaulting to 'csv'.",
                extension,
            )
            fmt = "csv"
        out = args.out
    else:
        fmt = "csv"
        out = Path(f"{root.name}.csv")

    files = sorted(root.rglob("*.csv"))
    if not files:
        log.warning("No *.csv files found under '%s', exiting.", root)
        return 0

    log.info("Found %d *.csv file(s) under '%s'.", len(files), root)

    columns: list[str] | None = None
    rows: list[dict[str, Any]] = []

    for file in files:
        log.debug("Reading '%s'.", file)
        columns, current_rows = parse(file, columns)
        log.info("  '%s' (%d row(s))", file, len(current_rows))
        rows.extend(current_rows)

    log.info("Collected %d row(s) from %d file(s).", len(rows), len(files))

    out.parent.mkdir(parents=True, exist_ok=True)

    match fmt:
        case "csv":
            write_as_csv(columns or [], rows, out)
        case "json":
            write_as_json(rows, out, args.indent)

    log.info("'%s': (%.1f KB)", out, out.stat().st_size / 1024)
    return 0


if __name__ == "__main__":
    sys.exit(main())
