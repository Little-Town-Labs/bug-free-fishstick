# Content Library — Test Data

Sample entries covering all 7 category suggestions. Use these to populate the Content Library during development and QA.

---

## Pricing

### Standard Hourly Rate Card

Our professional services are billed at the following rates:

- **Principal Consultant / Architect**: $225/hr
- **Senior Engineer**: $175/hr
- **Mid-Level Engineer**: $135/hr
- **Junior Engineer / Analyst**: $95/hr
- **Project Manager**: $145/hr
- **QA / Test Engineer**: $115/hr

Volume discounts are available for engagements exceeding 500 hours/month. Blended team rates can be negotiated for fixed-scope projects. All rates are in USD and valid for 90 days from the date of this proposal.

---

### Fixed-Fee Implementation Packages

| Package | Scope | Price |
|---------|-------|-------|
| Starter | Up to 3 integrations, single environment | $24,900 |
| Growth | Up to 8 integrations, 2 environments | $59,500 |
| Enterprise | Unlimited integrations, full HA setup | Custom |

Packages include discovery, implementation, testing, and 30-day hypercare support. Infrastructure costs (cloud, licenses) are billed separately at cost plus 8% markup.

---

## Services

### Managed Services Overview

Our Managed Services offering provides ongoing operational support for deployed solutions. The program includes:

**Monitoring & Alerting**
24/7 infrastructure and application monitoring with PagerDuty escalation chains. SLO dashboards published to customer stakeholders weekly.

**Patch & Update Management**
Scheduled maintenance windows (every other Sunday, 02:00–04:00 local time) for OS patching, dependency updates, and minor version upgrades.

**Performance Optimization**
Quarterly performance reviews including query analysis, caching layer tuning, and autoscaling policy adjustments.

**Incident Response**
Dedicated on-call rotation with defined escalation paths. All P1 incidents receive a post-incident review within 5 business days.

Managed Services contracts run on a 12-month term with month-to-month renewal after the initial period.

---

### Professional Services Engagement Model

Our engagements follow a four-phase model:

1. **Discovery & Assessment** (2–4 weeks) — Stakeholder interviews, current-state architecture review, requirements workshop, risk register.
2. **Design & Planning** (2–3 weeks) — Solution architecture, integration design, project plan, resource allocation.
3. **Implementation** (varies) — Agile sprints, weekly demo cadence, automated CI/CD pipelines, documented runbooks.
4. **Transition & Hypercare** (4 weeks) — Knowledge transfer, admin training, elevated support SLA, go-live readiness checklist.

All phases include formal sign-off gates before proceeding.

---

## Standards

### Coding & Development Standards

All deliverables must conform to the following development standards:

- **Languages**: TypeScript (strict mode), Python 3.11+, Go 1.21+
- **Style**: ESLint + Prettier (TS/JS), Black + Ruff (Python), golangci-lint (Go)
- **Testing**: Minimum 80% line coverage; unit, integration, and E2E test suites required
- **Security**: OWASP Top 10 mitigations verified; no hardcoded secrets; SAST scanning in CI
- **Accessibility**: WCAG 2.1 AA compliance for all customer-facing interfaces
- **Documentation**: OpenAPI 3.1 specs for all REST endpoints; README for every service

Code review is required for all PRs. No direct commits to `main` or `production` branches.

---

### Data Governance Standards

All data handling practices must comply with:

- **Privacy**: GDPR (EU), CCPA (California), and applicable state privacy laws
- **Retention**: PII retained no longer than 24 months post-relationship; purge schedule documented
- **Classification**: Data classified as Public, Internal, Confidential, or Restricted; controls applied by tier
- **Encryption**: AES-256 at rest, TLS 1.3 in transit; key management via cloud KMS
- **Audit Logging**: All access to Confidential and Restricted data logged with 90-day immutable retention

Quarterly compliance reviews are conducted by the Information Security team.

---

## Boilerplate

### Confidentiality & Proprietary Rights

This proposal and all information contained herein is submitted in confidence and is the proprietary and confidential information of Acme Solutions Inc. ("Acme"). This proposal may not be reproduced, distributed, or disclosed to any third party without the prior written consent of Acme. The information is provided solely for the purpose of evaluating a potential business relationship between the parties.

All intellectual property developed specifically for the customer under a resulting engagement agreement shall be assigned to the customer upon final payment. Pre-existing IP, frameworks, and tooling used to deliver the engagement remain the sole property of Acme.

---

### Assumptions & Exclusions

This proposal is based on the following assumptions. Any material deviation may require a scope change and re-pricing.

**Assumptions:**
- Customer will provide timely access to subject matter experts (≤2 business day turnaround on questions)
- Existing infrastructure meets minimum specifications provided in Appendix A
- Customer-managed systems (SSO, HRIS, ERP) expose documented APIs or export formats
- No regulatory approvals (FedRAMP, HIPAA BAA, etc.) are required prior to project start

**Exclusions:**
- Hardware procurement or physical infrastructure
- Third-party software licensing fees
- Data migration from systems not listed in scope
- User training beyond the sessions defined in Section 4
- Post-hypercare support (covered by Managed Services, sold separately)

---

### Acceptance Criteria Statement

Deliverables will be deemed accepted upon written confirmation from the customer's designated project sponsor, or by default if no written objection is received within 10 business days of delivery. Acceptance criteria for each deliverable are defined in the project's Definition of Done, which will be agreed upon during the Discovery phase.

---

## SLA Terms

### Standard SLA — Response & Resolution Targets

| Priority | Definition | Response Time | Resolution Target |
|----------|-----------|--------------|-------------------|
| P1 — Critical | Production outage, data loss risk | 15 minutes | 4 hours |
| P2 — High | Major feature degraded, workaround unavailable | 1 hour | 8 business hours |
| P3 — Medium | Feature degraded, workaround available | 4 business hours | 3 business days |
| P4 — Low | Minor issue, cosmetic, documentation | 1 business day | 10 business days |

Response times apply 24/7 for P1 and P2. P3 and P4 are measured during business hours (08:00–18:00 customer local time, Monday–Friday, excluding public holidays).

---

### Uptime SLA

We commit to the following monthly uptime targets for production environments:

- **Core Platform**: 99.9% (≤43.8 min downtime/month)
- **API Gateway**: 99.95% (≤21.9 min downtime/month)
- **Reporting & Analytics**: 99.5% (≤3.65 hr downtime/month)

Uptime is measured by third-party synthetic monitoring. Scheduled maintenance windows (communicated ≥5 business days in advance) are excluded from uptime calculations. Service credits are issued for SLA breaches per the schedule in the Master Service Agreement.

---

## Company Overview

### About Acme Solutions

Acme Solutions is a technology services firm specializing in enterprise software integration, cloud modernization, and AI-powered workflow automation. Founded in 2014 and headquartered in Austin, TX, we serve mid-market and enterprise clients across financial services, healthcare, manufacturing, and professional services verticals.

Our team of 280+ engineers, architects, and consultants brings deep expertise in cloud-native development (AWS, Azure, GCP), data platform engineering, and regulated-industry compliance. We have delivered more than 400 successful implementations across 18 countries.

**Key Credentials:**
- AWS Advanced Consulting Partner
- Microsoft Solutions Partner (Data & AI)
- SOC 2 Type II certified (annual audit)
- ISO 27001 certified
- Inc. 5000 honoree (2021, 2022, 2023)

---

### Leadership Team

**Sarah Chen — Chief Executive Officer**
20 years in enterprise technology. Former VP of Engineering at a Fortune 500 fintech. MBA from Wharton, BS Computer Science from MIT.

**Marcus Williams — Chief Technology Officer**
Principal architect on 60+ large-scale integrations. AWS Community Hero. Contributor to OpenTelemetry and Apache Kafka projects.

**Priya Patel — VP of Customer Success**
Led customer success organizations at two SaaS unicorns before joining Acme. Focused on long-term partnership value over transactional engagements.

**James O'Brien — VP of Sales & Partnerships**
15 years in B2B enterprise software sales. Manages strategic alliances with AWS, Microsoft, and Salesforce.

---

## Technical Specs

### Infrastructure Architecture — Standard Production Environment

All production environments are deployed on AWS using the following reference architecture:

**Compute**
- ECS Fargate for containerized application workloads (no EC2 management overhead)
- Auto Scaling policies based on CPU (70% target) and custom queue-depth metrics
- Multi-AZ deployment across 3 availability zones

**Networking**
- VPC with public, private, and data subnets per AZ
- Application Load Balancer with WAF (OWASP Core Rule Set + custom rules)
- PrivateLink for cross-account service access; no public database endpoints

**Data**
- Aurora PostgreSQL (Multi-AZ, automated backups with 35-day retention)
- ElastiCache Redis for session management and hot-path caching
- S3 with versioning and Object Lock for document storage

**Observability**
- CloudWatch Logs + Metrics, X-Ray distributed tracing
- Grafana dashboards pushed to customer read-only workspace
- PagerDuty integration for alerting

All infrastructure is provisioned via Terraform; state stored in S3 with DynamoDB locking. Drift detection runs nightly.

---

### Integration Capabilities

Our platform supports the following integration patterns out of the box:

**Protocols**: REST (JSON, XML), GraphQL, gRPC, SOAP, EDI (X12, EDIFACT)
**Messaging**: Apache Kafka, AWS SQS/SNS, Azure Service Bus, RabbitMQ, webhooks
**Auth**: OAuth 2.0 / OIDC, SAML 2.0, API key, mTLS
**File Transfer**: SFTP, S3, Azure Blob, SharePoint, Google Drive

**Pre-built Connectors** (no custom code required):
- Salesforce CRM, HubSpot
- SAP S/4HANA, Oracle NetSuite
- Workday, BambooHR
- ServiceNow, Jira
- Slack, Microsoft Teams
- Stripe, Braintree

Custom connectors are developed using our SDK and follow the same deployment and monitoring patterns as platform connectors. Average development time for a net-new connector: 3–5 business days.
