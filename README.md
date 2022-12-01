# QAQC Dashboard

[![QAQC Pipeline](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/pipeline.yaml/badge.svg)](https://github.com/OOI-CabledArray/QAQC_dashboard/actions/workflows/pipeline.yaml)

Wendi's awesome QAQC Dashboard that will display all the information you need for RCA QAQC Data!

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
