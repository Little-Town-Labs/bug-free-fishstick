import base64, json, os, ssl, urllib.error, urllib.request, hashlib
from pathlib import Path

API_KEY = os.environ.get("HERE_NOW_API_KEY")
SLUG = "celest-guitar-ht7f"
BASE = "https://here.now"
B64DIR = Path(__file__).resolve().parent / "b64out"

if not API_KEY:
    raise SystemExit("Set HERE_NOW_API_KEY before publishing.")

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

files_info = [
    ("index.html", "text/html", "index.html.b64"),
    ("styles.css", "text/css", "styles.css.b64"),
    ("assets/dual-loop.png", "image/png", "assets_dual-loop.png.b64"),
    ("assets/user-workflow.png", "image/png", "assets_user-workflow.png.b64"),
    ("assets/knowledge-flywheel.png", "image/png", "assets_knowledge-flywheel.png.b64"),
    ("assets/RocketRFP-OnePager.pdf", "application/pdf", "assets_RocketRFP-OnePager.pdf.b64"),
]

file_entries = []
file_data = {}
for path, ct, b64file in files_info:
    b64path = B64DIR / b64file
    with open(b64path, "r", encoding="utf-8") as f:
        raw = base64.b64decode(f.read())
    file_data[path] = (raw, ct)
    h = hashlib.sha256(raw).hexdigest()
    file_entries.append({"path": path, "size": len(raw), "contentType": ct, "hash": h})
    print(f"  {path}: {len(raw)} bytes")

print("\n[1/3] Creating new version...")
body = json.dumps({"files": file_entries}).encode()
req = urllib.request.Request(
    f"{BASE}/api/v1/publish/{SLUG}", data=body, method="PUT",
    headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
)
resp = urllib.request.urlopen(req, context=ctx)
data = json.loads(resp.read())

upload = data.get("upload", {})
version_id = upload.get("versionId", "")
uploads = upload.get("uploads", [])
skipped = upload.get("skipped", [])

print(f"  Version: {version_id}")
print(f"  Need upload: {len(uploads)} files")
print(f"  Skipped (unchanged): {len(skipped)} files")

print(f"\n[2/3] Uploading {len(uploads)} files...")
for u in uploads:
    path = u["path"]
    url = u["url"]
    ct = u.get("headers", {}).get("Content-Type", "application/octet-stream")
    raw, _ = file_data[path]
    req2 = urllib.request.Request(url, data=raw, method="PUT", headers={"Content-Type": ct})
    resp2 = urllib.request.urlopen(req2, context=ctx)
    print(f"  {path} -> {resp2.status}")

print("\n[3/3] Finalizing...")
fin_body = json.dumps({"versionId": version_id}).encode()
req3 = urllib.request.Request(
    f"{BASE}/api/v1/publish/{SLUG}/finalize",
    data=fin_body, method="POST",
    headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
)
try:
    resp3 = urllib.request.urlopen(req3, context=ctx)
    fin = json.loads(resp3.read())
    print(f"  LIVE at {fin.get('siteUrl', f'https://{SLUG}.here.now/')}")
except urllib.error.HTTPError as e:
    print(f"  Error {e.code}: {e.read().decode()}")

print("\nDone!")
