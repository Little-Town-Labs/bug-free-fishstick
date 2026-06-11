"""RocketRFP one-pager leave-behind (US Letter, single page PDF)."""
from pathlib import Path
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch

NAVY = HexColor("#0B1B3B")
ORANGE = HexColor("#FF6B35")
BLUE = HexColor("#3B82F6")
BG = HexColor("#F8FAFC")
BODY = HexColor("#1E293B")
MUTED = HexColor("#64748B")
WHITE = HexColor("#FFFFFF")

HERE = Path(__file__).parent
OUT = HERE / "RocketRFP-OnePager.pdf"

W, H = LETTER  # 612 x 792 pt
M = 0.5 * inch

c = canvas.Canvas(str(OUT), pagesize=LETTER)

# ---------- Header band ----------
c.setFillColor(NAVY)
c.rect(0, H - 1.4 * inch, W, 1.4 * inch, fill=1, stroke=0)
c.setFillColor(ORANGE)
c.rect(0, H - 1.5 * inch, W, 0.1 * inch, fill=1, stroke=0)

# Wordmark
c.setFont("Helvetica-Bold", 32)
c.setFillColor(WHITE)
c.drawString(M, H - 0.85 * inch, "Rocket")
rkt_w = c.stringWidth("Rocket", "Helvetica-Bold", 32)
c.setFillColor(ORANGE)
c.drawString(M + rkt_w, H - 0.85 * inch, "RFP")

# Tagline (right of wordmark)
c.setFont("Helvetica", 11)
c.setFillColor(BG)
c.drawString(M, H - 1.15 * inch, "AI-Powered Proposal Response  ·  From Days to Hours")

# ---------- Headline value prop ----------
y = H - 2.0 * inch
c.setFillColor(NAVY)
c.setFont("Helvetica-Bold", 18)
c.drawString(M, y, "Win more bids without growing the team.")
y -= 0.32 * inch
c.setFont("Helvetica", 11)
c.setFillColor(BODY)
text = c.beginText(M, y)
text.setLeading(15)
for line in [
    "RocketRFP turns a 50-page RFP into a structured checklist in minutes, then drafts 60–80%",
    "of your response from a knowledge base of your past wins, certifications, and standard answers.",
    "Your team reviews, refines, and ships — instead of starting from a blank page.",
]:
    text.textLine(line)
c.drawText(text)
y -= 0.95 * inch

# ---------- Three big metrics ----------
metrics = [("3–7 days  →  2–4 hrs", "per response"),
           ("60–80%", "auto-completed by AI"),
           ("3×", "more bids, same headcount")]
col_w = (W - 2 * M) / 3
for i, (big, sm) in enumerate(metrics):
    cx = M + col_w * i
    c.setStrokeColor(ORANGE if i == 0 else NAVY)
    c.setLineWidth(2 if i == 0 else 0.6)
    c.roundRect(cx + 4, y - 0.95 * inch, col_w - 8, 0.95 * inch, 6, stroke=1, fill=0)
    c.setFont("Helvetica-Bold", 18)
    c.setFillColor(ORANGE if i == 0 else NAVY)
    c.drawCentredString(cx + col_w / 2, y - 0.42 * inch, big)
    c.setFont("Helvetica", 9)
    c.setFillColor(MUTED)
    c.drawCentredString(cx + col_w / 2, y - 0.72 * inch, sm)
y -= 1.15 * inch

# ---------- How it works (compact) ----------
c.setFillColor(NAVY)
c.setFont("Helvetica-Bold", 13)
c.drawString(M, y, "How it works")
y -= 0.05 * inch
c.setStrokeColor(ORANGE); c.setLineWidth(2)
c.line(M, y, M + 0.7 * inch, y)
y -= 0.25 * inch

steps = [
    ("1.  UPLOAD", "Drag a PDF/Word RFP, or paste a portal URL."),
    ("2.  EXTRACT", "AI structures every question and required deliverable in ~2 minutes."),
    ("3.  DRAFT", "AI populates a side-by-side canvas using your private knowledge base."),
    ("4.  REFINE", "Edit, accept, or chat with the KB to fill gaps. Confidence scores flag review items."),
    ("5.  EXPORT", "Filled PDF/Word in original format, or quick-copy for web portals."),
]
c.setFont("Helvetica", 10)
for label, desc in steps:
    c.setFillColor(ORANGE); c.setFont("Helvetica-Bold", 10)
    c.drawString(M, y, label)
    c.setFillColor(BODY); c.setFont("Helvetica", 10)
    c.drawString(M + 0.95 * inch, y, desc)
    y -= 0.22 * inch
y -= 0.1 * inch

# ---------- Two columns: Why it works  /  Security ----------
col1_x = M
col2_x = M + (W - 2 * M) / 2 + 0.1 * inch
col_w_in = (W - 2 * M) / 2 - 0.1 * inch

def section(x, y, title, items):
    c.setFillColor(NAVY); c.setFont("Helvetica-Bold", 12)
    c.drawString(x, y, title)
    c.setStrokeColor(ORANGE); c.setLineWidth(2)
    c.line(x, y - 3, x + 0.6 * inch, y - 3)
    yy = y - 0.28 * inch
    c.setFont("Helvetica", 9.5)
    for it in items:
        c.setFillColor(ORANGE); c.drawString(x, yy, "▸")
        c.setFillColor(BODY)
        # crude wrap at ~70 chars
        max_chars = 68
        words = it.split()
        line = ""
        first = True
        for w in words:
            if len(line) + len(w) + 1 > max_chars:
                c.drawString(x + 0.16 * inch, yy, line)
                yy -= 0.16 * inch
                line = w
                first = False
            else:
                line = (line + " " + w).strip()
        if line:
            c.drawString(x + 0.16 * inch, yy, line)
            yy -= 0.16 * inch
        yy -= 0.04 * inch
    return yy

y_left = section(col1_x, y, "Why it wins", [
    "Side-by-side canvas, not a black-box generator — every answer is editable",
    "Sources every draft from your KB; flags low-confidence items for review",
    "Handles PDFs, Word, and web portal forms (where most tools give up)",
    "Won proposals feed back into the KB, so quality compounds over time",
])
y_right = section(col2_x, y, "Built for the enterprise", [
    "Per-tenant isolation; encrypted at rest and in transit",
    "SSO + role-based access (admin / reviewer / contributor)",
    "Signed, expiring file URLs",
    "LLM-agnostic — Claude, GPT, or private/local model option",
])
y = min(y_left, y_right) - 0.1 * inch

# ---------- CTA / Contact band ----------
band_h = 1.05 * inch
c.setFillColor(NAVY)
c.rect(0, 0, W, band_h, fill=1, stroke=0)
c.setFillColor(ORANGE)
c.rect(0, band_h, W, 0.06 * inch, fill=1, stroke=0)

c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 14)
c.drawString(M, band_h - 0.35 * inch, "See it on one of your live RFPs.")
c.setFillColor(BG); c.setFont("Helvetica", 10)
c.drawString(M, band_h - 0.55 * inch,
             "30-minute working session — we'll show you the draft your team would")
c.drawString(M, band_h - 0.70 * inch,
             "have spent three days producing.")

# Contact details (right side)
cx = W - M - 2.6 * inch
c.setFillColor(ORANGE); c.setFont("Helvetica-Bold", 9)
c.drawString(cx, band_h - 0.30 * inch, "CONTACT")
c.setFillColor(WHITE); c.setFont("Helvetica", 10)
c.drawString(cx, band_h - 0.48 * inch, "Austin Manoogian")
c.drawString(cx, band_h - 0.63 * inch, "contact@timelesstechs.com")
c.drawString(cx, band_h - 0.78 * inch, "Timeless Technology Solutions")

c.setFillColor(MUTED); c.setFont("Helvetica", 7)
c.drawString(M, 0.18 * inch, "RocketRFP   ·   Confidential   ·   v1.0")

c.showPage()
c.save()
print(f"Wrote {OUT}")
