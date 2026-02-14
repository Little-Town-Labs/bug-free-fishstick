# Quickstart: P1 — Accuracy Flywheel

## Prerequisites
- All P0 critical gaps merged (branch `002-p0-critical-gaps`)
- Neon PostgreSQL with pgvector extension
- `ENCRYPTION_KEY` env set (64 hex chars)
- Inngest dev server running (`npx inngest-cli@latest dev`)

## Verification Scenarios

### US1: Customer-Specific AI Agents
1. Navigate to `/customers/{id}/settings`
2. Set `preferredTone: 'technical'`, `industryContext: 'Healthcare IT'`, `customInstructions: 'Always reference HIPAA compliance'`
3. Create an RFP for this customer and process it
4. Verify responses reflect technical tone and mention HIPAA
5. Compare with a response for a customer with `preferredTone: 'casual'` — tone should differ

### US2: Real-Time Learning
1. Open a processed RFP with AI-generated responses
2. Click "Accept" on a response → verify no UI lag, check Inngest dashboard for `rfp/capture-learning` event
3. Edit a response text and save → verify learning captured with original vs. corrected text
4. Reject a response → verify rejection signal captured
5. Navigate to customer profile → verify learning count incremented
6. Process another RFP for same customer → verify learnings appear in context

### US3: Auto-Classification & Routing
1. Upload a technical RFP document and process it
2. After processing completes, check RFP detail page for classification badge (type, complexity)
3. Verify suggested assignee shown (if org has multiple members)
4. Accept or override the assignment
5. Filter dashboard by type = 'technical' → verify filtered results
6. Upload a compliance RFP → verify different classification

### US4: Smart Content Library Matching
1. Navigate to `/content-library` and ensure some entries exist
2. Trigger batch embedding: POST `/api/content-library/embed` (admin)
3. Wait for Inngest jobs to complete (check dashboard)
4. Start a proposal for an RFP → verify content library entries shown with relevance scores
5. Compare with previous behavior (all entries shown flat)

### US5: Auto-Index KB Uploads
1. Navigate to `/customers/{id}` → Knowledge Base tab
2. Upload a multi-page PDF (>5 pages)
3. Observe processing status indicator change: pending → chunking → embedding → complete
4. Verify multiple knowledge entries created (one per chunk)
5. Check that each entry has: `sectionHeading`, `chunkIndex`, `tags`
6. Search for content from the middle of the document → verify semantic search finds the right chunk
7. Upload a short document (<1 page) → verify it creates a single entry (no chunking)
