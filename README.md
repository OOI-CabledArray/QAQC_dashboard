# QAQC Dashboard

Wendi's awesome QAQC Dashboard that will display all the information you need for RCA QAQC Data!

## Running the png creation script

1. Install the conda environment.

    ```bash
    conda env create -f environment.yaml
    ```

2. Run the script based on the choices. Below example will display the docs for the script.

    ```bash
    conda activate qaqc-env
    python create_dashboard.py --help
    ```

## Deploy the dashboard with docker

1. Build docker image from dockerfile: `docker build -t qaqc .`
2. Run the container from docker image: `docker run -it --rm -p 8080:80 qaqc:latest`
3. Go to [http://localhost:8080/QAQC_dashboard](http://localhost:8080/QAQC_dashboard)
