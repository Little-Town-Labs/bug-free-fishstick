# RFP Automator — Quick Start Guide

## What Is This?

RFP Automator helps your team respond to RFPs (Requests for Proposal) faster using AI. Upload an RFP document, and the system extracts questions, generates draft responses using your company's knowledge base, and lets you review/edit before exporting a completed document.

**Key benefits:** Reduce manual RFP response time by 60-80% while maintaining accuracy and brand voice.

---

## Getting Started

### 1. Sign In

Go to the app URL and sign in (or sign up). You'll land on the **Dashboard**, which shows your RFP pipeline at a glance — total RFPs, in-progress, and completed.

### 2. Initial Setup (Admin Only)

Before generating proposals, configure these settings under **Settings** in the left sidebar:

| Setting | Path | What to Configure |
|---------|------|-------------------|
| **Company Profile** | Settings → Company Profile | Company name, description, industry — this context feeds into AI-generated proposals |
| **LLM Configuration** | Settings → LLM Configuration | Select your AI provider (Claude, GPT, or Azure OpenAI) and enter the API key |
| **Rate Card** | Settings → Rate Card | Define hourly rates by role, blended rates, and currency — used for pricing in proposals |
| **Proposal Templates** | Settings → Proposal Templates | Create reusable sections (cover letter, assumptions, payment terms, legal clauses) that get included in generated proposals |
| **Users** | Settings → Users | Invite team members via email and assign roles (Admin or Member) |

**Optional integrations** (Settings → Integrations):
- **Slack** — Get notifications when RFPs are assigned, approved, or closed
- **HubSpot / Salesforce** — Sync RFP outcomes to your CRM automatically

### 3. Build Your Knowledge Base

The AI generates better proposals when it has more context about your company. Upload documents in two places:

- **Company Knowledge** (`Knowledge` in sidebar) — Organization-wide docs like past RFP responses, case studies, certifications, and company documentation
- **Customer Knowledge** (`Customers` → select customer → Knowledge Base tab) — Customer-specific documents for personalized proposals

Supported formats: **PDF** and **DOCX**. The system automatically extracts text and creates searchable embeddings.

---

## Core Workflow: RFP → Proposal

### Step 1: Create an RFP

1. Click **New RFP** on the Dashboard (or navigate to RFPs in the sidebar)
2. Enter the RFP name and select the customer
3. Upload the RFP document (drag-and-drop or file picker)
4. Review and submit

The system processes the document in the background — extracting questions, classifying the RFP type and complexity, and identifying industry tags.

### Step 2: Generate a Proposal

1. Open the RFP from the dashboard and click **Generate Proposal**
2. The system creates a draft and presents **clarifying questions** — these are AI-generated questions about your specific context for this RFP
3. Answer the questions (the more detail, the better the output)
4. The system generates the proposal in the background using:
   - Your answers to the clarifying questions
   - Relevant knowledge base entries (found via semantic search)
   - Your rate card for pricing
   - Company profile for context
   - Matching proposal templates
5. Once generation completes, you'll see the proposal in a **Markdown editor**

### Step 3: Review & Export

- **Edit** the proposal directly in the editor
- Check the **Coverage Report** panel to see which RFP requirements are addressed and which need attention
- **Save** your changes at any time
- **Export** as Markdown, or download the completed document

### Step 4: Track Outcomes

After submitting the RFP response, come back and mark the outcome (Won / Lost / Cancelled) on the RFP detail page. This data feeds into analytics and helps the system learn over time.

---

## Managing Customers

Navigate to **Customers** in the sidebar to:

- **Add a customer** — Click "New Customer" and fill in the name and description
- **Configure customer settings** — On the customer detail page, go to the Settings tab to set preferred tone (Formal / Casual / Technical), industry context, and custom AI instructions
- **Upload customer-specific knowledge** — On the Knowledge Base tab, upload documents that are specific to this customer relationship

---

## Content Library

The **Content Library** (in the sidebar) stores reusable content snippets — standard paragraphs, boilerplate sections, or frequently used responses. These are available to the AI during proposal generation.

---

## Analytics (Admin Only)

The **Analytics** dashboard shows:
- RFP volume over time
- Win/loss breakdown
- Top contributors on the team

---

## User Roles

| Capability | Admin | Member |
|------------|-------|--------|
| Create / edit / delete RFPs | Yes | Yes |
| Generate proposals | Yes | Yes |
| Manage customers & knowledge | Yes | Yes |
| Configure settings (LLM, rate card, templates, integrations) | Yes | No |
| Manage users & invite team members | Yes | No |
| View analytics | Yes | No |

---

## Tips

- **Better knowledge = better proposals.** Upload as many relevant documents as possible — past winning proposals are especially valuable.
- **Answer clarifying questions thoroughly.** The AI uses your answers to tailor the proposal to the specific RFP context.
- **Use customer-specific settings.** Setting the preferred tone and custom instructions per customer improves output quality.
- **Check the coverage report.** It highlights gaps where the AI couldn't find relevant content to address an RFP requirement.
- **Track outcomes.** Marking RFPs as won/lost helps the analytics dashboard and improves future recommendations.
