import shutil
from pathlib import Path

marketing_dir = Path(__file__).resolve().parents[1]
pdf_path = marketing_dir / "RocketRFP-OnePager.pdf"
assets_path = marketing_dir / "here-now" / "rocketrfp-post" / "assets" / "RocketRFP-OnePager.pdf"

print("Copying PDF to both locations...")
shutil.copy2(pdf_path, assets_path)
print(f"  -> {assets_path}")
print("Done!")
