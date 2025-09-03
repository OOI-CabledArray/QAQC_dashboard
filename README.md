# QAQC Dashboard

[![QAQC Pipeline](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/pipeline.yaml/badge.svg)](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/pipeline.yaml)

[![QAQC Pipeline Weekly](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/pipeline_weekly.yaml/badge.svg)](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/pipeline_weekly.yaml)

[![Broadband Hydrophone](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/hydrophone_docker.yaml/badge.svg)](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/hydrophone_docker.yaml)

[![Low Freq Hydrophone](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/lf_hydrophone.yaml/badge.svg)](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/lf_hydrophone.yaml)


Wendi's awesome QAQC Dashboard that will display all the information you need for RCA QAQC Data!

**The vue based frontend code can be found in `dashboard` directory.**

See the [documentation](https://github.com/OOI-CabledArray/rca-data-tools/blob/main/docs/src/qaqc-dashboard.md) for all the components/repository to deploy the QAQC Dashboard.

## The repositories

The code for the infrastructure, backend, and frontend are hosted in 3 separate repositories: `rca-data-tools`, `QAQC_dashboard`, and `cloud-infrastructure` (*private*) within the `OOI-CabledArray` organization.

- [`rca-data-tools`](https://github.com/OOI-CabledArray/rca-data-tools): contains the majority of the code to perform the creation of png plots and csv plots for the dashboard.
- [`QAQC_dashboard`](https://github.com/OOI-CabledArray/QAQC_dashboard) contains the frontend code for the dashboard.
- [`cloud-infrastructure`](https://github.com/OOI-CabledArray/cloud-infrastructure): contains terraform code for deploying the underlying infrastructure such as Virtual Private Cloud (VPC), CDN, Elastic Container Service (ECS) Tasks, Identity Access Management (IAM), and S3 Buckets.


## Running the png creation script

1. Install the conda environment.

    ```bash
    conda env create -f environment.yaml
    ```

2. Run the script based on the choices. Below example will display the docs for the script.

    ```bash
    conda activate qaqcdev
    qaqc_pipeline --help
    ```

## Setup (Will need conda to be installed)

1. Install the conda environment. **This will include nodejs and yarn.**

    ```bash
    conda env create -f environment.yaml
    ```

2. Activate the new environment and install [Vue CLI](https://cli.vuejs.org/).

    ```bash
    conda activate qaqcdev
    npm install -g @vue/cli
    ```

3. Go to the dashboard folder, install app and serve.

    ```bash
    cd dashboard
    yarn install
    yarn serve
    ```

4. Go to [http://localhost:8080](http://localhost:8080)

## Debugging 

When debugging the vue app, the plot display list can be accessed via `this.$store.state.plotList` In the plots `Overview.vue` component, the filtered plot png list can be accessed via `this.filteredPlotList`.

The following `launch.json` will hit breakpoints in the app code but not node modules: 

```
{
    "version": "0.2.0",
    "configurations": [
      {
        "name": "Launch chrome for vue",
        "type": "chrome",
        "request": "launch",
        "url": "http://localhost:8080",
        "webRoot": "${workspaceFolder}/dashboard/src",
        "sourceMapPathOverrides": {
          "webpack:///src/*": "${webRoot}/*",
          "webpack:///./node_modules/*": "${webRoot}/node_modules/*"
        },
        "skipFiles": ["${webRoot}/<node_internals>/**", "${webRoot}/node_modules/**"] 
      }
    ]
  }
```
