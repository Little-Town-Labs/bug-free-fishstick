import base64
import os
from pathlib import Path

base_dir = Path(__file__).resolve().parent
src = base_dir / "rocketrfp-post"
out = base_dir / "b64out"
out.mkdir(exist_ok=True)

files = [
    "index.html",
    "styles.css",
    os.path.join("assets", "dual-loop.png"),
    os.path.join("assets", "user-workflow.png"),
    os.path.join("assets", "knowledge-flywheel.png"),
    os.path.join("assets", "RocketRFP-OnePager.pdf"),
]

for f in files:
    full = src / f
    data = full.read_bytes()
    safe_name = f.replace(os.sep, "_").replace("/", "_") + ".b64"
    out_path = out / safe_name
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(base64.b64encode(data).decode())
    print(f"{f}: {len(data)} bytes -> {safe_name}")

print("DONE")
