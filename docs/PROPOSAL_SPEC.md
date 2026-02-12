# RFP AUTOMATOR - TECHNICAL SPECIFICATION PROPOSAL

**Date:** January 29, 2026
**Version:** 2.0
**Status:** Revised Proposal (Corporate & Public Sector Focus)

================================================================================
1. EXECUTIVE SUMMARY
================================================================================

RFP Automator is an AI-native platform designed for organizations—ranging from 
healthcare corporations and engineering firms to professional services—that 
respond to complex Requests for Proposals (RFPs) from both government and 
corporate entities. 

The platform solves the "Manual Entry Tax" by automating two critical workflows:

1. RFP INTAKE LOOP: Extracts and structures requirements from PDFs, Word docs, 
   CSVs, or Web Portals.
2. PROPOSAL GENERATION LOOP: Creates context-aware responses via a side-by-side 
   "Drafting Canvas" and an integrated AI Chat Assistant.

KEY VALUE PROPOSITIONS:
* SECTOR AGNOSTIC: Handles city/state bids, federal contracts, and private 
  corporate vendor applications.
* DUAL-OUTPUT STRATEGY: Auto-completes original documents (PDF/Word) while 
  providing a high-speed interface for web-portal copy-pasting.
* HUMAN-IN-THE-LOOP: Features a drafting canvas with a pinned AI Chat Assistant 
  connected to the user's private Knowledge Base.

================================================================================
2. BUSINESS PROBLEM & USE CASES
================================================================================

Target customers (Healthcare, Engineering, Recruiting) face a fragmented RFP 
landscape where 60% of sales ops time is spent on repetitive data entry.

CORE USE CASES:
--------------------------------------------------------------------------------
| INDUSTRY    | END-CUSTOMER TYPE      | PRIMARY NEED                          |
|-------------|------------------------|---------------------------------------|
| Engineering | Municipalities/Devs    | Reduce manual spend on technical specs|
| Healthcare  | Govt & Insurers        | Navigate high-compliance reg-language |
| Recruiting  | Large Global Corps     | Rapidly populate vendor portals       |
--------------------------------------------------------------------------------

================================================================================
3. SYSTEM ARCHITECTURE
================================================================================

The architecture is LLM-Agnostic, allowing customers to use cloud-based frontier 
models (Claude/GPT) or private/local instances (Llama 3) for sensitive data.

TECHNOLOGY STACK:
* FRONTEND: Next.js 14 (App Router) + Tailwind CSS
* BACKEND: FastAPI (Python) - optimized for document processing and scraping
* DATABASE: NeonDB (PostgreSQL) + pgvector for semantic search
* SCRAPING ENGINE: Vercel agent-browser or Playwright (for portal ingestion)
* DOCUMENT LOGIC: PyMuPDF (PDF filling) and python-docx (Word)
* AI ORCHESTRATION: LangGraph (for the Draft -> Refine -> Implement loop)



================================================================================
4. CORE WORKFLOWS
================================================================================

4.1 THE INTAKE LOOP (DOCUMENTS & PORTALS)
The system ingests the requirements from two primary sources, into its Knowledge Base(s):
* FILE UPLOAD: AI parses files to identify questions and formatting rules.
* WEB INGESTION: A scraper module that structures requirements from portal URLs.

4.2 THE REFINEMENT CANVAS (HUMAN-IN-THE-LOOP)
The central collab workspace for AI and the Human respondent:
* SIDE-BY-SIDE VIEW: Original questions on left; AI auto-generated, editable answers on right.
* THE 'IMPLEMENT' BUTTON: A user-edited answer is "implemented" into the 
  final output document buffer.
* KB CHAT SIDECAR: A pinned chat component allowing users to query their 
  Knowledge Base to find specific past projects or references manually.

4.3 OUTPUT GENERATION
* DOCUMENT OVERLAY: System maps generated answers, and human-in-the-loop revised responses, back into the original PDF/Word.
* MANUAL CLIPBOARD: A "One-Click Copy" feature for moving answers into web 
  portals quickly.

================================================================================
5. DATA, SECURITY, & COMPLIANCE
================================================================================

* LLM CONNECTIVITY: Backend supports toggling between OpenAI/Anthropic and 
  local-hosted models (Ollama/vLLM) to meet corporate security standards.
* REDACTION WORKFLOW: Users redact confidential info before ingestion. 
  The platform provides a pre-processing step to flag potential PII.
* TENANT ISOLATION: Strict Row-Level Security (RLS) ensures Knowledge Bases 
  remain siloed per customer organization.

================================================================================
6. IMPLEMENTATION ROADMAP
================================================================================

PHASE 1: THE "COPILOT" FOUNDATION (WEEKS 1-4)
* Next.js dashboard + Clerk Auth.
* KB Chat Sidecar: Querying uploaded company docs.

PHASE 2: THE DRAFTING CANVAS (WEEKS 5-8)
* Side-by-side UI (Question vs. Editable Answer).
* "Implement" logic: Mapping canvas edits to a structured JSON object.

PHASE 3: DOCUMENT AUTO-COMPLETION (WEEKS 9-12)
* Engine to write text back into original PDF/Word fields.
* Basic Web Portal scraping (converting URLs to structured RFP profiles).

PHASE 4: FULL AUTOMATION (WEEKS 13-18)
* Beta: Auto-fill web forms via browser integration.
* Support for fully local LLM instances.

================================================================================
7. DATABASE SCHEMA (KEY TABLES)
================================================================================

-- RFPs table supporting multiple source types
CREATE TABLE rfps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL,
  intake_source_type VARCHAR, -- 'file', 'web_url', 'paste'
  portal_url TEXT,
  profile JSONB, -- Extracted requirements
  status VARCHAR DEFAULT 'intake'
);

-- Canvas tracking for human-in-the-loop edits
CREATE TABLE canvas_drafts (
  id UUID PRIMARY KEY,
  rfp_id UUID REFERENCES rfps(id),
  question_text TEXT,
  ai_suggested_answer TEXT,
  human_edited_answer TEXT,
  is_implemented BOOLEAN DEFAULT FALSE
);

================================================================================
8. SUCCESS METRICS
================================================================================

* TIME SAVINGS: 60-80% reduction in initial draft creation.
* ACCURACY: 80% of AI-generated content requires zero or "minor" editing.
* VERSATILITY: Ability to handle PDF, Word, CSV, and Web Portals in one UI.

================================================================================
END OF SPECIFICATION
================================================================================