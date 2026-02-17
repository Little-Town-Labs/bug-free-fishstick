# Project-Specific Claude Instructions

This file contains project-specific patterns, conventions, and instructions that Claude should follow when working in the RFP Automator codebase.

## Architecture Patterns

**Design Patterns Used:**
- **Multi-Agent System**: Orchestrator pattern with specialized sub-agents (Document Analyzer, Response Generator, Quality Checker, Customer Agents)
- **Repository Pattern**: Data access abstraction layer
- **Service Layer**: Business logic separated from API endpoints
- **LLM Provider Abstraction**: Unified interface supporting Claude, GPT, Azure OpenAI
- **Multi-Tenant Schema Isolation**: Schema-per-tenant with JWT-based tenant context enforcement

**Directory Structure:**
```
backend/
  api/v1/         # API routes (thin controllers)
  agents/         # AI agent implementations (orchestrator, analyzers, generators)
  core/           # Core functionality (config, security, dependencies)
  models/         # SQLAlchemy database models
  schemas/        # Pydantic request/response schemas
  services/       # Business logic services
  tests/          # Test files

frontend/
  src/
    components/   # React components (Dashboard, RFPEditor, KnowledgeBase)
    pages/        # Page-level components
    hooks/        # Custom React hooks
    services/     # API client services
    types/        # TypeScript interfaces
    utils/        # Utility functions
```

**Key Architectural Decisions:**
- All database access goes through SQLAlchemy models (no raw SQL)
- Services contain business logic, API routes are thin
- Agent workflow managed by LangGraph state machines
- JWT tokens carry tenant context; middleware enforces tenant isolation
- All LLM calls go through abstraction layer (supports multiple providers)
- Vector embeddings stored in pgvector for semantic search
- Documents stored in S3 with tenant-prefixed paths

## Important Conventions

**Code Organization:**
- One class per file (except small related classes)
- Files named after the primary class (e.g., `rfp_service.py` contains `RFPService`)
- Group related functionality in modules
- Keep functions focused (max 50 lines; agents may be longer for complex workflows)

**Naming Conventions:**
- **Classes**: PascalCase (e.g., `DocumentAnalyzerAgent`, `RFPService`)
- **Functions/methods**: snake_case (e.g., `process_rfp`, `get_customer_agent`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_FILE_SIZE_MB`, `DEFAULT_CONFIDENCE_THRESHOLD`)
- **Private methods**: prefix with underscore (e.g., `_parse_field`, `_calculate_confidence`)
- **Async functions**: Use `async def` prefix clearly (e.g., `async def process_document`)

**Required Practices:**
- **Type Hints**: All functions must have type hints (Python 3.12+ syntax)
- **Async/Await**: Use async/await for all I/O operations (database, LLM calls, file operations)
- **Pydantic Models**: Use Pydantic for request/response validation
- **Error Handling**: Use FastAPI's HTTPException with proper status codes
- **Logging**: Use structured logging with context (tenant_id, user_id, rfp_id)
- **Tenant Isolation**: Always filter queries by tenant_id from JWT context

## Agent System Patterns

**Agent Architecture:**
```python
# Orchestrator coordinates workflow
class RFPOrchestratorAgent:
    async def process_rfp(self, rfp_id: str) -> RFPProcessingResult:
        # 1. Document Analysis
        parsed_fields = await self.document_analyzer.analyze(rfp_id)

        # 2. Knowledge Retrieval
        context = await self.customer_agent.get_context(parsed_fields)

        # 3. Response Generation
        responses = await self.response_generator.generate(parsed_fields, context)

        # 4. Quality Check
        validated = await self.quality_checker.validate(responses)

        return validated
```

**LangGraph Workflow Pattern:**
- Use StateGraph for agent workflow state management
- Define clear state transitions (analyze → retrieve → generate → validate)
- Handle errors at each node with retry logic
- Log state transitions for debugging

**Customer-Specific Learning:**
- Each end-customer has a dedicated agent that learns from past RFPs
- Agents store patterns in PatternStore (database-backed)
- Learning happens after RFP approval (human validation)
- Cross-customer learning within same tenant (privacy-preserving)

**LLM Provider Abstraction:**
```python
# Always use the abstraction layer
llm_provider = get_llm_provider(tenant)
response = await llm_provider.complete(prompt, **kwargs)

# Never call LLM APIs directly
# BAD: anthropic.messages.create(...)
# GOOD: llm_provider.complete(...)
```

## Testing Requirements

**Coverage Standards:**
- **Backend**: 80% minimum coverage with pytest
- **Agents**: 90% coverage (critical path)
- **Frontend**: 70% minimum coverage with Jest
- **E2E**: All critical user workflows (upload RFP, AI processing, review, export)

**Test Structure:**
```
tests/
  unit/           # Fast isolated tests
    test_agents.py
    test_services.py
    test_models.py
  integration/    # Tests with database/external services
    test_rfp_workflow.py
    test_knowledge_search.py
  e2e/            # End-to-end tests with Playwright
    test_rfp_completion_flow.spec.ts
```

**Testing Patterns:**
```python
# Use pytest fixtures for common setup
@pytest.fixture
async def tenant_context():
    tenant = await create_test_tenant()
    yield tenant
    await cleanup_tenant(tenant.id)

# Use factory_boy for test data
rfp = await RFPFactory.create(
    tenant_id=tenant.id,
    status=RFPStatus.DRAFT
)

# Mock LLM calls in tests
@pytest.mark.asyncio
async def test_response_generation(mock_llm_provider):
    mock_llm_provider.complete.return_value = "Test response"
    result = await response_generator.generate(field, context)
    assert result.text == "Test response"
```

**Before Committing:**
```bash
# Always run before committing
pytest --cov                    # Run tests with coverage
ruff check backend/            # Lint Python
mypy backend/                  # Type check
black backend/                 # Format code
npm run test                   # Run frontend tests
```

## Agent Recommendations

**For Backend API Work:**
- Use `@fastapi-expert` for FastAPI routes, middleware, dependencies
- Use `@python-expert` for general Python backend code
- Use `@Python Security Expert` for authentication, authorization, data security

**For Agent System Work:**
- Use `@ml-data-expert` for LangChain/LangGraph agents, embeddings, vector search
- Use `@python-expert` for agent service layer and orchestration
- Use `@Python Performance Expert` for optimizing agent workflows

**For Document Processing:**
- Use `@python-expert` for PDF/Word parsing, overlay generation
- Use `@backend-developer` for file upload/download workflows

**For Frontend Work:**
- Use `@react-component-architect` for UI components (Dashboard, RFPEditor)
- Use `@frontend-developer` for general frontend tasks
- Use `@tailwind-frontend-expert` for Tailwind CSS styling

**For Database Work:**
- Use `@python-expert` for SQLAlchemy models, Alembic migrations
- Use `@Python Performance Expert` for query optimization, pgvector indexes

**For Quality Assurance:**
- Use `@code-reviewer` before creating pull requests
- Use `@Python Security Expert` for security-sensitive features (auth, multi-tenancy)
- Use `@performance-optimizer` when performance is critical (agent workflows, vector search)
- Use `@Python Testing Expert` for comprehensive test coverage

**For Complex Features:**
- Start with `@tech-lead-orchestrator` to coordinate multi-step work
- Use `@project-analyst` to understand unfamiliar parts of the codebase

## Common Workflows

**Adding a New Agent:**
1. Define agent interface in `backend/agents/base.py`
2. Implement agent class in `backend/agents/<agent_name>.py`
3. Add agent to orchestrator workflow in `backend/agents/orchestrator.py`
4. Write unit tests in `tests/unit/test_agents.py`
5. Write integration test for end-to-end workflow
6. Document agent behavior in `docs/agents.md`

**Adding a New API Endpoint:**
1. Define Pydantic schemas in `backend/schemas/`
2. Add route in `backend/api/v1/<resource>.py`
3. Implement service logic in `backend/services/<resource>_service.py`
4. Ensure tenant isolation (check JWT context)
5. Write API tests in `tests/integration/test_<resource>_api.py`
6. Update OpenAPI docs with examples

**Fixing a Bug:**
1. Write a failing test that reproduces the bug
2. Fix the bug in the appropriate layer (agent, service, API)
3. Verify test passes
4. Check for similar bugs in related code
5. Update documentation if needed

**Database Schema Changes:**
1. Create Alembic migration: `alembic revision --autogenerate -m "description"`
2. Review migration file carefully (Alembic may miss changes)
3. Test migration up and down
4. Update SQLAlchemy models
5. Update Pydantic schemas
6. Update tests
7. Document breaking changes in CHANGELOG.md

**Adding LLM Provider Support:**
1. Implement provider class in `backend/services/llm_providers/<provider>.py`
2. Extend `LLMProvider` abstract base class
3. Add provider to factory in `backend/services/llm_provider.py`
4. Add provider configuration to tenant settings
5. Write tests with mocked API calls
6. Document provider-specific requirements

## Special Considerations

**Multi-Tenancy:**
- ALWAYS filter database queries by `tenant_id` from JWT context
- Use tenant context from `Depends(get_current_tenant)`
- Never allow cross-tenant data access (enforce at DB and application level)
- Prefix S3 paths with tenant ID: `{tenant_id}/rfps/{rfp_id}/`
- Test tenant isolation thoroughly

**Performance:**
- **Agents**: Cache LLM responses for identical prompts
- **Vector Search**: Use pgvector indexes, limit results with `LIMIT`
- **Database**: Use `select_related()` / `joinedload()` to avoid N+1 queries
- **File Upload**: Stream large files, don't load entire file in memory
- **Background Jobs**: Use Celery for long-running tasks (RFP processing)

**Security:**
- **Secrets**: Never commit API keys, use encrypted tenant settings
- **Input Validation**: Validate all user input with Pydantic
- **SQL Injection**: Use parameterized queries (SQLAlchemy handles this)
- **File Upload**: Validate file types, scan for malware, limit size
- **Authentication**: Use JWT with expiration, refresh tokens
- **Authorization**: Enforce role-based access (Super Admin, Admin, User)

**Document Processing:**
- **PDF Parsing**: Use PyMuPDF for structure, pdfplumber for text extraction
- **Word Parsing**: Use python-docx for .docx files
- **Format Preservation**: Use overlay technique for PDF output
- **OCR**: Use Tesseract for scanned PDFs (if needed)

**Agent Workflow:**
- **Error Handling**: Retry LLM calls with exponential backoff
- **Timeouts**: Set timeouts for agent operations (prevent hangs)
- **Logging**: Log all agent decisions for debugging and learning
- **Confidence Scores**: Flag items below threshold (default 0.7) for human review

**Documentation:**
- Update `docs/api.md` for API changes
- Update `docs/agents.md` for agent behavior changes
- Add docstrings to all public methods (Google style)
- Document breaking changes in CHANGELOG.md

## Technology-Specific Notes

**FastAPI-Specific:**
- Use dependency injection for database sessions, tenant context
- Leverage async endpoints for I/O-bound operations
- Use BackgroundTasks for lightweight async tasks (email notifications)
- Use Celery for heavy async tasks (RFP processing)
- Return Pydantic models from endpoints (automatic serialization)

**LangChain/LangGraph-Specific:**
- Use LangGraph StateGraph for agent workflow orchestration
- Define clear state transitions and error handling
- Use LangChain's memory abstraction for agent context
- Leverage LangChain's vector store abstraction for pgvector
- Use LangChain's document loaders for knowledge base ingestion

**React-Specific:**
- Use functional components with hooks (no class components)
- Use Context API for tenant/user global state
- Keep components small and focused (single responsibility)
- Use custom hooks for reusable logic (useRFP, useKnowledge)
- Implement optimistic UI updates for better UX

**TypeScript-Specific:**
- Enable strict mode in tsconfig.json
- Avoid `any` type (use `unknown` if truly unknown)
- Define interfaces for all API responses (match Pydantic schemas)
- Use generics for reusable components and hooks

**PostgreSQL + pgvector-Specific:**
- Use pgvector for semantic search (cosine similarity)
- Create indexes on vector columns: `CREATE INDEX ON knowledge USING ivfflat (embedding vector_cosine_ops);`
- Batch embed operations for efficiency
- Use approximate nearest neighbor search for speed

## LTLClaude Integration

**Recommended Workflow:**
1. Start session with project context (automatically loaded from this config)
2. Use specialized agents for specific tasks (see "Agent Recommendations" above)
3. Let agents read `project-config.json` for tech stack awareness
4. Follow patterns in this file for consistency
5. Use `@code-reviewer` before merging

**When to Ask for Help:**
- Uncertain about multi-tenant isolation implementation
- Complex agent workflow design decisions
- LLM prompt engineering for optimal responses
- Performance optimization for vector search or agent workflows

## Notes

- This is a new project starting from a PRD (see `rfp-prd.md`)
- Focus on MVP features first (see PRD Phase 1-2)
- Maintain clean separation between agents, services, and API layers
- Prioritize tenant isolation and security at every layer
- Document all agent decisions for transparency and debugging
