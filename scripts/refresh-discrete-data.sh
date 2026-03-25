#!/usr/bin/env bash
# Download source data files from the OOI raw data archive and parses them into the discrete sample
# CSVs used by the dashboard. Writes to the following locations under `dashboard/public/`:
#   - ctd-cast-samples.csv
#   - summary-samples.csv
#   - source-data/ctd-casts/ (for .btl files)
#   - source-data/summaries/ (for *Discrete_Summary.csv files)
#
# Usage:
#   ./refresh-discrete-data.sh [TYPE...] [--verbose]
#
# TYPE (optional, repeatable):
#   ctd-cast   Refresh CTD cast samples (ctd-cast-samples.csv)
#   summary    Refresh discrete summary samples (summary-samples.csv)
#
#   When no TYPE is given, both are refreshed.
#
# Options forwarded to download_rawdata.py:
#   --verbose   Enable DEBUG-level logging in the download step.

set -euo pipefail

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISCRETE_DIRECTORY="$SCRIPT_DIRECTORY/../dashboard/public/discrete"

DOWNLOAD_SCRIPT="$SCRIPT_DIRECTORY/download_rawdata.py"

TYPES=()
DOWNLOAD_ARGS=()

for arg in "$@"; do
    case "$arg" in
        ctd-cast|summary)
            TYPES+=("$arg")
            ;;
        --verbose)
            DOWNLOAD_ARGS+=("--verbose")
            ;;
        -h|--help)
            sed -n '2,/^[^#]/{ /^#/{ s/^# \{0,1\}//; p }; /^[^#]/q }' "$0"
            exit 0
            ;;
        *)
            echo "Unknown argument: $arg" >&2
            echo "Usage: $0 [ctd-cast] [summary] [--verbose]" >&2
            exit 1
            ;;
    esac
done

# Default to both types when none are specified.
if [ ${#TYPES[@]} -eq 0 ]; then
    TYPES=(ctd-cast summary)
fi

refresh_ctd_cast() {
    local source="$DISCRETE_DIRECTORY/source-data/ctd-casts"
    local output="$DISCRETE_DIRECTORY/ctd-cast-samples.csv"
    local glob="cruise_data/Cabled/*/Water_Sampling/CTD Data/*.btl"

    echo "==> [ctd-cast] Downloading .btl files into '$source' ..."
    python "$DOWNLOAD_SCRIPT" \
        "$glob" \
        --destination "$source" \
        --flatten \
        "${DOWNLOAD_ARGS[@]+"${DOWNLOAD_ARGS[@]}"}"

    echo "==> [ctd-cast] Parsing .btl files into '$output' ..."
    python "$SCRIPT_DIRECTORY/collect_discrete_ctd_cast_samples.py" \
        "$source" \
        --out "$output"
    echo "==> [ctd-cast] Done. Output written to '$output'."
}

refresh_summary() {
    local source="$DISCRETE_DIRECTORY/source-data/summaries"
    local output="$DISCRETE_DIRECTORY/summary-samples.csv"
    local glob="cruise_data/Cabled/*/Water_Sampling/*Discrete_Summary.csv"

    echo "==> [summary] Downloading discrete summary CSV files into '$source' ..."
    python "$DOWNLOAD_SCRIPT" \
        "$glob" \
        --destination "$source" \
        --flatten \
        "${DOWNLOAD_ARGS[@]+"${DOWNLOAD_ARGS[@]}"}"

    echo "==> [summary] Collecting summary CSVs into '$output' ..."
    python "$SCRIPT_DIRECTORY/collect_discrete_summary_samples.py" \
        "$source" \
        --out "$output"
    echo "==> [summary] Done. Output written to '$output'."
}

for type in "${TYPES[@]}"; do
    case "$type" in
        ctd-cast) refresh_ctd_cast ;;
        summary)  refresh_summary  ;;
    esac
done
