# RFP Automator — Ideal End State

This document contrasts the **current implementation** with the **ideal end state** for efficient, effective RFP processing. Items marked with `NEW` do not exist today. Items marked `ENHANCED` exist but need significant improvement.

---

## Current vs Ideal: User Workflow

```mermaid
flowchart TD
    %% ── Entry ──
    Login([User Logs In])
    Login --> Dashboard

    subgraph Dashboard["Smart Dashboard"]
        Dash_View["RFP List with Priority Queue<br/><b>ENHANCED</b>: auto-sort by due date,<br/>complexity score, win probability"]
        Analytics["Analytics Panel<br/><b style='color:green'>NEW</b>: win rate, avg completion time,<br/>automation %, team utilization"]
        Dash_View ~~~ Analytics
    end

    Dashboard -->|New RFP| Upload
    Dashboard -->|Select RFP| Review
    Dashboard -->|Nav| KB_Mgmt
    Dashboard -->|Nav| ContentLib
    Dashboard -->|Nav| Settings

    %% ── Upload (Enhanced) ──
    subgraph Upload["Intelligent Ingestion"]
        Upload_Doc["Upload PDF / Word<br/><b style='color:green'>NEW</b>: batch upload,<br/>drag-and-drop multiple"]
        Select_Customer["Select End-Customer<br/><b style='color:green'>NEW</b>: customer profiles<br/>with past RFP history"]
        Enter_Details["RFP Details<br/>(name, contact, dates)"]
        Auto_Classify["Auto-Classify RFP<br/><b style='color:green'>NEW</b>: detect type, complexity,<br/>estimate effort, suggest assignee"]

        Upload_Doc --> Select_Customer --> Enter_Details --> Auto_Classify
    end

    Auto_Classify --> AI_Pipeline

    %% ── AI Pipeline (Enhanced) ──
    subgraph AI_Pipeline["AI Processing Pipeline"]
        direction TB
        Parse["Document Analyzer<br/>Parse structure, extract fields,<br/>map positions for overlay"]
        Customer_Agent["Customer-Specific Agent<br/><b style='color:green'>NEW</b>: per-customer learned<br/>patterns & preferences"]
        KB_Search["Semantic KB Search<br/>pgvector similarity + content library"]
        Generate["Response Generator<br/><b>ENHANCED</b>: uses customer agent<br/>context + cross-customer learnings"]
        QA["Quality Checker<br/>Confidence scores, flag low items"]

        Parse --> Customer_Agent --> KB_Search --> Generate --> QA
    end

    QA --> Review

    %% ── Review (Enhanced) ──
    subgraph Review["Side-by-Side Review"]
        SideBySide["Original Doc Preview | Editable Responses<br/><b style='color:green'>NEW</b>: true side-by-side with<br/>original PDF/Word rendered inline"]
        Confidence["Confidence Indicators<br/>Accept / Edit / Reject per field"]
        Completion["Real-Time Completion %<br/>with field-level status"]
        Collab["Real-Time Collaboration<br/><b style='color:green'>NEW</b>: multiple users editing,<br/>comments, @mentions"]

        SideBySide --> Confidence --> Completion
        SideBySide -.-> Collab
    end

    Review --> Workflow
    Review -->|Generate Proposal| Proposal

    %% ── Approval (Enhanced) ──
    subgraph Workflow["Approval Workflow"]
        Submit["Submit for Review<br/>DRAFT → SUBMITTED"]
        AdminReview{Admin Review}
        Approve["Approve<br/>SUBMITTED → APPROVED"]
        Return["Return with Comments<br/>SUBMITTED → DRAFT"]
        Finalize["Finalize<br/>APPROVED → FINALIZED"]
        Export_Native["Format-Preserving Export<br/><b style='color:green'>NEW</b>: PDF overlay, Word<br/>with original formatting & branding"]

        Submit --> AdminReview
        AdminReview -->|Approve| Approve
        AdminReview -->|Return| Return
        Return -.-> Review
        Approve --> Finalize --> Export_Native
    end

    %% ── Learning (Enhanced) ──
    subgraph Learning["Continuous Learning Loop"]
        Auto_Learn["Auto-Learn on Approval<br/>Extract learnings from corrections"]
        Realtime_Learn["Real-Time Learning<br/><b style='color:green'>NEW</b>: learn from every<br/>edit/accept/reject action,<br/>not just on approval"]
        Customer_Learn["Customer Agent Update<br/><b style='color:green'>NEW</b>: per-customer patterns<br/>improve with each RFP"]
        Cross_Learn["Cross-Customer Learning<br/><b style='color:green'>NEW</b>: generalizable insights<br/>shared across tenant"]

        Auto_Learn --> Customer_Learn
        Realtime_Learn --> Customer_Learn
        Customer_Learn --> Cross_Learn
    end

    Approve -.-> Learning

    %% ── Proposal Generator (current, works well) ──
    subgraph Proposal["Proposal Draft Generator"]
        Questions["AI Clarifying Questions"]
        Answers["User Answers"]
        Gen_Proposal["Generate Markdown Proposal<br/>with KB + Content Library context"]
        Edit_Proposal["ProposalEditor<br/>(auto-save, finalize)"]
        Export_Proposal["Export .md<br/><b>ENHANCED</b>: also export<br/>PDF / Word / HTML"]

        Questions --> Answers --> Gen_Proposal --> Edit_Proposal --> Export_Proposal
    end

    %% ── Knowledge Base (Enhanced) ──
    subgraph KB_Mgmt["Knowledge Base Management"]
        KB_Upload["Upload Past RFPs & Documents<br/><b>ENHANCED</b>: auto-extract & index"]
        KB_Customer["Organized by End-Customer<br/><b style='color:green'>NEW</b>: customer profiles<br/>with linked KB entries"]
        KB_Search_UI["Semantic Search UI<br/><b style='color:green'>NEW</b>: browse, search,<br/>view source documents"]
        KB_Auto["Auto-Suggestions<br/><b style='color:green'>NEW</b>: surface relevant<br/>KB gaps after each RFP"]

        KB_Upload --> KB_Customer --> KB_Search_UI
        KB_Customer -.-> KB_Auto
    end

    %% ── Content Library (current, works well) ──
    subgraph ContentLib["Content Library"]
        CL_Manage["CRUD by Category<br/>(pricing, certs, bios)"]
        CL_AutoSuggest["Auto-Inject into Proposals<br/><b>ENHANCED</b>: smart matching,<br/>not just 'include all'"]
    end

    %% ── Settings (Enhanced) ──
    subgraph Settings["Organization Settings"]
        LLM["LLM Provider Config"]
        Users["User Management & Invites"]
        Confidence_Threshold["Confidence Threshold Config<br/><b style='color:green'>NEW</b>: per-org threshold<br/>for auto-fill vs needs-input"]
        Integrations["Integrations<br/><b style='color:green'>NEW</b>: CRM, SharePoint,<br/>Slack notifications"]

        LLM ~~~ Users ~~~ Confidence_Threshold ~~~ Integrations
    end

    %% ── Styling ──
    classDef enhanced fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef newFeature fill:#e8f5e9,stroke:#388e3c,stroke-width:2px,stroke-dasharray:5
    classDef current fill:#fff,stroke:#666,stroke-width:1px
    classDef pipeline fill:#fff3e0,stroke:#f57c00,stroke-width:1px
```

---

## Ideal Technical Architecture

```mermaid
flowchart TD
    subgraph Client["Client Layer"]
        NextJS["Next.js 15 App Router<br/>React Server Components<br/>+ Client Islands"]
        RT["Real-Time Layer<br/><b style='color:green'>NEW</b>: WebSocket / SSE<br/>for live collaboration"]
    end

    subgraph Edge["Edge & CDN"]
        Middleware["Clerk Auth Middleware"]
        Cache["Vercel Edge Cache<br/>+ KV for hot data"]
    end

    subgraph API["API Layer (Next.js Route Handlers)"]
        RFP_API["RFP CRUD + Workflow"]
        Proposal_API["Proposal Generator"]
        KB_API["Knowledge Base API<br/><b style='color:green'>NEW</b>: document upload,<br/>auto-indexing pipeline"]
        Analytics_API["Analytics API<br/><b style='color:green'>NEW</b>: win rates,<br/>time metrics, utilization"]
    end

    subgraph Jobs["Background Jobs (Inngest)"]
        Process["rfp/process-rfp<br/>Parse → Retrieve → Generate → QA"]
        GenProposal["rfp/generate-proposal<br/>Questions → Write → Cite"]
        ExtractLearn["rfp/extract-learnings"]
        DocExport["rfp/export-document<br/><b style='color:green'>NEW</b>: PDF overlay,<br/>Word generation"]
        Embed["rfp/generate-embeddings"]
        Classify["rfp/classify-rfp<br/><b style='color:green'>NEW</b>: auto-type,<br/>complexity, effort estimate"]
    end

    subgraph AI["AI Agent Layer"]
        Orchestrator["RFP Orchestrator"]
        DocAnalyzer["Document Analyzer"]
        CustomerAgent["Customer-Specific Agent<br/><b style='color:green'>NEW</b>: per-customer<br/>learned patterns"]
        RespGen["Response Generator"]
        QualityCheck["Quality Checker"]
        ProposalQGen["Proposal Question Generator"]
        ProposalWriter["Proposal Writer"]
    end

    subgraph Data["Data Layer"]
        Neon["Neon PostgreSQL<br/>+ pgvector"]
        Blob["Vercel Blob<br/>Original + Generated docs"]
        KV["Vercel KV / Upstash Redis<br/>Cache + Rate Limiting"]
    end

    subgraph LLM["LLM Providers (per-org config)"]
        Claude["Claude API"]
        GPT["OpenAI API"]
        Azure["Azure OpenAI"]
    end

    Client --> Edge --> API
    API --> Jobs
    Jobs --> AI
    AI --> Data
    AI --> LLM
    API --> Data

    classDef newBlock fill:#e8f5e9,stroke:#388e3c,stroke-width:2px,stroke-dasharray:5
```

---

## Gap Analysis: Current vs Ideal

```mermaid
flowchart LR
    subgraph Current["CURRENT STATE"]
        direction TB
        C1["Single-format export<br/>(markdown only)"]
        C2["No customer profiles<br/>(flat org scoping)"]
        C3["Learning only on approval<br/>(delayed feedback)"]
        C4["No document preview<br/>(placeholder RFP detail page)"]
        C5["No analytics<br/>(no win/loss tracking)"]
        C6["No auto-classification<br/>(manual triage)"]
        C7["All content library injected<br/>(no smart matching)"]
        C8["No real-time collaboration<br/>(single-user editing)"]
        C9["Generic AI agents<br/>(no customer-specific learning)"]
        C10["Manual KB management<br/>(no auto-extraction)"]
    end

    subgraph Ideal["IDEAL STATE"]
        direction TB
        I1["Format-preserving export<br/>(PDF overlay + Word)"]
        I2["End-customer profiles<br/>(history, preferences, patterns)"]
        I3["Real-time learning<br/>(every edit feeds back)"]
        I4["Side-by-side doc preview<br/>(original + editable responses)"]
        I5["Analytics dashboard<br/>(win rate, time saved, automation %)"]
        I6["Auto-classify & route<br/>(complexity, type, assignee suggestion)"]
        I7["Smart content matching<br/>(relevance-scored injection)"]
        I8["Real-time collaboration<br/>(multi-user, comments, @mentions)"]
        I9["Customer-specific agents<br/>(per-customer learned patterns)"]
        I10["Auto-index KB uploads<br/>(parse, embed, organize)"]
    end

    C1 -->|"P0 — Core PRD req"| I1
    C2 -->|"P0 — Enables agent learning"| I2
    C3 -->|"P1 — Accuracy flywheel"| I3
    C4 -->|"P0 — Core PRD req"| I4
    C5 -->|"P2 — Business value"| I5
    C6 -->|"P1 — Efficiency gain"| I6
    C7 -->|"P1 — Quality gain"| I7
    C8 -->|"P2 — Team scaling"| I8
    C9 -->|"P1 — Core differentiator"| I9
    C10 -->|"P1 — Onboarding speed"| I10

    classDef current fill:#ffebee,stroke:#c62828,stroke-width:1px
    classDef ideal fill:#e8f5e9,stroke:#2e7d32,stroke-width:1px
    classDef p0 stroke:#c62828,stroke-width:3px
    classDef p1 stroke:#f57c00,stroke-width:2px
    classDef p2 stroke:#1976d2,stroke-width:1px

    class C1,C2,C3,C4,C5,C6,C7,C8,C9,C10 current
    class I1,I2,I3,I4,I5,I6,I7,I8,I9,I10 ideal
```

---

## Priority Roadmap

```mermaid
gantt
    title Ideal State Roadmap (Priority Order)
    dateFormat YYYY-MM-DD
    axisFormat %b

    section P0 — Critical
    Format-preserving export (PDF/Word overlay)    :p0a, 2026-03-01, 4w
    Side-by-side document preview                  :p0b, 2026-03-01, 3w
    End-customer profiles & KB organization        :p0c, 2026-03-15, 3w

    section P1 — High
    Customer-specific AI agents                    :p1a, after p0c, 4w
    Auto-classify & smart routing                  :p1b, after p0b, 2w
    Real-time learning (edit-level feedback)        :p1c, after p1a, 3w
    Smart content library matching                 :p1d, after p1a, 2w
    Auto-index KB document uploads                 :p1e, after p0c, 3w

    section P2 — Medium
    Analytics dashboard                            :p2a, after p1c, 3w
    Real-time collaboration (WebSocket)            :p2b, after p2a, 4w
    CRM & notification integrations                :p2c, after p2a, 3w
```

---

## Summary of Key Differences

| Area | Current | Ideal | Priority |
|------|---------|-------|----------|
| **Export** | Markdown only | PDF overlay + Word preserving original format & branding | P0 |
| **Document Review** | Placeholder page, no original doc view | Side-by-side: original rendered + editable responses | P0 |
| **Customer Context** | Flat org scoping, no customer profiles | End-customer profiles with history, preferences, linked KB | P0 |
| **AI Agents** | Generic pipeline (same for all customers) | Customer-specific agents with learned patterns per customer | P1 |
| **Learning** | Batch on approval only | Real-time: every accept/edit/reject feeds back immediately | P1 |
| **RFP Triage** | Manual assignment, no classification | Auto-classify type & complexity, suggest assignee, priority queue | P1 |
| **Content Library** | Inject all entries into every proposal | Relevance-scored smart matching per RFP context | P1 |
| **KB Management** | Manual CRUD entries | Auto-parse uploaded docs, extract & embed, organize by customer | P1 |
| **Analytics** | None | Win rate, automation %, time saved, team utilization | P2 |
| **Collaboration** | Single-user editing | Real-time multi-user with comments and @mentions | P2 |
| **Integrations** | None | CRM (Salesforce/HubSpot), SharePoint, Slack notifications | P2 |



Summary
P0 — Critical gaps (core PRD requirements not yet built):
  - Format-preserving export — Currently markdown only; ideal is PDF overlay + Word with original formatting/branding preserved
  - Side-by-side document review — Currently a placeholder detail page; ideal renders the original doc alongside editable responses
  - End-customer profiles — Currently flat org scoping; ideal has per-customer profiles with RFP history and linked KB entries

  P1 — High-impact (the accuracy flywheel):
  - Customer-specific AI agents — Currently one generic pipeline; ideal has per-customer learned patterns that improve with each RFP
  - Real-time learning — Currently only captures on approval; ideal learns from every accept/edit/reject action
  - Auto-classification & routing — Currently manual triage; ideal auto-detects RFP type, complexity, and suggests assignee
  - Smart content library matching — Currently injects all entries; ideal scores relevance per RFP context
  - Auto-index KB uploads — Currently manual entry; ideal parses uploaded docs and auto-extracts/embeds

  P2 — Medium (team scaling & business insight):
  - Analytics dashboard, real-time collaboration, CRM/Slack integrations

  The Gantt chart in the file shows a suggested implementation roadmap ordering these by dependency and priority.