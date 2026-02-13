"""
Generate 3 mock RFP response proposals for Timeless Technology Solutions.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY

# ─── Brand colors ──────────────────────────────────────────────────────────────
NAVY   = colors.HexColor('#1A2B4A')
TEAL   = colors.HexColor('#2E7D80')
GOLD   = colors.HexColor('#C8971A')
LIGHT  = colors.HexColor('#F4F6F9')
WHITE  = colors.white
GRAY   = colors.HexColor('#6B7280')
BLACK  = colors.HexColor('#1F2937')


def base_styles():
    s = getSampleStyleSheet()
    return {
        'cover_company': ParagraphStyle('cover_company',
            fontName='Helvetica-Bold', fontSize=22,
            textColor=WHITE, alignment=TA_CENTER, spaceAfter=6),
        'cover_tagline': ParagraphStyle('cover_tagline',
            fontName='Helvetica', fontSize=11,
            textColor=colors.HexColor('#BFD4E0'), alignment=TA_CENTER, spaceAfter=24),
        'cover_title': ParagraphStyle('cover_title',
            fontName='Helvetica-Bold', fontSize=17,
            textColor=GOLD, alignment=TA_CENTER, spaceAfter=8),
        'cover_subtitle': ParagraphStyle('cover_subtitle',
            fontName='Helvetica', fontSize=12,
            textColor=WHITE, alignment=TA_CENTER, spaceAfter=4),
        'cover_meta': ParagraphStyle('cover_meta',
            fontName='Helvetica', fontSize=10,
            textColor=colors.HexColor('#BFD4E0'), alignment=TA_CENTER, spaceAfter=2),
        'section_head': ParagraphStyle('section_head',
            fontName='Helvetica-Bold', fontSize=13,
            textColor=NAVY, spaceBefore=18, spaceAfter=6,
            borderPad=2),
        'subsection_head': ParagraphStyle('subsection_head',
            fontName='Helvetica-Bold', fontSize=11,
            textColor=TEAL, spaceBefore=12, spaceAfter=4),
        'body': ParagraphStyle('body',
            fontName='Helvetica', fontSize=10,
            textColor=BLACK, leading=15, spaceAfter=6, alignment=TA_JUSTIFY),
        'bullet': ParagraphStyle('bullet',
            fontName='Helvetica', fontSize=10,
            textColor=BLACK, leading=14, leftIndent=16,
            bulletIndent=4, spaceAfter=3),
        'table_header': ParagraphStyle('table_header',
            fontName='Helvetica-Bold', fontSize=9,
            textColor=WHITE, alignment=TA_CENTER),
        'table_cell': ParagraphStyle('table_cell',
            fontName='Helvetica', fontSize=9,
            textColor=BLACK),
        'table_cell_bold': ParagraphStyle('table_cell_bold',
            fontName='Helvetica-Bold', fontSize=9,
            textColor=BLACK),
        'footer': ParagraphStyle('footer',
            fontName='Helvetica', fontSize=8,
            textColor=GRAY, alignment=TA_CENTER),
        'confidential': ParagraphStyle('confidential',
            fontName='Helvetica-Oblique', fontSize=8,
            textColor=GRAY, alignment=TA_CENTER),
    }


def clone_style(base_style, **kwargs):
    """Create a new ParagraphStyle based on an existing one with overrides."""
    from reportlab.lib.styles import ParagraphStyle
    attrs = {
        'fontName': base_style.fontName,
        'fontSize': base_style.fontSize,
        'leading': base_style.leading,
        'textColor': base_style.textColor,
        'alignment': base_style.alignment,
        'spaceAfter': base_style.spaceAfter,
        'spaceBefore': base_style.spaceBefore,
        'leftIndent': base_style.leftIndent,
        'bulletIndent': base_style.bulletIndent,
    }
    attrs.update(kwargs)
    return ParagraphStyle('_clone_' + base_style.name, **attrs)


def cover_block(styles, rfp_title, client_name, rfp_number, date, pages):
    """Return a list of flowables for the cover page."""
    elems = []

    # Navy header bar via a 1-row table
    header_data = [[Paragraph('TIMELESS TECHNOLOGY SOLUTIONS', styles['cover_company'])]]
    t = Table(header_data, colWidths=[7.5 * inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY),
        ('TOPPADDING', (0, 0), (-1, -1), 28),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ]))
    elems.append(t)

    tag_data = [[Paragraph('Innovative Solutions. Timeless Results.', styles['cover_tagline'])]]
    t2 = Table(tag_data, colWidths=[7.5 * inch])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 32),
    ]))
    elems.append(t2)

    elems.append(Spacer(1, 0.5 * inch))

    # Gold divider
    elems.append(HRFlowable(width='100%', thickness=3, color=GOLD))
    elems.append(Spacer(1, 0.25 * inch))

    elems.append(Paragraph('PROPOSAL IN RESPONSE TO', clone_style(styles['cover_subtitle'], textColor=GRAY)))
    elems.append(Spacer(1, 0.1 * inch))
    elems.append(Paragraph(rfp_title, styles['cover_title']))
    elems.append(Spacer(1, 0.35 * inch))

    meta = [
        ['Submitted To:', client_name],
        ['RFP Number:', rfp_number],
        ['Date Submitted:', date],
        ['Total Pages:', str(pages)],
        ['Validity Period:', '90 Days from Submission'],
    ]
    mt = Table(meta, colWidths=[2 * inch, 4.5 * inch])
    mt.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (-1, -1), BLACK),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [LIGHT, WHITE]),
        ('LEFTPADDING', (0, 0), (0, -1), 8),
        ('LEFTPADDING', (1, 0), (1, -1), 8),
    ]))
    elems.append(mt)

    elems.append(Spacer(1, 0.35 * inch))
    elems.append(HRFlowable(width='100%', thickness=1, color=TEAL))
    elems.append(Spacer(1, 0.15 * inch))

    contact = (
        '<b>Timeless Technology Solutions, LLC</b><br/>'
        '4821 Commerce Parkway, Suite 310 · Nashville, TN 37203<br/>'
        'Phone: (615) 555-0192 · Email: proposals@timelesstechsolutions.com<br/>'
        'Web: www.timelesstechsolutions.com'
    )
    elems.append(Paragraph(contact, clone_style(styles['confidential'], fontSize=9, textColor=GRAY, alignment=TA_CENTER)))
    elems.append(Spacer(1, 0.1 * inch))
    elems.append(Paragraph(
        'CONFIDENTIAL — This document contains proprietary information intended solely for the addressee.',
        styles['confidential']))

    elems.append(PageBreak())
    return elems


def section(styles, title):
    return [
        HRFlowable(width='100%', thickness=1.5, color=TEAL),
        Paragraph(title.upper(), styles['section_head']),
    ]


def subsection(styles, title):
    return [Paragraph(title, styles['subsection_head'])]


def body(styles, text):
    return [Paragraph(text, styles['body'])]


def bullets(styles, items):
    return [Paragraph(f'• {item}', styles['bullet']) for item in items]


def price_table(styles, rows, total):
    header = ['Item', 'Description', 'Hours', 'Rate', 'Cost']
    data = [[Paragraph(h, styles['table_header']) for h in header]]
    for row in rows:
        data.append([
            Paragraph(row[0], styles['table_cell_bold']),
            Paragraph(row[1], styles['table_cell']),
            Paragraph(row[2], styles['table_cell']),
            Paragraph(row[3], styles['table_cell']),
            Paragraph(row[4], styles['table_cell_bold']),
        ])
    data.append([
        Paragraph('', styles['table_cell']),
        Paragraph('', styles['table_cell']),
        Paragraph('', styles['table_cell']),
        Paragraph('<b>TOTAL</b>', clone_style(styles['table_header'], textColor=NAVY, alignment=TA_RIGHT)),
        Paragraph(f'<b>{total}</b>', clone_style(styles['table_header'], textColor=NAVY)),
    ])
    t = Table(data, colWidths=[1.1*inch, 2.8*inch, 0.7*inch, 0.9*inch, 1.0*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('BACKGROUND', (0, -1), (-1, -1), LIGHT),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [WHITE, colors.HexColor('#F9FAFB')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    return [t]


def milestone_table(styles, rows):
    header = ['Phase', 'Deliverable', 'Duration', 'Target Date']
    data = [[Paragraph(h, styles['table_header']) for h in header]]
    for row in rows:
        data.append([Paragraph(r, styles['table_cell']) for r in row])
    t = Table(data, colWidths=[1.3*inch, 2.9*inch, 1.1*inch, 1.2*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, colors.HexColor('#F9FAFB')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    return [t]


# ══════════════════════════════════════════════════════════════════════════════
# PROPOSAL 1 — Customer Portal & CRM for Lakewood Home Services
# ══════════════════════════════════════════════════════════════════════════════
def proposal_1(path):
    doc = SimpleDocTemplate(path, pagesize=letter,
                            leftMargin=0.85*inch, rightMargin=0.85*inch,
                            topMargin=0.75*inch, bottomMargin=0.75*inch)
    S = base_styles()
    elems = []

    elems += cover_block(S,
        rfp_title='Customer Portal & Field Service Management System',
        client_name='Lakewood Home Services, Inc.',
        rfp_number='LHS-2024-011',
        date='March 14, 2024',
        pages=12)

    # ── Executive Summary ──────────────────────────────────────────────────
    elems += section(S, '1. Executive Summary')
    elems += body(S,
        'Timeless Technology Solutions (TTS) is pleased to submit this proposal in response to '
        'Lakewood Home Services RFP No. LHS-2024-011 for a Customer Portal and Field Service '
        'Management System. TTS brings over twelve years of experience delivering web-based '
        'platforms for service-industry clients, with deep expertise in scheduling, dispatch, '
        'and customer self-service solutions.')
    elems += body(S,
        'We understand that Lakewood Home Services requires a unified platform allowing '
        'homeowners to schedule appointments, track technician arrival, view service history, '
        'and pay invoices online—while giving field technicians real-time job details via a '
        'mobile application and dispatchers a live scheduling board.')
    elems += body(S,
        'TTS proposes a <b>React/Next.js customer portal</b> backed by a <b>Node.js REST API</b> '
        'and <b>PostgreSQL</b> database, with a progressive-web-app (PWA) for field technicians. '
        'The engagement will be delivered over <b>28 weeks</b> at a total fixed price of '
        '<b>$187,500</b>, inclusive of all design, development, testing, training, and '
        'first-year hosting support.')

    # ── Company Qualifications ─────────────────────────────────────────────
    elems += section(S, '2. Company Qualifications')
    elems += body(S,
        'Timeless Technology Solutions, LLC was founded in 2012 and is headquartered in '
        'Nashville, Tennessee. We are a certified Minority Business Enterprise (MBE) with '
        '47 full-time employees including software engineers, UX designers, QA analysts, '
        'and project managers. Our ISO 9001:2015-certified quality management system governs '
        'every engagement.')

    elems += subsection(S, 'Relevant Project Experience')
    exp = [
        ('BlueSky HVAC – Service Dispatch Portal (2023)',
         'Delivered a scheduling and dispatch platform for a 120-technician HVAC company '
         'serving the Southeast US. System processes 1,400+ work orders per week.'),
        ('Premier Pest Control – Customer Self-Service (2022)',
         'Built a React-based portal enabling customers to book, reschedule, and pay online. '
         'Reduced call-center volume by 31% within six months of launch.'),
        ('Riverstone Landscaping – Mobile Field App (2023)',
         'Developed a PWA for 60 field crews with offline capability, GPS check-in/out, '
         'photo capture, and digital signatures for service confirmation.'),
    ]
    for title, desc in exp:
        elems += [Paragraph(f'<b>{title}</b>', S['bullet']),
                  Paragraph(desc, clone_style(S['bullet'], leftIndent=28))]
        elems.append(Spacer(1, 4))

    # ── Technical Approach ─────────────────────────────────────────────────
    elems += section(S, '3. Technical Approach')
    elems += body(S,
        'TTS will employ an Agile delivery model with two-week sprints, weekly client '
        'demos, and a shared project management board accessible to Lakewood stakeholders '
        'throughout the engagement.')

    elems += subsection(S, 'Architecture Overview')
    elems += body(S,
        'The solution is composed of three integrated layers:')
    elems += bullets(S, [
        '<b>Customer Portal (Web):</b> Next.js 14 with server-side rendering for SEO and '
        'performance; Tailwind CSS for responsive design; Stripe for payment processing.',
        '<b>Dispatcher Dashboard:</b> React SPA with drag-and-drop scheduling board (FullCalendar), '
        'real-time technician location updates via WebSockets, and role-based access control.',
        '<b>Technician PWA:</b> Installable on iOS/Android; offline-capable job queue with '
        'background sync; camera API for photo capture; e-signature capture.',
        '<b>Backend API:</b> Node.js 20 + Express with OpenAPI 3.0 documentation; JWT '
        'authentication; rate limiting and input validation via Zod.',
        '<b>Database:</b> PostgreSQL 16 with PostGIS extension for technician geolocation; '
        'Redis for session cache and real-time pub/sub.',
        '<b>Infrastructure:</b> AWS (ECS Fargate + RDS Aurora); CloudFront CDN; '
        'CI/CD via GitHub Actions; automated backups with 30-day retention.',
    ])

    elems += subsection(S, 'Security & Compliance')
    elems += bullets(S, [
        'TLS 1.3 enforced on all endpoints; HSTS and CSP headers configured.',
        'PCI-DSS SAQ A compliance via Stripe-hosted checkout; no card data stored.',
        'RBAC with least-privilege principle; audit log of all data mutations.',
        'Annual third-party penetration test included in Year 1 support.',
    ])

    # ── Project Timeline ───────────────────────────────────────────────────
    elems += section(S, '4. Project Schedule')
    elems += milestone_table(S, [
        ['Phase 1', 'Discovery, requirements finalization, UX wireframes', '3 weeks', 'Week 3'],
        ['Phase 2', 'Database schema, API skeleton, auth system', '4 weeks', 'Week 7'],
        ['Phase 3', 'Customer portal — booking & account management', '5 weeks', 'Week 12'],
        ['Phase 4', 'Dispatcher dashboard & scheduling board', '5 weeks', 'Week 17'],
        ['Phase 5', 'Technician PWA & offline sync', '4 weeks', 'Week 21'],
        ['Phase 6', 'Payment integration, notifications, invoicing', '3 weeks', 'Week 24'],
        ['Phase 7', 'UAT, performance testing, staff training', '2 weeks', 'Week 26'],
        ['Phase 8', 'Production deployment & go-live support', '2 weeks', 'Week 28'],
    ])

    # ── Pricing ────────────────────────────────────────────────────────────
    elems += section(S, '5. Pricing')
    elems += price_table(S, [
        ['Discovery', 'Requirements workshops, UX research, wireframes', '120', '$125', '$15,000'],
        ['UX/UI Design', 'High-fidelity mockups, design system, prototypes', '160', '$115', '$18,400'],
        ['Backend Dev', 'REST API, database, authentication, integrations', '480', '$140', '$67,200'],
        ['Frontend Dev', 'Customer portal, dispatcher dashboard', '440', '$130', '$57,200'],
        ['PWA Dev', 'Technician mobile app with offline capability', '200', '$130', '$26,000'],
        ['QA & Testing', 'Unit, integration, E2E, load, security testing', '120', '$110', '$13,200'],
        ['Training', 'Admin, dispatcher, and technician training sessions', '40', '$125', '$5,000'],
        ['Year 1 Support', 'Hosting, monitoring, bug fixes, minor enhancements', 'N/A', 'Fixed', '$15,000'],
    ], '$216,000')

    elems.append(Spacer(1, 6))
    elems += body(S,
        '<b>Payment Schedule:</b> 20% upon contract execution ($43,200); '
        '20% at Phase 2 completion; 30% at Phase 5 completion; '
        '20% at UAT sign-off; 10% at go-live ($21,600).')
    elems += body(S,
        '<i>Note: The above pricing is fixed for the defined scope. Change requests outside '
        'the agreed scope will be estimated separately and require written approval.</i>')

    # ── Team ───────────────────────────────────────────────────────────────
    elems += section(S, '6. Proposed Team')
    team = [
        ['Role', 'Name', 'Experience'],
        ['Engagement Manager', 'Marcus Webb', '14 yrs — PMP certified, 20+ delivered projects'],
        ['Solution Architect', 'Dr. Priya Nair', '11 yrs — AWS Solutions Architect Pro'],
        ['Lead Backend Engineer', 'Damon Carter', '9 yrs — Node.js, PostgreSQL, microservices'],
        ['Lead Frontend Engineer', 'Sofia Mendoza', '8 yrs — React, Next.js, PWA specialist'],
        ['UX Designer', 'Kenji Watanabe', '7 yrs — Figma, user research, accessibility'],
        ['QA Lead', 'Amber Holloway', '6 yrs — Playwright, k6, OWASP testing'],
    ]
    t = Table(team, colWidths=[1.8*inch, 1.7*inch, 3.5*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elems.append(t)

    # ── Terms ──────────────────────────────────────────────────────────────
    elems += section(S, '7. Terms & Conditions')
    elems += bullets(S, [
        'This proposal is valid for 90 days from the date of submission.',
        'Intellectual property developed under this engagement transfers to Lakewood Home '
        'Services upon final payment.',
        'TTS maintains a $2M general liability and $2M professional liability insurance policy.',
        'Disputes shall be resolved under the laws of the State of Tennessee.',
        'TTS will execute a mutual NDA prior to project commencement.',
    ])

    elems.append(Spacer(1, 0.25 * inch))
    elems += [HRFlowable(width='100%', thickness=1, color=TEAL)]
    elems += body(S,
        'We appreciate the opportunity to respond to this RFP and look forward to a '
        'productive partnership with Lakewood Home Services. Please direct questions to '
        '<b>proposals@timelesstechsolutions.com</b> or call <b>(615) 555-0192</b>.')

    doc.build(elems)
    print(f'  Created: {path}')


# ══════════════════════════════════════════════════════════════════════════════
# PROPOSAL 2 — Inventory & Warehouse Management for Meridian Distributors
# ══════════════════════════════════════════════════════════════════════════════
def proposal_2(path):
    doc = SimpleDocTemplate(path, pagesize=letter,
                            leftMargin=0.85*inch, rightMargin=0.85*inch,
                            topMargin=0.75*inch, bottomMargin=0.75*inch)
    S = base_styles()
    elems = []

    elems += cover_block(S,
        rfp_title='Inventory & Warehouse Management System',
        client_name='Meridian Distributors, LLC',
        rfp_number='MDL-2023-047',
        date='October 9, 2023',
        pages=13)

    elems += section(S, '1. Executive Summary')
    elems += body(S,
        'Timeless Technology Solutions is pleased to respond to Meridian Distributors RFP '
        'No. MDL-2023-047 for a custom Inventory and Warehouse Management System (IWMS). '
        'Meridian operates three distribution centers across Kentucky and Tennessee, '
        'processing over 8,000 SKUs and 350 outbound shipments daily. The current system is '
        'a legacy desktop application from 2009 that lacks barcode scanning, real-time '
        'stock visibility, and integration with Meridian\'s QuickBooks accounting software.')
    elems += body(S,
        'TTS proposes a cloud-based IWMS built on a <b>Python/FastAPI backend</b> with a '
        '<b>React dashboard</b>, native barcode-scanner support via a companion Android/iOS app, '
        'and bi-directional QuickBooks Online integration. Total project cost is '
        '<b>$142,000</b> delivered over <b>22 weeks</b>.')

    elems += section(S, '2. Understanding of Requirements')
    elems += body(S, 'Based on the RFP and our discovery call on September 28, 2023, TTS '
        'understands the primary requirements to be:')
    elems += bullets(S, [
        'Real-time inventory tracking across all three warehouse locations with sub-location '
        '(aisle/bay/shelf) granularity.',
        'Barcode and QR-code scanning for inbound receipts, put-away, picking, and outbound '
        'shipping confirmation.',
        'Automated reorder-point alerts with configurable lead-time and safety-stock rules '
        'per SKU and supplier.',
        'Integration with QuickBooks Online for purchase order sync, cost-of-goods '
        'accounting, and accounts-payable matching.',
        'Carrier label printing (UPS, FedEx, LTL) and shipment tracking lookup.',
        'Role-based access: Warehouse Associate, Supervisor, Purchasing, Accounting, Admin.',
        'Reporting: daily stock valuation, slow-mover analysis, shrinkage/adjustment log, '
        'fulfillment accuracy rate.',
        'Data migration from the legacy system (estimated 8,000 active SKUs, 5 years of '
        'transaction history).',
    ])

    elems += section(S, '3. Technical Approach')
    elems += subsection(S, 'System Architecture')
    elems += bullets(S, [
        '<b>Backend:</b> Python 3.12 + FastAPI; SQLAlchemy ORM; Alembic migrations; '
        'Celery + Redis for async tasks (label generation, reorder alerts, QuickBooks sync).',
        '<b>Database:</b> PostgreSQL 16 with partitioned transaction tables for performance '
        'at scale; full-text search via pg_tsvector for SKU/product lookup.',
        '<b>Web Dashboard:</b> React 18 + Vite; TanStack Table for grid-heavy views; '
        'Recharts for inventory analytics; print-optimized CSS for pick lists and manifests.',
        '<b>Mobile Scanner App:</b> React Native (iOS + Android); camera-based barcode '
        'scanner via Expo; offline queue with background sync for warehouse dead zones.',
        '<b>Integrations:</b> QuickBooks Online REST API (OAuth 2.0); UPS/FedEx REST APIs; '
        'webhook receiver for carrier status events.',
        '<b>Infrastructure:</b> AWS (ECS + RDS PostgreSQL Multi-AZ); S3 for document '
        'storage; CloudWatch dashboards; automated nightly backup with 90-day retention.',
    ])

    elems += subsection(S, 'Data Migration Approach')
    elems += body(S,
        'TTS will execute a phased data migration strategy to minimize business disruption:')
    elems += bullets(S, [
        '<b>Phase 1 — Extract:</b> Export all master data (SKUs, suppliers, locations, '
        'customers) from the legacy system and cleanse via automated validation scripts.',
        '<b>Phase 2 — Transform:</b> Map legacy data to the new schema; flag exceptions '
        'for manual review; produce a reconciliation report for Meridian sign-off.',
        '<b>Phase 3 — Load:</b> Import cleansed master data; import last 5 years of '
        'transaction history; perform parallel-run balance reconciliation.',
        '<b>Phase 4 — Cutover:</b> Freeze legacy system; final delta migration; '
        'go/no-go validation checklist before live traffic switches.',
    ])

    elems += section(S, '4. Project Schedule')
    elems += milestone_table(S, [
        ['Phase 1', 'Discovery, system design, data-model finalization', '2 weeks', 'Week 2'],
        ['Phase 2', 'Backend API & database — master data CRUD', '4 weeks', 'Week 6'],
        ['Phase 3', 'Inventory transactions: receive, put-away, pick, ship', '4 weeks', 'Week 10'],
        ['Phase 4', 'React dashboard — inventory views and reporting', '3 weeks', 'Week 13'],
        ['Phase 5', 'Mobile scanner app (iOS + Android)', '3 weeks', 'Week 16'],
        ['Phase 6', 'QuickBooks & carrier integrations', '2 weeks', 'Week 18'],
        ['Phase 7', 'Data migration (extract, transform, load)', '2 weeks', 'Week 20'],
        ['Phase 8', 'UAT, load testing, training, go-live', '2 weeks', 'Week 22'],
    ])

    elems += section(S, '5. Pricing')
    elems += price_table(S, [
        ['Discovery', 'Requirements, data audit, system design', '80', '$125', '$10,000'],
        ['Backend Dev', 'FastAPI, database, async workers, integrations', '400', '$140', '$56,000'],
        ['Frontend Dev', 'React dashboard, reporting, print layouts', '280', '$130', '$36,400'],
        ['Mobile App', 'React Native scanner app (iOS + Android)', '160', '$130', '$20,800'],
        ['Data Migration', 'Extract, transform, load, reconciliation', '80', '$125', '$10,000'],
        ['QA & Testing', 'Functional, integration, load, UAT support', '80', '$110', '$8,800'],
        ['Training', 'Warehouse, supervisor, and admin training', '32', '$125', '$4,000'],
        ['Year 1 Support', 'Hosting, monitoring, patches, minor fixes', 'N/A', 'Fixed', '$12,000'],
    ], '$158,000')

    elems += body(S,
        '<b>Payment Schedule:</b> 25% on contract execution ($39,500); '
        '25% at Phase 4 completion; 25% at Phase 7 completion; '
        '25% at production go-live.')

    elems += section(S, '6. Proposed Team')
    team = [
        ['Role', 'Name', 'Relevant Experience'],
        ['Project Manager', 'Tanya Osei', '10 yrs — Agile/Scrum, warehouse tech projects'],
        ['Solution Architect', 'Dr. Priya Nair', '11 yrs — AWS, distributed systems'],
        ['Lead Backend Engineer', 'James Kowalski', '10 yrs — Python, FastAPI, PostgreSQL'],
        ['Frontend Engineer', 'Hana Sato', '7 yrs — React, data-heavy enterprise UIs'],
        ['Mobile Engineer', 'Luis Rivera', '6 yrs — React Native, barcode/RFID integrations'],
        ['QA Engineer', 'Amber Holloway', '6 yrs — API testing, automated regression'],
        ['Data Migration Lead', 'Kevin Tran', '8 yrs — ETL pipelines, data quality'],
    ]
    t = Table(team, colWidths=[1.8*inch, 1.7*inch, 3.5*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elems.append(t)

    elems += section(S, '7. Terms & Conditions')
    elems += bullets(S, [
        'Proposal valid for 90 days from submission date.',
        'Source code and all work product become property of Meridian Distributors upon '
        'final payment.',
        'TTS carries $2M general liability, $2M professional liability, and $1M cyber '
        'liability insurance coverage.',
        'Any change in scope will be documented via a Change Order and requires written '
        'authorization before additional work commences.',
        'Governing law: State of Tennessee.',
    ])

    elems.append(Spacer(1, 0.2*inch))
    elems += [HRFlowable(width='100%', thickness=1, color=TEAL)]
    elems += body(S,
        'TTS is excited about the opportunity to modernize Meridian\'s warehouse operations. '
        'We are confident our team has the depth and experience to deliver a reliable, '
        'scalable system that will serve Meridian for years to come. Please contact '
        '<b>proposals@timelesstechsolutions.com</b> with any questions.')

    doc.build(elems)
    print(f'  Created: {path}')


# ══════════════════════════════════════════════════════════════════════════════
# PROPOSAL 3 — Grant Management Platform for Cumberland County Government
# ══════════════════════════════════════════════════════════════════════════════
def proposal_3(path):
    doc = SimpleDocTemplate(path, pagesize=letter,
                            leftMargin=0.85*inch, rightMargin=0.85*inch,
                            topMargin=0.75*inch, bottomMargin=0.75*inch)
    S = base_styles()
    elems = []

    elems += cover_block(S,
        rfp_title='Grants Management & Compliance Tracking System',
        client_name='Cumberland County Office of Budget & Finance',
        rfp_number='CC-OBF-2024-003',
        date='January 22, 2024',
        pages=14)

    elems += section(S, '1. Executive Summary')
    elems += body(S,
        'Timeless Technology Solutions respectfully submits this proposal in response to '
        'Cumberland County RFP No. CC-OBF-2024-003 for a Grants Management and Compliance '
        'Tracking System. The County currently manages 73 active federal and state grants '
        'across 11 departments using a combination of Excel spreadsheets and shared network '
        'drives, creating audit risk, version-control issues, and manual reporting burdens '
        'estimated at 320 staff-hours per year.')
    elems += body(S,
        'TTS proposes a <b>purpose-built, web-based grants management platform</b> that '
        'centralizes the full grant lifecycle—from application and award through '
        'expenditure tracking, drawdown requests, programmatic reporting, and closeout. '
        'The system will integrate with the County\'s existing Tyler Munis ERP for '
        'real-time budget and expenditure data. Total investment: <b>$98,500</b> over '
        '<b>20 weeks</b>.')

    elems += section(S, '2. Understanding of Requirements')
    elems += body(S,
        'Through our review of the RFP and the County\'s supplemental Q&A document, '
        'TTS has identified the following core requirements:')
    elems += bullets(S, [
        '<b>Grant Lifecycle Management:</b> Track each grant from pre-award through '
        'closeout with configurable status workflows and automated deadline alerts.',
        '<b>Budget & Expenditure Tracking:</b> Maintain award budgets by cost category; '
        'consume actuals from Tyler Munis via nightly API sync; display variance and '
        'burn-rate dashboards.',
        '<b>Drawdown & Reimbursement Requests:</b> Guided forms for federal '
        '(e.g., ACM, FEMA Grants Portal) and state payment requests with document '
        'attachment and approval routing.',
        '<b>Compliance Calendar:</b> Auto-populate reporting due dates from award documents; '
        'email reminders to department grant coordinators and supervisors.',
        '<b>Document Repository:</b> Version-controlled storage for award letters, '
        'amendments, sub-recipient agreements, audit documentation, and correspondence.',
        '<b>Sub-Recipient Management:</b> Track sub-awards, monitor programmatic and '
        'fiscal reports, and flag monitoring visit findings.',
        '<b>Federal Reporting:</b> Pre-built templates for SF-425 Financial Status '
        'Report, SF-PPR Performance Progress Report, and OMB Uniform Guidance compliance '
        'checklists.',
        '<b>Audit Trail:</b> Immutable log of all record changes with user, timestamp, '
        'and before/after values for Single Audit readiness.',
        '<b>Role-Based Access:</b> Grant Coordinator, Department Director, '
        'Grants Administrator (OBF), Finance Director, Auditor (read-only).',
    ])

    elems += section(S, '3. Technical Approach')
    elems += subsection(S, 'Architecture')
    elems += bullets(S, [
        '<b>Frontend:</b> Next.js 14 with React Server Components for performance; '
        'Tailwind CSS; PDF generation via react-pdf for federal form templates.',
        '<b>Backend:</b> Node.js 20 + tRPC for type-safe API; Drizzle ORM; '
        'comprehensive Zod schema validation.',
        '<b>Database:</b> PostgreSQL 16; append-only audit_log table; '
        'full-text search on grant titles, descriptions, and documents.',
        '<b>Tyler Munis Integration:</b> Nightly import of GL actuals via '
        'Munis REST API; mapping table for grant cost-center codes to grant records; '
        'reconciliation exception report for Finance review.',
        '<b>Document Storage:</b> AWS S3 with versioning enabled; '
        'virus scanning via ClamAV on upload; 7-year retention policy.',
        '<b>Authentication:</b> SAML 2.0 SSO via Microsoft Entra ID '
        '(Active Directory); MFA required for all users.',
        '<b>Infrastructure:</b> AWS GovCloud-adjacent (us-east-1); '
        'SOC 2 Type II hosting; AES-256 encryption at rest and in transit; '
        'automated daily backups.',
    ])

    elems += subsection(S, 'Compliance & Security')
    elems += bullets(S, [
        'WCAG 2.1 Level AA accessibility — meets Section 508 requirements.',
        'NIST SP 800-171 security controls documented and testable.',
        'All sensitive PII fields encrypted at the application layer.',
        'Penetration test by independent third party prior to go-live.',
        'FedRAMP-ready architecture documentation provided as a deliverable.',
    ])

    elems += section(S, '4. Project Schedule')
    elems += milestone_table(S, [
        ['Phase 1', 'Discovery, process mapping, data modeling, SSO config', '3 weeks', 'Week 3'],
        ['Phase 2', 'Grant master data, award management, document repository', '4 weeks', 'Week 7'],
        ['Phase 3', 'Budget tracking, Munis integration, variance dashboards', '3 weeks', 'Week 10'],
        ['Phase 4', 'Compliance calendar, deadline alerts, email notifications', '2 weeks', 'Week 12'],
        ['Phase 5', 'Drawdown/reimbursement request workflows + approval routing', '3 weeks', 'Week 15'],
        ['Phase 6', 'Sub-recipient management, federal report templates', '2 weeks', 'Week 17'],
        ['Phase 7', 'Audit trail, role-based access, security hardening', '1 week', 'Week 18'],
        ['Phase 8', 'UAT with OBF staff, remediation, training, go-live', '2 weeks', 'Week 20'],
    ])

    elems += section(S, '5. Pricing')
    elems += price_table(S, [
        ['Discovery', 'Process mapping, UX research, system design', '80', '$125', '$10,000'],
        ['Backend Dev', 'API, database, integrations, audit logging', '320', '$140', '$44,800'],
        ['Frontend Dev', 'Next.js app, dashboards, federal form templates', '240', '$130', '$31,200'],
        ['Security', 'SSO, encryption, pen-test remediation, 508 audit', '60', '$150', '$9,000'],
        ['QA & Testing', 'Functional, integration, security, accessibility', '60', '$110', '$6,600'],
        ['Training', 'Grant coordinators, admins, finance staff', '24', '$125', '$3,000'],
        ['Year 1 Support', 'Hosting, monitoring, compliance updates', 'N/A', 'Fixed', '$10,000'],
    ], '$114,600')

    elems += body(S,
        '<b>Payment Schedule:</b> 25% on contract execution ($28,650); '
        '25% at Phase 3 completion; 25% at Phase 6 completion; '
        '25% at production go-live.')
    elems += body(S,
        '<b>Optional Add-On — Data Migration from Excel:</b> TTS can migrate existing '
        'grant records from the County\'s current spreadsheets. Estimated cost: '
        '<b>$8,500</b> (lump sum). Recommend as a parallel workstream during Phase 1–2.')

    elems += section(S, '6. Proposed Team')
    team = [
        ['Role', 'Name', 'Relevant Experience'],
        ['Engagement Manager', 'Tanya Osei', '10 yrs — PMP, government IT projects'],
        ['Solution Architect', 'Dr. Priya Nair', '11 yrs — GovCloud, compliance systems'],
        ['Lead Full-Stack Eng.', 'Damon Carter', '9 yrs — Next.js, Node.js, ERP integrations'],
        ['Frontend Engineer', 'Sofia Mendoza', '8 yrs — React, accessible UI, PDF generation'],
        ['Security Engineer', 'Marcus Webb', '14 yrs — NIST, FedRAMP, pen testing'],
        ['QA Engineer', 'Amber Holloway', '6 yrs — Section 508, WCAG, regression testing'],
    ]
    t = Table(team, colWidths=[1.8*inch, 1.7*inch, 3.5*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elems.append(t)

    elems += section(S, '7. References')
    elems += body(S, 'The following references are provided and available upon request:')
    refs = [
        ('Metro Nashville Office of Grants Management', 'Delivered a grants tracking '
         'system covering 58 active awards for Metro Nashville in 2022. Contact: '
         'Director of Grants, (615) 555-0211.'),
        ('Wilson County Finance Department', 'Implemented a federal compliance tracking '
         'module integrated with Tyler MUNIS in 2021. Contact: Finance Director, '
         '(615) 555-0388.'),
        ('Tennessee State Library & Archives (TSLA)', 'Built a LSTA grant reporting '
         'platform for IMLS compliance reporting in 2023. Contact: Grants Coordinator, '
         '(615) 555-0174.'),
    ]
    for name, detail in refs:
        elems.append(Paragraph(f'<b>{name}</b>', S['bullet']))
        elems.append(Paragraph(detail, clone_style(S['bullet'], leftIndent=28)))
        elems.append(Spacer(1, 4))

    elems += section(S, '8. Terms & Conditions')
    elems += bullets(S, [
        'Proposal valid for 90 days from submission date.',
        'All work product becomes property of Cumberland County upon final payment.',
        'TTS maintains $2M general liability, $2M professional liability, and $1M '
        'cyber liability insurance. Certificates provided upon request.',
        'TTS will comply with all applicable Tennessee public records laws regarding '
        'County data.',
        'Governing law: State of Tennessee; venue: Cumberland County, TN.',
    ])

    elems.append(Spacer(1, 0.2*inch))
    elems += [HRFlowable(width='100%', thickness=1, color=TEAL)]
    elems += body(S,
        'TTS has a strong track record serving Tennessee government entities and '
        'understands the compliance rigor that federal grant management demands. We are '
        'confident this platform will transform the County\'s grant operations and reduce '
        'audit risk substantially. Please direct all questions to '
        '<b>proposals@timelesstechsolutions.com</b> or (615) 555-0192.')

    doc.build(elems)
    print(f'  Created: {path}')


if __name__ == '__main__':
    base = '/home/backstage440/RFP-automator/mock-proposals'
    proposal_1(f'{base}/TTS-Proposal-LHS-2024-011-Customer-Portal.pdf')
    proposal_2(f'{base}/TTS-Proposal-MDL-2023-047-Inventory-WMS.pdf')
    proposal_3(f'{base}/TTS-Proposal-CC-OBF-2024-003-Grants-Management.pdf')
    print('Done.')
