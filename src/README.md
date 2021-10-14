# Dashboard source code folder

This folder contains the QAQC Dashboard Source code for the frontend.

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
