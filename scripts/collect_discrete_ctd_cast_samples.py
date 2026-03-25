#!/usr/bin/env python3
"""
Parse all Sea-Bird *.btl bottle files under a given root directory and emit a single CSV/JSON file
where every line/array element represents one bottle-closure sample.

Usage:
    ./collect_discrete_ctd_cast_samples.py ROOT [--out FILE] [--format {csv,json}] [--indent N] [--verbose]

The output format is inferred from the extension of `--out` when it is ".csv" or ".json".

If the extension is unrecognised, `--format` is used instead (default: csv).
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from csv import DictWriter
from datetime import datetime, timezone
from pathlib import Path
from textwrap import dedent
from typing import Any

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)-8s %(message)s",
)
log = logging.getLogger(__name__)

# Sea-Bird BTL column names mapping matching the discrete sample column names as closely as
# possible.
COLUMN_MAP: dict[str, str] = {
    "Bottle": "_btl_bottle_number",  # Internal, written as "Bottle Position".
    "Date": "_btl_date",  # Internal, combined with time to create "Bottle Closure Time [UTC]".
    "PrDM": "CTD Pressure [db]",
    "DepSM": "CTD Depth [m]",
    "Latitude": "CTD Latitude [deg]",
    "Longitude": "CTD Longitude [deg]",
    "T090C": "CTD Temperature 1 [deg C]",
    "T190C": "CTD Temperature 2 [deg C]",
    "C0S/m": "CTD Conductivity 1 [S/m]",
    "C1S/m": "CTD Conductivity 2 [S/m]",
    "Sal00": "CTD Salinity 1 [psu]",
    "Sal11": "CTD Salinity 2 [psu]",
    "Sbeox0V": "CTD Oxygen Voltage [V]",
    "Sbeox0ML/L": "CTD Oxygen [mL/L]",
    "OxsolML/L": "CTD Oxygen Saturation [mL/L]",
    "FlECO-AFL": "CTD Fluorescence [mg/m^3]",
    "FlSP": "CTD Fluorescence [mg/m^3]",
    "CStarAt0": "CTD Beam Attenuation [1/m]",
    "CStarTr0": "CTD Beam Transmission [%]",
    "Ph": "CTD pH",
}

# Rules for mapping a raw `.btl` Location/Station/Station Name/Station Number string to the
# canonical station name used in summary-samples.csv.
#
# Each entry is a (keywords, station_name) pair.  All keywords in the tuple must appear
# (case-insensitively) somewhere in the location string for the rule to match.  The first
# matching rule wins.  More-specific rules (more keywords, or narrower terms) must therefore
# appear before less-specific ones.
#
# Station names deliberately omit the "- <N> m <direction>" offset suffix so that multiple nearby
# cast positions all resolve to the same base name.  If the matched station name has no recognised
# platform-type suffix (" Shallow Profiler", " Deep Profiler", " BEP", " Junction Box") one is
# appended automatically by `_ensure_station_suffix`.
LOCATION_STATION_RULES: list[tuple[list[str], str]] = [
    #
    # Exact CTD-number codes. These must precede generic keyword rules.
    #
    # TN326 2015: slope base junction box
    (["ctd12"], "Slope Base Junction Box LJ01A"),
    (["ctd13"], "Slope Base Junction Box LJ01A"),
    (["ctd17"], "Slope Base Junction Box LJ01A"),
    (["ctd19"], "Slope Base Junction Box LJ01A"),
    # TN326 2015: slope base shallow profiler
    (["ctd02"], "Slope Base Shallow Profiler"),
    (["ctd14"], "Slope Base Shallow Profiler"),
    # TN326 2015: axial base shallow profiler
    (["ctd03"], "Axial Base Shallow Profiler"),
    (["ctd04"], "Axial Base Shallow Profiler"),
    (["ctd05"], "Axial Base Shallow Profiler"),
    # SKQ201610S 2016: slope base junction box
    (["ca_ctd_2016-02"], "Slope Base Junction Box LJ01A"),
    # SKQ201610S 2016: slope base shallow profiler
    (["ca_ctd_2016-03"], "Slope Base Shallow Profiler"),
    (["ca_ctd_2016-06"], "Slope Base Shallow Profiler"),
    # AT50-29 2024: axial base shallow profiler
    (["ctd 12"], "Axial Base Shallow Profiler"),
    (["ctd 13"], "Axial Base Shallow Profiler"),
    # AT50-29 2024: oregon offshore shallow profiler
    (["ctd 009"], "Oregon Offshore Shallow Profiler"),
    (["ctd 14"], "Oregon Offshore Shallow Profiler"),
    #
    # Generic keyword rules.
    #
    # Slope Base Junction Box
    (["lv01a"], "Slope Base Junction Box LV01A"),
    (["lj01a"], "Slope Base Junction Box LJ01A"),
    (["bubble", "plume"], "Slope Base Junction Box LJ01A"),
    # Slope Base Deep Profiler
    (["slope", "base", "dp"], "Slope Base Deep Profiler"),
    (["slope", "base", "deep"], "Slope Base Deep Profiler"),
    # Slope Base Shallow Profiler
    (["slope", "base"], "Slope Base Shallow Profiler"),
    # Axial Base Deep Profiler
    (["axial", "dp"], "Axial Base Deep Profiler"),
    (["axial", "deep"], "Axial Base Deep Profiler"),
    # Axial Base Shallow Profiler
    (["axial"], "Axial Base Shallow Profiler"),
    # Oregon Offshore Deep Profiler
    (["offshore", "dp"], "Oregon Offshore Deep Profiler"),
    (["offshore", "deep"], "Oregon Offshore Deep Profiler"),
    (["offshore", "600"], "Oregon Offshore Deep Profiler"),
    (["endurance", "dp"], "Oregon Offshore Deep Profiler"),
    # Oregon Shelf BEP
    (["shelf"], "Oregon Shelf BEP"),
    # Oregon Offshore Shallow Profiler
    (["offshore"], "Oregon Offshore Shallow Profiler"),
    (["endurance"], "Oregon Offshore Shallow Profiler"),
]


def lookup_station(location: str) -> str | None:
    """
    Return the canonical summary-samples.csv station name for a raw btl Location/Station value,
    or None if no rule matches.

    Each rule in LOCATION_STATION_RULES is checked in order; the first whose keywords are all
    present (case-insensitively) in `location` wins.
    """
    lower = location.lower()
    for keywords, station_name in LOCATION_STATION_RULES:
        if all(kw in lower for kw in keywords):
            return station_name
    return None


# Mapping from raw header keys to CSV column names.
META_KEY_TO_COLUMN_MAP: dict[str, str] = {
    "cruise": "Cruise",
    "cast": "Cast",
    "station": "Station",
    "station_name": "Station",
    "station_number": "Station",
    "location": "Station",
    "water_depth": "CTD Cast Water Depth [m]",
    "depth": "CTD Depth [m]",
    "date": "Start Time [UTC]",
}


def sanitise_key(column_name: str) -> str:
    """
    Convert an unmapped Sea-Bird column name to a safe JSON key by replacing every run of
    non-alphanumeric characters with a single underscore.
    """
    return re.sub(r"[^A-Za-z0-9]+", "_", column_name).strip("_")


def column_to_key(column_name: str) -> str:
    """Return the JSON key for a Sea-Bird column name."""
    if column_name in COLUMN_MAP:
        return COLUMN_MAP[column_name]

    return sanitise_key(column_name)


def is_stdev_key(key: str) -> bool:
    """Return `True` if `key` is a standard-deviation companion column."""
    return key.endswith(" stdev") or key.endswith("_sdev")


def stdev_key(measurement_key: str) -> str:
    """
    Return the standard-deviation companion key for a measurement key.

    For keys that match CSV column names (contain spaces / brackets) the stdev is appended as a
    suffix in a consistent way so downstream code can find it. For plain snake_case keys the _sdev
    suffix is used.
    """
    if " " in measurement_key or "[" in measurement_key:
        return measurement_key + " stdev"
    return measurement_key + "_sdev"


# Regex for a Sea-Bird user-comment metadata line.
META_REGEX = re.compile(r"^\*\*\s+([A-Za-z ]+?):\s*(.*?)\s*$")

# Regex for a system header line.
SYS_REGEX = re.compile(r"^\*\s+([A-Za-z /()]+?)\s*=\s*(.*?)\s*$")

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


def parse_datetime(text: str, time_text: str) -> str | None:
    """
    Combine a date token like "Aug 06 2021" and a time token like "00:08:19" into an ISO-8601 UTC
    string. Returns `None` on failure.
    """
    try:
        parts = text.split()
        if len(parts) == 3:
            month = MONTHS.get(parts[0].lower())
            if month is None:
                return None
            day = int(parts[1])
            year = int(parts[2])
        else:
            return None

        hour, minute, second = (int(part) for part in time_text.split(":"))
        return datetime(
            year,
            month,
            day,
            hour,
            minute,
            second,
            tzinfo=timezone.utc,
        ).isoformat()
    except Exception:
        return None


def parse_nmea_utc(value: str) -> str | None:
    """
    Convert an NMEA UTC header string like "Jul 06 2015 15:59:45" to an ISO-8601 UTC string. Returns
    `None` on failure.
    """
    try:
        # Format: "Mon DD YYYY HH:MM:SS"
        nmea_parts = value.split()
        if len(nmea_parts) != 4:
            return None
        date_str = " ".join(nmea_parts[:3])  # "Jul 06 2015"
        time_str = nmea_parts[3]  # "15:59:45"
        return parse_datetime(date_str, time_str)
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


def coerce_number(value: str) -> float | str:
    """Try to parse `value` as float; return the original string on failure."""
    try:
        return float(value)
    except ValueError:
        return value


def parse(path: Path) -> list[dict[str, Any]]:
    try:
        text = path.read_text(encoding="latin-1")
    except OSError as exc:
        log.error("Cannot read %s: %s", path, exc)
        return []

    lines = text.splitlines()

    #
    # Extract header metadata values, which are values included in all samples.
    #
    meta: dict[str, Any] = {}

    for line in path.open(encoding="latin-1"):
        # User-defined comment fields:  ** Cruise: TN393
        user_comment_match = META_REGEX.match(line)
        if user_comment_match:
            raw_key = re.sub(r"\s+", "_", user_comment_match.group(1).strip().lower())
            value = user_comment_match.group(2).strip()
            if value:
                csv_key = META_KEY_TO_COLUMN_MAP.get(raw_key)
                if csv_key:
                    # "Station" can be supplied by multiple source keys, first wins.
                    if csv_key not in meta:
                        if csv_key == "Station":
                            canonical = lookup_station(value)
                            if canonical is not None:
                                meta["Station"] = canonical
                            else:
                                log.warning(
                                    "No station mapping found for location %r in %s, skipping.",
                                    value,
                                    path,
                                )
                        else:
                            meta[csv_key] = value

            continue

        # System header fields.
        sys_header_match = SYS_REGEX.match(line)
        if sys_header_match:
            raw_key = sys_header_match.group(1).strip().lower()
            value = sys_header_match.group(2).strip()
            if "nmea latitude" in raw_key:
                coord = parse_nmea_coordinates(value)
                if coord is not None:
                    meta["Start Latitude [degrees]"] = coord
            elif "nmea longitude" in raw_key:
                coord = parse_nmea_coordinates(value)
                if coord is not None:
                    meta["Start Longitude [degrees]"] = coord
            elif "nmea utc" in raw_key:
                # Only use as Start Time fallback if not already set by ** Date
                if "Start Time [UTC]" not in meta:
                    iso_time = parse_nmea_utc(value)
                    meta["Start Time [UTC]"] = (
                        iso_time if iso_time is not None else value
                    )
            elif "software version" in raw_key:
                meta["software_version"] = value
            continue

        # Stop scanning metadata once we hit the data section
        if line.strip().startswith("Bottle") and "Date" in line:
            break

    # Find column header line and parse column names.
    header_line_index: int | None = None
    raw_columns: list[str] = []

    for line_index, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("Bottle") and "Date" in stripped:
            # Split on whitespace. The header uses fixed-width layout but whitespace splitting is
            # reliable for the column names themselves.
            raw_columns = stripped.split()
            header_line_index = line_index
            break

    if "Station" not in meta:
        return []

    if header_line_index is None:
        log.warning("No data header found in %s, skipping.", path)
        return []

    # Map Sea-Bird column names → clean JSON keys
    json_keys = [column_to_key(column_name) for column_name in raw_columns]

    #
    # Parse data rows.
    #
    # The BTL format interleaves "avg" and "sdev" rows, but we really only care about the averages.
    #
    # The bottle number and date appear on the avg row; the time of day
    # appears in the same column position as "Date" on the sdev row.
    # We combine them into a single ISO timestamp.
    #
    # Skip the "Position  Time  ..." unit row immediately after the header.
    data_start_index = header_line_index + 2
    if data_start_index < len(lines) and "Position" in lines[data_start_index - 1]:
        pass  # already correct — unit row was at header_line_index + 1

    samples: list[dict[str, Any]] = []
    row_index = data_start_index

    while row_index < len(lines):
        avg_line = lines[row_index]

        # Skip blank lines
        if not avg_line.strip():
            row_index += 1
            continue

        if not avg_line.strip().endswith("(avg)"):
            row_index += 1
            continue

        # Peek at the next non-empty line to get the sdev row.
        sdev_line = ""
        sdev_search_index = row_index + 1
        while sdev_search_index < len(lines):
            if lines[sdev_search_index].strip():
                if lines[sdev_search_index].strip().endswith("(sdev)"):
                    sdev_line = lines[sdev_search_index]
                break
            sdev_search_index += 1

        # Parse the "avg" row, stripping the trailing "(avg)" marker before splitting.
        avg_values_raw = avg_line.strip().rstrip("(avg)").strip()
        # The first token is the bottle number, the next three tokens form the date ("Aug 06 2021"),
        # then the remaining tokens are numeric values.
        avg_tokens = avg_values_raw.split()

        # ---- Parse the sdev row ----------------------------------------
        sdev_tokens: list[str] = []
        if sdev_line:
            sdev_values_raw = sdev_line.strip().rstrip("(sdev)").strip()
            sdev_tokens = sdev_values_raw.split()

        # Reconstruct per-column token lists.
        avg_column_tokens: list[str | None] = []
        sdev_column_tokens: list[str | None] = []

        try:
            # Append bottle number.
            avg_column_tokens.append(avg_tokens[0])
            # No bottle number on sdev row.
            sdev_column_tokens.append(None)

            # Date is 3 tokens, time is 1.
            date_text = " ".join(avg_tokens[1:4])
            avg_column_tokens.append(date_text)

            time_text = sdev_tokens[0] if sdev_tokens else None
            sdev_column_tokens.append(time_text)

            # Remaining numeric columns, one token each.
            for avg_token_index in range(4, len(avg_tokens)):
                avg_column_tokens.append(avg_tokens[avg_token_index])
            for sdev_token_index in range(1, len(sdev_tokens)):
                sdev_column_tokens.append(sdev_tokens[sdev_token_index])

        except IndexError:
            log.warning(
                "Malformed row in %s at line %d, skipping bottle.", path, row_index + 1
            )
            row_index = sdev_search_index + 1
            continue

        # Build the sample with "Station" and "Target Asset" at the front.
        station = meta["Station"]
        sample: dict[str, Any] = {
            "Station": station,
            "Target Asset": f"CTD Cast ({station})",
            **{key: value for key, value in meta.items() if key != "Station"},
        }

        # Populate measured columns.
        date_part: str = ""
        time_part: str = ""

        for column_index, json_key in enumerate(json_keys):
            avg_text = (
                avg_column_tokens[column_index]
                if column_index < len(avg_column_tokens)
                else None
            )
            sdev_text = (
                sdev_column_tokens[column_index]
                if column_index < len(sdev_column_tokens)
                else None
            )

            if json_key == "_btl_bottle_number":
                sample["CTD Cast Bottle Position"] = (
                    int(avg_text) if avg_text is not None else None
                )

            elif json_key == "_btl_date":
                # Defer writing the datetime until we also have the time.
                date_part = avg_text or ""
                time_part = sdev_text or ""

            else:
                # Numeric measurement, skip internal sentinel keys.
                if json_key.startswith("_btl_"):
                    continue
                if avg_text is not None:
                    sample[json_key] = coerce_number(avg_text)
                if sdev_text is not None:
                    sample[stdev_key(json_key)] = coerce_number(sdev_text)

        # Combine date and time into ISO-8601 UTC → "CTD Bottle Closure Time [UTC]".
        if date_part and time_part:
            iso = parse_datetime(date_part, time_part)
            if iso:
                sample["CTD Cast Bottle Closure Time [UTC]"] = iso
            else:
                sample["CTD Cast Bottle Closure Time [UTC]"] = (
                    f"{date_part} {time_part}"
                )
        elif date_part:
            sample["CTD Cast Bottle Closure Time [UTC]"] = date_part

        # Drop stdev keys before storing.
        sample = {key: value for key, value in sample.items() if not is_stdev_key(key)}
        samples.append(sample)
        row_index = sdev_search_index + 1

    return samples


def write_samples_as_json(
    samples: list[dict[str, Any]],
    output: Path,
    indent: int,
) -> None:
    with output.open("w", encoding="utf-8") as stream:
        json.dump(
            samples,
            stream,
            indent=indent or None,
            ensure_ascii=False,
        )
        stream.write("\n")


def write_samples_as_csv(samples: list[dict[str, Any]], output: Path) -> None:

    columns: dict[str, None] = {}
    for sample in samples:
        # Add keys from all fields, values are updated here, but ignored. Preserve insertion order
        # by using dictionary keys as an ordered set.
        columns.update(sample)

    with output.open("w", encoding="utf-8", newline="") as stream:
        writer = DictWriter(
            stream,
            fieldnames=list(columns),
            extrasaction="ignore",
        )
        writer.writeheader()
        writer.writerows(samples)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert all *.btl files under ROOT to a single JSON or CSV file.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=dedent("""
          examples:
            # Write to the default output path (<root_name>.csv).
            ./collect_discrete_ctd_cast_samples.py ./ctd-cast-sample-source-files/
            # Write to a JSON file (format inferred from extension).
            ./collect_discrete_ctd_cast_samples.py ./ctd-cast-sample-source-files/ --out ctd-cast-source-files.json
            # Override format explicitly.
            ./collect_discrete_ctd_cast_samples.py ./ctd-cast-sample-source-files/ --out ctd-cast-source-files.json
            # Use compact JSON output with no indentation.
            ./collect_discrete_ctd_cast_samples.py ./ctd-cast-sample-source-files/ --out ctd-cast-source-files.json --indent 0
        """),
    )
    parser.add_argument(
        "root",
        type=Path,
        metavar="ROOT",
        help="Root directory to search recursively for *.btl files.",
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
        # The `--format` was explicitly provided, and takes priority.
        format = args.format
        out = args.out if args.out is not None else Path(f"{root.name}.{format}")
    elif args.out is not None:
        # No explicit `--format`, infer from the file extension.
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
        # Neither `--format` or `--out` provided, use defaults.
        format = "csv"
        out = Path(f"{root.name}.csv")

    files = sorted(root.rglob("*.btl"))
    if not files:
        log.error("No *.btl files found under '%s', exiting.", root)
        return 1

    log.info("Found %s *.btl file(s) under '%s'.", len(files), root)

    samples: list[dict[str, Any]] = []

    for file in files:
        log.debug("Parsing '%s'.", file)
        file_samples = parse(file)
        log.info("  '%s' (%s sample(s))", file, len(file_samples))
        samples.extend(file_samples)

    log.info("Parsed %s sample(s) from %s file(s).", len(samples), len(files))

    out.parent.mkdir(parents=True, exist_ok=True)

    match format:
        case "csv":
            write_samples_as_csv(samples, out)
        case "json":
            write_samples_as_json(samples, out, args.indent)

    log.info(f"'{out}': ({out.stat().st_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
