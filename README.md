# RFP Automator

> Multi-tenant SaaS platform that automates RFP completion using AI agents and intelligent document processing

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-80%25-green)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

## Overview

RFP Automator is an AI-powered platform that dramatically reduces the manual effort marketing and sales teams spend responding to RFPs (Requests for Proposals). By leveraging multi-agent AI systems, customer-specific knowledge bases, and intelligent document processing, the platform can automatically complete 60-80% of RFP fields while maintaining high accuracy and document formatting integrity.

The solution addresses a critical business need: teams currently spend significant time manually completing repetitive RFPs, which is error-prone and diverts skilled personnel from higher-value activities. RFP Automator transforms this process through intelligent automation while maintaining human oversight for complex decisions.

## Features

- **Intelligent Document Ingestion**: Automatically parse PDF and Word RFPs, extracting fields, tables, and form elements while preserving document structure
- **AI-Powered Auto-Completion**: Multi-agent system that analyzes questions, retrieves relevant knowledge, generates responses, and validates quality with confidence scoring
- **Customer-Specific Learning**: Dedicated AI agents per end-customer that learn from past RFPs and improve completion accuracy over time
- **Knowledge Base Management**: Organized document storage by end-customer with semantic search, supporting past RFPs, case studies, certifications, and company documentation
- **Human-in-the-Loop Workflow**: Intuitive dashboard for reviewing AI-generated content, editing responses, and completing flagged items requiring manual input
- **Format-Preserving Output**: Generate completed RFPs in original PDF/Word format with exact formatting and branding preservation
- **Multi-Tenant Architecture**: Secure, isolated environment for each organization with role-based access control
- **Approval Workflow**: Formal review process with version history, state management (Draft → Submitted → Approved → Finalized)

## Technology Stack

### Backend
- **Language**: Python 3.12+
- **API Framework**: FastAPI 0.115+
- **Agent Framework**: LangChain / LangGraph
- **Database**: PostgreSQL 15+ with pgvector extension
- **Vector Search**: pgvector for semantic knowledge retrieval
- **Cache**: Redis 7.0
- **Task Queue**: Celery with Redis broker
- **Document Processing**: PyMuPDF (fitz), pdfplumber, python-docx
- **LLM Support**: Claude API (Anthropic), OpenAI API, Azure OpenAI

### Frontend
- **Language**: TypeScript 5.0+
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS 3.0
- **State Management**: Context API / Zustand
- **UI Components**: shadcn/ui (optional)

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Cloud Storage**: AWS S3 (document storage)
- **Web Server**: Nginx
- **Cloud Platform**: AWS (primary) / Azure (alternative)
- **Orchestration**: Kubernetes (EKS) for production
- **CI/CD**: GitHub Actions

### Testing
- **Backend**: pytest, pytest-cov, pytest-asyncio, factory_boy
- **Frontend**: Jest, React Testing Library
- **E2E**: Playwright
- **Coverage Target**: 80%

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    React/TypeScript Dashboard                    │   │
│  │  • RFP Management  • KB Management  • User Management           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FastAPI Backend                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │   REST API      │  │  Document       │  │    Agent Service        │ │
│  │                 │  │  Processor      │  │                         │ │
│  │ • Auth          │  │ • PDF Parser    │  │  • Orchestrator Agent   │ │
│  │ • Validation    │  │ • Word Parser   │  │  • Document Analyzer    │ │
│  │ • Multi-tenant  │  │ • OCR           │  │  • Response Generator   │ │
│  │                 │  │ • Overlay Gen   │  │  • Quality Checker      │ │
│  │                 │  │                 │  │  • Customer Agents      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│    PostgreSQL       │  │   Vector Database   │  │    File Storage     │
│                     │  │    (pgvector)       │  │       (S3)          │
│ • Tenants           │  │                     │  │                     │
│ • Users             │  │ • KB Embeddings     │  │ • Original RFPs     │
│ • RFPs              │  │ • Semantic Search   │  │ • Completed RFPs    │
│ • Responses         │  │                     │  │ • KB Documents      │
│ • Versions          │  │                     │  │                     │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

### Agent System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   RFP Orchestrator Agent                    │
│         (Oversees entire RFP completion process)            │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Document       │ │  Response       │ │  Quality        │
│  Analyzer Agent │ │  Generator Agent│ │  Checker Agent  │
│                 │ │                 │ │                 │
│ • Parse struct  │ │ • Query KB      │ │ • Validate      │
│ • Identify flds │ │ • Draft answers │ │ • Score conf.   │
│ • Map sections  │ │ • Format output │ │ • Flag review   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │   Customer-Specific Agents    │
            │   (One per end-customer)      │
            │                               │
            │ • CustomerA RFP Agent         │
            │ • CustomerB RFP Agent         │
            │ • Learns from past RFPs       │
            └───────────────────────────────┘
```

### Directory Structure

```
rfp-automator/
├── backend/                # FastAPI backend
│   ├── api/               # API routes and endpoints
│   │   ├── v1/           # API version 1
│   │   │   ├── auth.py  # Authentication endpoints
│   │   │   ├── rfps.py  # RFP management
│   │   │   ├── knowledge.py  # Knowledge base
│   │   │   └── users.py # User management
│   ├── agents/           # AI agent implementations
│   │   ├── orchestrator.py
│   │   ├── document_analyzer.py
│   │   ├── response_generator.py
│   │   ├── quality_checker.py
│   │   └── customer_agent.py
│   ├── core/             # Core business logic
│   │   ├── config.py    # Settings and configuration
│   │   ├── security.py  # Auth and security
│   │   └── dependencies.py
│   ├── models/           # Database models
│   │   ├── tenant.py
│   │   ├── user.py
│   │   ├── rfp.py
│   │   └── knowledge.py
│   ├── services/         # Business logic services
│   │   ├── document_processor.py
│   │   ├── knowledge_service.py
│   │   ├── rfp_service.py
│   │   └── llm_provider.py
│   ├── schemas/          # Pydantic schemas
│   └── tests/           # Backend tests
├── frontend/            # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   │   ├── Dashboard/
│   │   │   ├── RFPEditor/
│   │   │   └── KnowledgeBase/
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── services/    # API client services
│   │   ├── types/       # TypeScript types
│   │   └── utils/       # Utilities
│   └── tests/          # Frontend tests
├── docker/             # Docker configuration
│   ├── backend/
│   ├── frontend/
│   └── nginx/
├── docs/               # Documentation
│   ├── api.md         # API documentation
│   ├── deployment.md  # Deployment guide
│   └── architecture.md
└── .claude/           # Claude Code configuration
    ├── rules.md       # Project-specific patterns
    └── settings.json  # Permissions and hooks
```

### Key Design Patterns

- **Backend**:
  - Repository pattern for data access
  - Service layer for business logic
  - Agent-based architecture for RFP processing
  - Multi-tenant schema isolation
  - LLM provider abstraction layer
- **Frontend**:
  - Component composition
  - Custom hooks for reusable logic
  - Context API for global state
- **API**:
  - RESTful design following OpenAPI 3.0
  - JWT-based authentication
  - Tenant context enforcement
- **Database**:
  - Schema-per-tenant for isolation
  - pgvector for semantic search
  - Row-level security policies

## Getting Started

### Prerequisites

- **Python**: 3.12 or higher
- **Node.js**: 18 or higher
- **Docker**: 20.10 or higher
- **Docker Compose**: 2.0 or higher
- **PostgreSQL**: 15+ with pgvector extension (if not using Docker)
- **Redis**: 7.0 or higher (if not using Docker)
- **AWS Account**: For S3 storage (development can use MinIO)

### Installation

#### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/rfp-automator.git
cd rfp-automator

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
# - Add your LLM API keys (Claude, OpenAI, etc.)
# - Configure AWS S3 credentials
# - Set database passwords

# Start all services
docker-compose up -d

# Run database migrations
docker-compose exec backend alembic upgrade head

# Create initial tenant and superuser
docker-compose exec backend python scripts/create_initial_tenant.py

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/api/v1
# API Docs: http://localhost:8000/docs
```

#### Option 2: Local Development

**Backend Setup:**
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements/local.txt

# Set up PostgreSQL with pgvector
createdb rfp_automator_dev
psql rfp_automator_dev -c "CREATE EXTENSION vector;"

# Run migrations
alembic upgrade head

# Start development server
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend Setup:**
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Configuration

**Environment Variables:**

Create a `.env` file in the project root:

```env
# FastAPI
DEBUG=True
SECRET_KEY=your-secret-key-here-minimum-32-chars
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:pass@localhost/rfp_automator_dev

# Redis
REDIS_URL=redis://localhost:6379/0

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET=rfp-automator-dev

# LLM Providers (tenant-specific keys stored encrypted in DB)
DEFAULT_LLM_PROVIDER=claude
# Optional: Set default API keys for development
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Frontend
VITE_API_URL=http://localhost:8000/api/v1

# JWT
JWT_SECRET=your-jwt-secret-key-minimum-32-chars
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
```

See `.env.example` for all available options.

## Development

### Running Tests

```bash
# Backend tests
pytest                          # Run all backend tests
pytest --cov                    # With coverage
pytest --cov --cov-report=html  # With HTML coverage report
pytest tests/unit              # Unit tests only
pytest tests/integration       # Integration tests only
pytest -k "test_name"          # Specific test

# Frontend tests
npm run test                    # Run all frontend tests
npm run test:watch             # Watch mode
npm run test:coverage          # With coverage

# E2E tests
npm run test:e2e               # Run E2E tests

# All tests
make test                       # Run all tests (backend + frontend)
```

### Code Quality

```bash
# Backend linting and formatting
black backend/                  # Format Python code
ruff check backend/            # Lint Python code
mypy backend/                  # Type checking

# Frontend linting
npm run lint                    # Lint TypeScript/React
npm run format                  # Format with Prettier
npm run type-check             # TypeScript type checking

# All linting
make lint                       # Run all linters
make format                    # Format all code
```

### Database Migrations

```bash
# Create migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1

# View migration history
alembic history

# With Docker
docker-compose exec backend alembic upgrade head
```

### Common Tasks

```bash
# Start development servers
make dev                        # Start all services

# Build for production
make build                      # Build backend and frontend

# Clean build artifacts
make clean                      # Remove build files and caches

# Database operations
make db-reset                   # Reset database
make db-seed                    # Seed with sample data

# View logs
docker-compose logs -f          # All services
docker-compose logs -f backend  # Backend only
docker-compose logs -f frontend # Frontend only

# Run agent workflow test
python scripts/test_agent_workflow.py --rfp-path example_rfps/sample.pdf
```

## API Documentation

API documentation is available at:
- **Development**: http://localhost:8000/docs (Swagger UI)
- **ReDoc**: http://localhost:8000/redoc
- **Production**: https://api.rfp-automator.com/docs

### Key Endpoints

**Authentication:**
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh JWT token
- `POST /api/v1/auth/logout` - User logout

**RFPs:**
- `GET /api/v1/rfps` - List RFPs (filtered by role)
- `POST /api/v1/rfps` - Create new RFP
- `GET /api/v1/rfps/{id}` - Get RFP details
- `POST /api/v1/rfps/{id}/upload` - Upload RFP document
- `POST /api/v1/rfps/{id}/process` - Trigger AI processing
- `GET /api/v1/rfps/{id}/responses` - Get all responses
- `PUT /api/v1/rfps/{id}/responses/{field_id}` - Update response
- `POST /api/v1/rfps/{id}/submit` - Submit for review
- `POST /api/v1/rfps/{id}/approve` - Approve RFP
- `GET /api/v1/rfps/{id}/download` - Download completed RFP

**Knowledge Base:**
- `GET /api/v1/customers/{id}/knowledge` - List KB entries
- `POST /api/v1/customers/{id}/knowledge/upload` - Upload document
- `POST /api/v1/customers/{id}/knowledge/search` - Semantic search

See `docs/api.md` for complete API reference.

## Deployment

### Production Build

```bash
# Build Docker images
docker-compose -f docker-compose.prod.yml build

# Run migrations
docker-compose -f docker-compose.prod.yml run backend alembic upgrade head

# Start services
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment

```bash
# Deploy to Kubernetes (EKS)
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/
kubectl apply -f k8s/ingress.yaml
```

See `docs/deployment.md` for detailed deployment instructions.

## Security

- **Authentication**: JWT with refresh tokens, optional 2FA
- **Authorization**: Role-based access control (Super Admin, Admin, User)
- **Data Encryption**: AES-256 at rest, TLS 1.3 in transit
- **Tenant Isolation**: Schema-per-tenant with row-level security
- **API Security**: Rate limiting, CORS, input validation
- **Secrets Management**: Encrypted storage for API keys
- **Audit Logging**: All data access logged with user context

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Code of conduct
- Development workflow
- Coding standards
- Pull request process
- Testing requirements

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`make test && make lint`)
5. Commit your changes (following [Conventional Commits](https://www.conventionalcommits.org/))
6. Push to your fork
7. Open a Pull Request

## Troubleshooting

### Common Issues

**Database connection errors:**
```bash
# Check PostgreSQL is running
docker-compose ps db

# Check pgvector extension
docker-compose exec db psql -U postgres -d rfp_automator_dev -c "\dx"

# Reset database
make db-reset
```

**Port already in use:**
```bash
# Find process using port
lsof -i :8000

# Kill process
kill -9 <PID>
```

**LLM API errors:**
```bash
# Verify API keys in .env
grep API_KEY .env

# Check tenant LLM configuration
docker-compose exec backend python scripts/check_llm_config.py
```

**Agent workflow failures:**
```bash
# Check Redis connection
docker-compose exec backend python -c "import redis; r = redis.from_url('redis://redis:6379'); print(r.ping())"

# View agent logs
docker-compose logs -f backend | grep "agent"
```

See `docs/troubleshooting.md` for more solutions.

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: See `docs/` directory
- **Issues**: [GitHub Issues](https://github.com/your-org/rfp-automator/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/rfp-automator/discussions)

## Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/), [LangChain](https://langchain.com/), and [React](https://react.dev/)
- Powered by [Claude API](https://www.anthropic.com/api) (Anthropic)
- Document processing with [PyMuPDF](https://pymupdf.readthedocs.io/)

---

**Last Updated**: 2026-01-21
**Version**: 1.0.0 (Development)
**Status**: In Development
