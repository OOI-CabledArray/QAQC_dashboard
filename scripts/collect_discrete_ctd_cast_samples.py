#!/usr/bin/env python3
"""
Parse all Sea-Bird *.cnv profile files under a given root directory and emit a single CSV/JSON file
where every line/array element represents one CTD scan.

The Station for each sample is resolved by matching the CTD file key embedded in each .cnv
filename (e.g. "TN326_CTD-001") against the "CTD File" column of the summary samples CSV
supplied via `--summary-samples`.

Usage:
    ./collect_discrete_ctd_cast_samples.py ROOT --summary-samples SUMMARY_CSV [--out FILE] [--format {csv,json}] [--indent N] [--verbose]

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
from collections.abc import Iterator
from csv import DictWriter
from pathlib import Path
from textwrap import dedent
from typing import Any

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)-8s %(message)s",
)
log = logging.getLogger(__name__)

# Sea-Bird CNV short column names → output column names.
# Keys are compared case-insensitively.
COLUMN_MAP: dict[str, str] = {
    "prdm": "CTD Cast Pressure [db]",
    "depsm": "CTD Cast Depth [m]",
    "latitude": "CTD Cast Latitude [deg]",
    "longitude": "CTD Cast Longitude [deg]",
    "t090c": "CTD Cast Temperature 1 [deg C]",
    "t190c": "CTD Cast Temperature 2 [deg C]",
    "c0s/m": "CTD Cast Conductivity 1 [S/m]",
    "c1s/m": "CTD Cast Conductivity 2 [S/m]",
    "sal00": "CTD Cast Salinity 1 [psu]",
    "sal11": "CTD Cast Salinity 2 [psu]",
    "sbeox0v": "CTD Cast Oxygen Voltage [V]",
    "sbeox0ml/l": "CTD Cast Oxygen [mL/L]",
    "oxsolml/l": "CTD Cast Oxygen Saturation [mL/L]",
    "fleco-afl": "CTD Cast Fluorescence [mg/m^3]",
    "flsp": "CTD Cast Fluorescence [mg/m^3]",
    "cstarat0": "CTD Cast Beam Attenuation [1/m]",
    "cstartr0": "CTD Cast Beam Transmission [%]",
    "ph": "CTD Cast pH",
    "times": "CTD Cast Time [seconds]",
}

# Substrings (case-insensitive) that cause a CNV column to be omitted from output.
COLUMN_IGNORE: list[str] = [
    "error",
]

# Matches a distance-offset suffix like " - 500 m SW" or " - 100 m N of Einstein's Grotto".
_STATION_OFFSET_RE = re.compile(r"\s+-\s+\d+\s+m\b.*$")

# Matches the cruise portion and CTD portion of a CTD file key, separated by "_" or "-".
_CTD_FILE_KEY_RE = re.compile(r"^(.+?)[-_](CTD-.+)$", re.IGNORECASE)

# Regex for parsing "# name N = shortName: Description [units]" lines.
_CNV_NAME_RE = re.compile(r"^#\s*name\s+(\d+)\s*=\s*(\S+)\s*:")

# Month abbreviations used when parsing date strings.
MONTHS = {
    name: number
    for number, name in enumerate(
        (
            "jan",
            "feb",
            "mar",
            "apr",
            "may",
            "jun",
            "jul",
            "aug",
            "sep",
            "oct",
            "nov",
            "dec",
        ),
        start=1,
    )
}


def normalize_ctd_file_key(key: str) -> str:
    """
    Strip hyphens from the cruise portion of a CTD file key and normalize the separator to "_".

    Examples:
        "TN-393_CTD-001" -> "TN393_CTD-001"
        "AT42-12_CTD-003" -> "AT4212_CTD-003"
        "TN422-CTD-009" -> "TN422_CTD-009"
    """
    match = _CTD_FILE_KEY_RE.match(key)
    if match:
        return match.group(1).replace("-", "") + "_" + match.group(2)
    return key


# Mapping from raw header keys to CSV column names.
META_KEY_TO_COLUMN_MAP: dict[str, str] = {
    "cruise": "Cruise",
    "cast": "Cast",
    "water_depth": "CTD Cast Water Depth [m]",
    "depth": "CTD Cast Depth [m]",
    "date": "Start Time [UTC]",
}

# Regex for a Sea-Bird user-comment metadata line.
META_REGEX = re.compile(r"^\*\*\s+([A-Za-z ]+?):\s*(.*?)\s*$")

# Regex for a system header line.
SYS_REGEX = re.compile(r"^\*\s+([A-Za-z /()]+?)\s*=\s*(.*?)\s*$")


def load_ctd_file_lookup(summary_path: Path) -> dict[str, tuple[str, list[str]]]:
    """
    Read the summary samples CSV and return a mapping from "CTD File" value (e.g. "TN326_CTD-001")
    to a (station, assets) tuple, where assets is the ordered list of unique "Target Asset" values
    associated with that CTD file.
    """
    try:
        text = summary_path.read_text(encoding="utf-8")
    except OSError as exc:
        log.error("Cannot read summary file %s: %s", summary_path, exc)
        return {}

    mapping: dict[str, tuple[str, list[str]]] = {}
    reader = csv.DictReader(text.splitlines())
    for row in reader:
        ctd_file = normalize_ctd_file_key((row.get("CTD File") or "").strip())
        station = (row.get("Station") or "").strip()
        asset = (row.get("Target Asset") or "").strip()
        if not ctd_file or not station:
            continue
        if ctd_file not in mapping:
            mapping[ctd_file] = (station, [])
        if asset and asset not in mapping[ctd_file][1]:
            mapping[ctd_file][1].append(asset)

    log.info(
        "Loaded %d CTD file → station/asset mappings from '%s'.",
        len(mapping),
        summary_path,
    )
    return mapping


def parse_nmea_utc(value: str) -> str | None:
    """
    Convert an NMEA UTC header string like "Jul 06 2015 15:59:45" to an ISO-8601 UTC string. Returns
    `None` on failure.
    """
    from datetime import datetime, timezone

    try:
        parts = value.split()
        if len(parts) != 4:
            return None
        month = MONTHS.get(parts[0].lower())
        if month is None:
            return None
        day = int(parts[1])
        year = int(parts[2])
        hour, minute, second = (int(part) for part in parts[3].split(":"))
        return datetime(
            year, month, day, hour, minute, second, tzinfo=timezone.utc
        ).isoformat()
    except Exception:
        return None


def parse_nmea_coordinates(value: str) -> float | None:
    """
    Convert an NMEA degree-minute string like "44 31.57 N" or "125 23.67 W" to a signed decimal
    degree float.
    """
    try:
        parts = value.split()
        if len(parts) != 3:
            return None
        degrees = float(parts[0])
        minutes = float(parts[1])
        hemisphere = parts[2].upper()
        decimal_degrees = degrees + minutes / 60.0
        if hemisphere in {"S", "W"}:
            decimal_degrees = -decimal_degrees
        return round(decimal_degrees, 6)
    except Exception:
        return None


def column_name_for(short_name: str) -> str:
    """Return the output column name for a CNV short column name, using case-insensitive lookup."""
    return COLUMN_MAP.get(short_name.lower(), short_name)


def coerce_number(value: str) -> float | str:
    """Try to parse `value` as float; return the original string on failure."""
    try:
        return float(value)
    except ValueError:
        return value


def parse(
    path: Path,
    ctd_file_lookup: dict[str, tuple[str, list[str]]],
    downsample: int | None = None,
    downsample_by: str = "depth",
    downsample_select: str = "average",
) -> Iterator[dict[str, Any]]:
    """Parse a single .cnv file and yield sample dicts."""
    ctd_file_key = normalize_ctd_file_key(path.stem.split("__")[-1])
    lookup = ctd_file_lookup.get(ctd_file_key)
    if lookup is not None:
        station = _STATION_OFFSET_RE.sub("", lookup[0]).strip()
        assets = lookup[1]
    else:
        station = None
        assets = []
    if station is None:
        log.warning(
            "No station found in summary for CTD file %r (%s), skipping.",
            ctd_file_key,
            path,
        )
        return

    try:
        file = path.open(encoding="latin-1")
    except OSError as exc:
        log.error("Cannot read %s: %s", path, exc)
        return

    with file:
        # Parse header: metadata and column definitions (line by line).
        # Use readline() instead of iteration so that tell()/seek() work later.
        meta: dict[str, Any] = {}
        columns: dict[int, str] = {}
        found_end = False

        while True:
            line = file.readline()
            if not line:
                break
            if line.strip() == "*END*":
                found_end = True
                break

            name_match = _CNV_NAME_RE.match(line)
            if name_match:
                column_index = int(name_match.group(1))
                short_name = name_match.group(2)
                if not any(short in short_name.lower() for short in COLUMN_IGNORE):
                    columns[column_index] = column_name_for(short_name)
                continue

            user_comment_match = META_REGEX.match(line)
            if user_comment_match:
                raw_key = re.sub(
                    r"\s+", "_", user_comment_match.group(1).strip().lower()
                )
                value = user_comment_match.group(2).strip()
                if value:
                    csv_key = META_KEY_TO_COLUMN_MAP.get(raw_key)
                    if csv_key and csv_key not in meta:
                        meta[csv_key] = value
                continue

            sys_header_match = SYS_REGEX.match(line)
            if sys_header_match:
                raw_key = sys_header_match.group(1).strip().lower()
                value = sys_header_match.group(2).strip()
                if "nmea latitude" in raw_key:
                    coord = parse_nmea_coordinates(value)
                    if coord is not None:
                        meta["CTD Cast Start Latitude [degrees]"] = coord
                elif "nmea longitude" in raw_key:
                    coord = parse_nmea_coordinates(value)
                    if coord is not None:
                        meta["CTD Cast Start Longitude [degrees]"] = coord
                elif "nmea utc" in raw_key:
                    if "Start Time [UTC]" not in meta:
                        iso_time = parse_nmea_utc(value)
                        meta["Start Time [UTC]"] = (
                            iso_time if iso_time is not None else value
                        )
                continue

        if not found_end or not columns:
            log.warning("No data header or columns found in %s, skipping.", path)
            return

        max_column = max(columns.keys())

        # Find the depth column index for depth-based downsampling.
        depth_column: int | None = None
        if downsample is not None and downsample_by == "depth":
            for column_index, column_name in columns.items():
                if column_name == COLUMN_MAP.get("depsm"):
                    depth_column = column_index
                    break
            if depth_column is None:
                log.warning(
                    "No depth column found in %s, falling back to time-based downsampling.",
                    path,
                )

        # Helper: read all data rows as parsed token lists.
        def read_all_rows() -> list[list[str]]:
            rows: list[list[str]] = []
            while True:
                line = file.readline()
                if not line:
                    break
                line = line.strip()
                if not line:
                    continue
                tokens = line.split()
                if len(tokens) > max_column:
                    rows.append(tokens)
            return rows

        # Helper: build a sample dict from a token list.
        def make_sample(tokens: list[str]) -> dict[str, Any]:
            sample: dict[str, Any] = {
                "Station": station,
                "Target Asset": None,
                **meta,
            }
            for column_index, column_name in columns.items():
                sample[column_name] = coerce_number(tokens[column_index])
            return sample

        # Helper: average numeric columns across multiple token lists.
        def average_tokens(group: list[list[str]]) -> list[str]:
            result: list[str] = list(group[0])
            for column_index in columns:
                values: list[float] = []
                for tokens in group:
                    try:
                        values.append(float(tokens[column_index]))
                    except ValueError:
                        pass
                if values:
                    result[column_index] = str(sum(values) / len(values))
            return result

        # Helper: yield sample dicts for each asset.
        def emit(tokens: list[str]) -> Iterator[dict[str, Any]]:
            sample = make_sample(tokens)
            for asset in assets:
                copy = dict(sample)
                copy["Target Asset"] = asset
                yield copy

        # No downsampling: stream rows directly.
        if downsample is None:
            while True:
                line = file.readline()
                if not line:
                    break
                line = line.strip()
                if not line:
                    continue
                tokens = line.split()
                if len(tokens) > max_column:
                    yield from emit(tokens)
            return

        # --- Downsampling path: read all rows into memory for this file. ---
        all_rows = read_all_rows()
        if not all_rows:
            return

        if len(all_rows) <= downsample:
            # Fewer rows than target: emit everything.
            for tokens in all_rows:
                yield from emit(tokens)
            return

        if downsample_by == "depth" and depth_column is not None:
            # Compute evenly-spaced target depths.
            depths = []
            for i, tokens in enumerate(all_rows):
                try:
                    depths.append((i, float(tokens[depth_column])))
                except ValueError:
                    pass

            if not depths:
                return

            min_depth = min(d for _, d in depths)
            max_depth = max(d for _, d in depths)

            if max_depth <= min_depth:
                # All depths identical: just take evenly-spaced indices.
                step = len(all_rows) / downsample
                for i in range(downsample):
                    yield from emit(all_rows[int(i * step)])
                return

            bin_size = (max_depth - min_depth) / downsample

            if downsample_select == "average":
                # Assign each row to a depth bin, then average each bin.
                bins: dict[int, list[list[str]]] = {}
                for row_index, depth in depths:
                    bin_index = min(int((depth - min_depth) / bin_size), downsample - 1)
                    bins.setdefault(bin_index, []).append(all_rows[row_index])

                for bin_index in sorted(bins):
                    yield from emit(average_tokens(bins[bin_index]))
            else:
                # If "first", pick the nearest row to each target depth.
                sorted_depths = sorted(depths, key=lambda entry: entry[1])
                targets = [min_depth + i * bin_size for i in range(downsample)]
                seen: set[int] = set()
                cursor = 0
                for target in targets:
                    while (
                        cursor < len(sorted_depths) - 1
                        and sorted_depths[cursor][1] < target
                    ):
                        cursor += 1
                    row_index = sorted_depths[cursor][0]
                    if row_index not in seen:
                        seen.add(row_index)
                        yield from emit(all_rows[row_index])
        else:
            # Time-based, evenly-spaced row indices.
            step = len(all_rows) / downsample

            if downsample_select == "average":
                for i in range(downsample):
                    start = int(i * step)
                    end = int((i + 1) * step)
                    group = all_rows[start:end] or [all_rows[start]]
                    yield from emit(average_tokens(group))
            else:
                for i in range(downsample):
                    yield from emit(all_rows[int(i * step)])


def write_samples_as_json(
    samples: Iterator[dict[str, Any]],
    output: Path,
    indent: int,
) -> int:
    """Stream samples to a JSON array file. Returns the number of samples written."""
    count = 0
    separator = ""
    applied_indent = indent or None

    with output.open("w", encoding="utf-8") as stream:
        stream.write("[\n" if applied_indent else "[")

        for sample in samples:
            stream.write(separator)
            json.dump(sample, stream, indent=applied_indent, ensure_ascii=False)
            separator = ",\n" if applied_indent else ","
            count += 1

        stream.write("\n]\n" if applied_indent else "]")

    return count


def discover_columns(
    files: list[Path],
    ctd_file_lookup: dict[str, tuple[str, list[str]]],
    downsample: int | None = None,
    downsample_by: str = "depth",
    downsample_select: str = "average",
) -> list[str]:
    """Do a quick pass over all files to collect the union of all column names in order."""
    columns: dict[str, None] = {}
    for path in files:
        for sample in parse(
            path,
            ctd_file_lookup,
            downsample=downsample,
            downsample_by=downsample_by,
            downsample_select=downsample_select,
        ):
            columns.update(sample)
            break  # Only need the first sample per file to get its columns.
    return list(columns)


def write_samples_as_csv(
    samples: Iterator[dict[str, Any]],
    output: Path,
    columns: list[str],
) -> int:
    """Stream samples to a CSV file. Returns the number of samples written."""
    count = 0
    with output.open("w", encoding="utf-8", newline="") as stream:
        writer = DictWriter(
            stream,
            fieldnames=columns,
            extrasaction="ignore",
        )
        writer.writeheader()
        for sample in samples:
            writer.writerow(sample)
            count += 1
    return count


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert all *.cnv files under ROOT to a single JSON or CSV file.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=dedent("""
          examples:
            # Write to the default output path (<root_name>.csv).
            ./collect_discrete_ctd_cast_samples.py ./ctd-cast-sample-source-files/
            # Write to a JSON file (format inferred from extension).
            ./collect_discrete_ctd_cast_samples.py ./ctd-cast-sample-source-files/ --out ctd-cast-source-files.json
            # Use compact JSON output with no indentation.
            ./collect_discrete_ctd_cast_samples.py ./ctd-cast-sample-source-files/ --out ctd-cast-source-files.json --indent 0
        """),
    )
    parser.add_argument(
        "root",
        type=Path,
        metavar="ROOT",
        help="Root directory to search recursively for *.cnv files.",
    )
    parser.add_argument(
        "--summary-samples",
        type=Path,
        required=True,
        metavar="SUMMARY_CSV",
        help=(
            "Path to the collected discrete summary samples CSV. Used to resolve the Station for "
            "each CTD cast by matching the CTD file key in the .cnv filename against the "
            "'CTD File' column."
        ),
    )
    parser.add_argument(
        "--format",
        choices=["csv", "json"],
        default=None,
        dest="format",
        help="Output format: csv or json. Takes priority over the extension of --out. (default: csv)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        metavar="FILE",
        help=(
            "Output file path. Format is inferred from the extension (.csv or .json) "
            "when recognised, otherwise --format is used. "
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
        "--downsample-casts",
        type=int,
        default=None,
        metavar="N",
        help="Maximum number of evenly-spaced samples to keep per cast. By default all samples are kept.",
    )
    parser.add_argument(
        "--downsample-by",
        choices=["depth", "time"],
        default="depth",
        help="Dimension along which to evenly space downsampled points: 'depth' for even depth "
        "spacing, 'time' for even row-index spacing. (default: depth)",
    )
    parser.add_argument(
        "--downsample-select",
        choices=["average", "first"],
        default="average",
        help="How to select a value within each downsampling bin: 'average' averages all scans "
        "in the bin, 'first' picks a single representative scan. (default: average)",
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
        format = args.format
        out = args.out if args.out is not None else Path(f"{root.name}.{format}")
    elif args.out is not None:
        extension = args.out.suffix.lower()[1:]
        if extension in {"csv", "json"}:
            format = extension
        else:
            log.warning(
                "Unrecognised extension '.%s' in --out, defaulting to 'csv'.",
                extension,
            )
            format = "csv"
        out = args.out
    else:
        format = "csv"
        out = Path(f"{root.name}.csv")

    if not args.summary_samples.exists():
        log.error("Summary file '%s' does not exist.", args.summary_samples)
        return 1

    ctd_file_lookup = load_ctd_file_lookup(args.summary_samples)
    if not ctd_file_lookup:
        log.error(
            "No CTD file → station/asset mappings loaded from '%s', exiting.",
            args.summary_samples,
        )
        return 1

    files = sorted(root.rglob("*.cnv"))
    if not files:
        log.error("No *.cnv files found under '%s', exiting.", root)
        return 1

    log.info("Found %s *.cnv file(s) under '%s'.", len(files), root)

    downsample: int | None = args.downsample_casts
    downsample_by: str = args.downsample_by
    downsample_select: str = args.downsample_select

    def stream() -> Iterator[dict[str, Any]]:
        for file in files:
            log.debug("Parsing '%s'.", file)
            count = 0
            for sample in parse(
                file,
                ctd_file_lookup,
                downsample=downsample,
                downsample_by=downsample_by,
                downsample_select=downsample_select,
            ):
                count += 1
                yield sample
            log.info("  '%s' (%s sample(s))", file, count)

    out.parent.mkdir(parents=True, exist_ok=True)

    match format:
        case "csv":
            columns = discover_columns(
                files,
                ctd_file_lookup,
                downsample=downsample,
                downsample_by=downsample_by,
                downsample_select=downsample_select,
            )
            total = write_samples_as_csv(stream(), out, columns)
        case "json":
            total = write_samples_as_json(stream(), out, args.indent)
        case _:
            total = 0

    log.info("Wrote %s sample(s) from %s file(s).", total, len(files))
    log.info(f"'{out}': ({out.stat().st_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
