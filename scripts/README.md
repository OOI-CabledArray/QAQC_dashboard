# Discrete sample data

The dashboard's Discrete page reads two CSVs from S3:

```
s3://<bucket>/discrete/summary-samples.csv     # one row per water sample
s3://<bucket>/discrete/ctd-cast-samples.csv    # one row per CTD scan
```

Both are regenerated from the OOI raw data archive and uploaded by hand. The
filenames are referenced directly in `dashboard/app/discrete.ts`, so they must
not change.

## Refreshing

```sh
./scripts/refresh-discrete-data.sh              # both
./scripts/refresh-discrete-data.sh summary      # just summary-samples.csv
./scripts/refresh-discrete-data.sh ctd-cast     # just ctd-cast-samples.csv
```

This downloads source files from <https://rawdata-west.oceanobservatories.org/files/>
and writes output to `dashboard/public/discrete/` (gitignored):

| output | source glob |
|---|---|
| `summary-samples.csv` | `cruise_data/Cabled/*/Water_Sampling/*Discrete_Summary.csv` |
| `ctd-cast-samples.csv` | `cruise_data/Cabled/*/Water_Sampling/CTD Data/*.cnv` |

Each run rebuilds from every cruise the glob matches, so a new cruise is picked
up automatically — there is nothing to append.

`ctd-cast` resolves each scan's station by matching the CTD file key in the
`.cnv` filename (`TN326_CTD-001`) against the `CTD File` column of
`summary-samples.csv`, and refreshes the summary first if it is missing. Casts
are downsampled to 200 points, binned by depth and averaged, to keep the file
small enough to chart.

Then upload:

```sh
aws s3 cp dashboard/public/discrete/summary-samples.csv  s3://ooi-rca-qaqc-prod/discrete/
aws s3 cp dashboard/public/discrete/ctd-cast-samples.csv s3://ooi-rca-qaqc-prod/discrete/
```

No index to regenerate; the dashboard fetches both files by name.

## Adding a new cruise

Check whether the cruise has published water sampling data before running
anything — the directory appears in the archive as soon as the cruise sails,
months before the processed files land:

```sh
curl -s https://rawdata-west.oceanobservatories.org/files/cruise_data/Cabled/ | grep Cabled-
curl -s 'https://rawdata-west.oceanobservatories.org/files/cruise_data/Cabled/<CRUISE>/Water_Sampling/'
```

You want a `*Discrete_Summary.csv` and a `CTD Data/` directory. If they are
absent, the data is not ready and a refresh will silently produce the same
output as before.

**The glob assumes underscores.** Cruises through Cabled-15 use
`Water_Sampling/`; Cabled-16 (AT50-41, 2025) uses `Water Sampling/` with a
space. A cruise named that way matches nothing and is skipped without error —
update the globs in `refresh-discrete-data.sh` to cover both spellings when
that cruise's data is published.

## Coverage

As published, `summary-samples.csv` holds 2,399 rows across 15 cruises,
Cabled-06 (TN326, 2015) through Cabled-15 (AT50-29, 2024). Cabled-16 (AT50-41,
Aug 2025) has no water sampling data in the archive as of October 2026.

## Scripts

| script | role |
|---|---|
| `refresh-discrete-data.sh` | orchestrates download + collect; the entry point |
| `download_rawdata.py` | mirrors a glob of the raw data archive locally |
| `collect_discrete_summary_samples.py` | concatenates per-cruise `*Discrete_Summary.csv` |
| `collect_discrete_ctd_cast_samples.py` | parses Sea-Bird `.cnv` profiles into scans |

The collect scripts can be run directly against a directory of source files;
pass `--help` for options.

While concatenating summaries the first file's header becomes canonical, columns
containing "bottle" are dropped, `Bottom Depth at Start Position [m]` is renamed
to `Water Depth [m]`, station distance offsets (`- 500 m SW`) are stripped,
`Cast` is normalised (`CTD-001` → `1`), and a comma-separated `Target Asset` is
split into one row per asset. These are idempotent, so an already-collected file
can be used as input — useful for extending the record without re-downloading
every cruise.
