# QAQC Dashboard

[![QAQC Pipeline](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/pipeline.yaml/badge.svg)](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/pipeline.yaml)

[![QAQC Pipeline Weekly](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/pipeline_weekly.yaml/badge.svg)](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/pipeline_weekly.yaml)

[![Broadband Hydrophone](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/hydrophone_docker.yaml/badge.svg)](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/hydrophone_docker.yaml)

[![Low Freq Hydrophone](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/lf_hydrophone.yaml/badge.svg)](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/lf_hydrophone.yaml)

[![Profiler Indices](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/profile_indices.yaml/badge.svg)](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/profile_indices.yaml)

Wendi's awesome QAQC Dashboard that will display all the information you need for RCA QAQC Data!

**The Vue based frontend code can be found in `dashboard` directory.**

See the [documentation](https://github.com/OOI-CabledArray/rca-data-tools/blob/main/docs/src/qaqc-dashboard.md) for all the components/repository to deploy the QAQC Dashboard.

## Repositories

The code for the infrastructure, backend, and frontend are hosted in 3 separate repositories: `rca-data-tools`, `QAQC_dashboard`, and `cloud-infrastructure` (_private_) within the `OOI-CabledArray` organization.

- [`rca-data-tools`](https://github.com/OOI-CabledArray/rca-data-tools): contains the majority of the code to perform the creation of png plots and csv plots for the dashboard.
- [`QAQC_dashboard`](https://github.com/OOI-CabledArray/QAQC_dashboard) contains the frontend code for the dashboard.
- [`cloud-infrastructure`](https://github.com/OOI-CabledArray/cloud-infrastructure): contains terraform code for deploying the underlying infrastructure such as Virtual Private Cloud (VPC), CDN, Elastic Container Service (ECS) Tasks, Identity Access Management (IAM), and S3 Buckets.

## Setup

1. Install [`uv`](https://docs.astral.sh/uv/getting-started/installation) and a modern version of NodeJS, with version 24 or higher being recommended.

2. Install Python packages and create a virtual environment.

   ```bash
   uv sync
   ```

3. Activate the new environment at `.venv`.

4. Download a subset of QAQC images and the image index from the RCA QAQC s3 bucket. Images should live at `QAQC_dashboad/dashboard/public/QAQC_plots/`

   ```bash
   python ./dev/setup_dev_images.py
   ```

5. Go to the dashboard folder, install packages, build and serve.

   ```bash
   cd dashboard
   npm install
   npm run build
   npm run serve
   ```

## Development

To run the app in development mode with hot-reloading, while in the `dashboard` directory, execute:

### Running

```bash
npm run dev
```

For additional commands, see [`./dashboard/README.md`](./dashboard/README.md).

### Debugging

When debugging the app, the plot display list can be accessed via `useStore().plotList`.

The following `launch.json` will hit breakpoints in the app code but not `node_modules`:

```
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug in Chrome",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/dashboard",
      "sourceMaps": true,
      "skipFiles": ["${webRoot}/node_modules/**"]
    }
  ]
}
```
