#!/usr/bin/env python3
"""Generate the Flynn TAM & Stickiness story as a formatted .docx."""

from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

ORANGE = RGBColor(0xFF, 0x45, 0x00)
DARK = RGBColor(0x1A, 0x1A, 0x1A)
GREY = RGBColor(0x55, 0x55, 0x55)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

doc = Document()

# Base styles
normal = doc.styles["Normal"]
normal.font.name = "Calibri"
normal.font.size = Pt(11)
normal.font.color.rgb = DARK


def shade_cell(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hexcolor)
    tcPr.append(shd)


def heading(text, size=16, color=ORANGE, space_before=14, space_after=6):
    p = doc.add_paragraph()
    p.space_before = Pt(space_before)
    run = p.add_run(text)
    run.font.size = Pt(size)
    run.font.bold = True
    run.font.color.rgb = color
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    return p


def body(text, italic=False, color=DARK, size=11, after=6):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.italic = italic
    run.font.color.rgb = color
    run.font.size = Pt(size)
    p.paragraph_format.space_after = Pt(after)
    return p


def bullet(text, bold_lead=None):
    p = doc.add_paragraph(style="List Bullet")
    if bold_lead:
        r = p.add_run(bold_lead)
        r.font.bold = True
        p.add_run(text)
    else:
        p.add_run(text)
    p.paragraph_format.space_after = Pt(3)
    return p


# ---------------------------------------------------------------- Title block
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.LEFT
r = title.add_run("Flynn AI")
r.font.size = Pt(28)
r.font.bold = True
r.font.color.rgb = ORANGE
sub = doc.add_paragraph()
r = sub.add_run("TAM & Stickiness Story")
r.font.size = Pt(18)
r.font.bold = True
r.font.color.rgb = DARK
meta = doc.add_paragraph()
r = meta.add_run("Internal strategy memo  ·  June 2026")
r.font.size = Pt(10)
r.font.color.rgb = GREY

doc.add_paragraph()

# ---------------------------------------------------------------- Thesis
heading("The one-line thesis", size=15)
body(
    "Flynn's retention and TAM do not come from one-off reactive jobs (draft a reply, "
    "make an invoice) — those get forgotten. They come from recurring jobs with a "
    "trigger Flynn owns, where Flynn texts the user first. That proactive cadence turns "
    "Flynn from a tool you remember to open into a habit that pings you. The evidence below "
    "shows there is no shortage of pain; the shortage was in picking the recurring, "
    "proactive jobs that compound into a sticky, expanding-wedge TAM.",
    italic=True,
)

# ---------------------------------------------------------------- Stickiness test
heading("The stickiness test")
body("Score every use case on four axes. The winners hit all four; reactive tools hit only the last.")
bullet(" — does it recur daily or weekly? (one-off = not sticky)", bold_lead="Frequency")
bullet(" — is there an event Flynn can watch and act on without being asked?", bold_lead="Trigger Flynn owns")
bullet(" — does it cost real money or time, repeatedly?", bold_lead="Pain")
bullet(" — can the text + tool stack actually close the loop?", bold_lead="Flynn-doable")

# ---------------------------------------------------------------- Sticky core table
heading("The sticky core — recurring + proactive")
body("Ranked by stickiness. These are the jobs the TAM story should be built on.")

rows = [
    ("Pain point", "Frequency", "The evidence", "Flynn's proactive move"),
    ("Speed-to-lead reply", "Every lead / daily",
     "Leads contacted within 5 min are 21× more likely to convert; 78% buy from whoever replies first; "
     "avg response is 42 hrs and 73% of leads are never contacted.",
     "Lead lands (missed call / SMS / form / DM) → Flynn replies in seconds in their voice, qualifies, books or quotes."),
    ("No-show recovery + reminders", "Daily / weekly",
     "PT no-shows 20–35%, salons ~15%; a solo operator loses $80–200k/yr; SMS reminders cut no-shows up to 90%.",
     "Day before a booking → Flynn texts the client, handles “can we move it?”, rebooks, fills the gap."),
    ("Payment chasing", "Weekly / ongoing",
     "92% of invoices are paid late; 65% of businesses spend 14 hrs/wk chasing; 89% of SMEs say late payments stall growth.",
     "Invoice ages past due → Flynn nudges the operator or chases the client on a cadence."),
    ("Quote follow-up", "Weekly",
     "Cold quotes are the silent revenue leak — most operators never follow up.",
     "Quote sent N days ago, no reply → Flynn pings “follow up the Jones quote?” then does it."),
    ("Receipt / expense capture", "Daily, on the road",
     "Owners spend 5–15 hrs/wk on admin; receipts pile up in the ute.",
     "Snap a photo → parsed, logged to Sheets/Xero → Flynn texts back a screenshot of the finished sheet. (Activation wedge.)"),
    ("Weekly money / admin digest", "Weekly (habit anchor)",
     "Up to 15 hrs/wk on admin scattered across the week.",
     "Sunday/Monday → Flynn texts “this week: 3 unpaid ($2.4k), 2 quotes cold, 4 jobs booked, $310 logged” + one-tap actions."),
]

table = doc.add_table(rows=1, cols=4)
table.alignment = WD_TABLE_ALIGNMENT.CENTER
table.style = "Table Grid"
hdr = table.rows[0].cells
widths = [Inches(1.4), Inches(0.95), Inches(2.7), Inches(2.7)]
for i, text in enumerate(rows[0]):
    hdr[i].text = ""
    p = hdr[i].paragraphs[0]
    r = p.add_run(text)
    r.font.bold = True
    r.font.color.rgb = WHITE
    r.font.size = Pt(10)
    shade_cell(hdr[i], "FF4500")
for row in rows[1:]:
    cells = table.add_row().cells
    for i, text in enumerate(row):
        cells[i].text = ""
        p = cells[i].paragraphs[0]
        r = p.add_run(text)
        r.font.size = Pt(9)
        if i == 0:
            r.font.bold = True
            r.font.color.rgb = ORANGE
for row in table.rows:
    for i, cell in enumerate(row.cells):
        cell.width = widths[i]

# ---------------------------------------------------------------- Episodic
heading("Episodic jobs — good first-value, weak stickiness")
body(
    "Invoice creation, one-off bookings, parts ordering, drafting a single reply. Keep these — "
    "they are excellent activation hooks (the receipt demo). But do not build the TAM story on them: "
    "they are “open when I need it,” not habit."
)

# ---------------------------------------------------------------- TAM
heading("Why this fixes the TAM worry")
body(
    "The breadth is real because the triggers are universal across solo operators, even though the "
    "surface task differs. The same four recurring triggers — lead reply, reminder, invoice chase, "
    "quote chase — appear in every vertical:"
)
bullet("lead reply → quote follow-up → invoice chase → receipts", bold_lead="Tradie:  ")
bullet("lead reply → booking reminder → no-show rebook → package renewal nudge", bold_lead="Salon / PT / clinic:  ")
bullet("lead reply → viewing reminders → listing follow-ups → vendor updates", bold_lead="Real estate:  ")
bullet("lead reply → proposal follow-up → invoice chase → unbilled-hours nudge", bold_lead="Freelancer / consultant:  ")
body(
    "Same triggers, every vertical = the “front office for every solo operator” TAM, and every one is a "
    "weekly recurring reason to keep Flynn around. That is the sticky, expanding-wedge narrative for YC.",
    after=10,
)

# ---------------------------------------------------------------- Risk
heading("The honest risk")
body(
    "The two stickiest jobs — speed-to-lead and no-show recovery — require Flynn to sit in the "
    "customer-facing channel (see incoming leads, message clients), not just the operator's thread. "
    "That is a heavier integration lift than the receipt flow, which needs nothing to demo."
)

# ---------------------------------------------------------------- Ladder
heading("The build ladder")
bullet("receipt → screenshot. Zero friction, instant wow, demos with no login.",
       bold_lead="1. Activation:  ")
bullet("proactive weekly digest + payment / quote chasing. Buildable on the current stack and existing "
       "schedulers; Flynn texts the operator, so no customer-channel access is needed. This is the recurring heartbeat.",
       bold_lead="2. First habit:  ")
bullet("speed-to-lead + no-show recovery. Needs the customer-facing channel — the harder, stickier, "
       "more defensible layer to build toward once the cheaper habit loop proves retention.",
       bold_lead="3. The moat:  ")

heading("Recommendation", size=13)
body(
    "Anchor the near-term sticky story on rung 2 (the digest + chasing loop) — it is buildable now and "
    "genuinely recurring — while pitching rung 3 as the vision that makes Flynn a billion-dollar front "
    "office for every solo operator. Receipts stay the activation hook. The story for YC writes itself: "
    "“here's the recurring habit loop live today, here's the early retention it drives, here's the "
    "defensible customer-channel layer it expands into.”"
)

# ---------------------------------------------------------------- Sources
heading("Sources")
src = [
    "ServiceM8 / ASBFEO — admin-time data (5–15 hrs/wk)",
    "Chaser — chasing payments / 14 hrs/wk; Plooto — unpaid-invoice impact; TradeBrain — late payments & cash flow",
    "Etisia — no-show statistics 2026; Klara — SMS reminders cut no-shows 38%",
    "Kixie — speed-to-lead stats; Verse.ai — 25 speed-to-lead statistics",
    "Wishup — solopreneur VA task breakdown",
]
for s in src:
    p = doc.add_paragraph(s)
    p.paragraph_format.space_after = Pt(2)
    for run in p.runs:
        run.font.size = Pt(9)
        run.font.color.rgb = GREY

out = "/Users/atticus/FlynnAIapp/flynn-demo/Flynn_TAM_Stickiness.docx"
doc.save(out)
print("saved", out)
