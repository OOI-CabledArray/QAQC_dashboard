
import s3fs
from pathlib import Path
import tqdm

BUCKET = "ooi-rca-qaqc-prod"
PREFIX = "QAQC_plots"
LOCAL_DIR = Path(__file__).parent.parent / "dashboard" / "public" / "QAQC_plots"
DEV_INSTRUMENTS = ["CTD", "PH"]

def download_dev_images(bucket, prefix, local_dir, dev_instruments):
    """
    Download a subset of QAQC PNGs from S3 path this script can be modified based on dev needs.
    """
    fs = s3fs.S3FileSystem(anon=False) 
    local_dir = Path(local_dir)
    local_dir.mkdir(parents=True, exist_ok=True)

    print("copying qaqc image index")
    index_path = fs.glob(f"s3://{bucket}/{prefix}/index.json")
    index_name = Path(index_path[0]).name
    local_index = local_dir / index_name
    fs.get(index_path[0], str(local_index))


    # do not grab any overlay plots, only grab CTD and PH instruments
    print("copying subset of pngs from rca s3...")
    pngs = fs.glob(f"s3://{bucket}/{prefix}/**/*.png")
    svgs = fs.glob(f"s3://{bucket}/{prefix}/**/*.svg")
    all_images = pngs + svgs
    files = [
        f for f in all_images
        if (("none" in Path(f).name.lower() or  "anno" in Path(f).name.lower())
        and any(instrument.lower() in Path(f).name.lower() for instrument in dev_instruments))
    ]

    for s3_path in tqdm.tqdm(files, desc="downloading dev pngs", unit="file"):
        filename = Path(s3_path).name
        local_path = local_dir / filename[:8] / filename


        fs.get(s3_path, str(local_path))

    print(f"✅ Finished downloading {len(files)} dev pngs to {local_dir}")

if __name__ == "__main__":
    download_dev_images(BUCKET, PREFIX, LOCAL_DIR, DEV_INSTRUMENTS)
