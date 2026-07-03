# Business Requirements Document (BRD)

## FEC Code Intelligence — KSA-296: KB Sensitive Data Masking - Read-time PII/Business Logic Redaction

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-296 |
| Title | KB Sensitive Data Masking - Read-time PII/Business Logic Redaction |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-01-27 |
| Status | Draft |
| Related Documents | BRD-v1-KSA-296.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-27 | BA Agent | Initiate document from Jira ticket KSA-296 |

---

## 1. Introduction

### 1.1 Scope

The Knowledge Base (KB) system currently stores all ingested content as plaintext without any masking or redaction for sensitive data. This includes PII (emails, phone numbers, IPs, credit cards), credentials (API keys, JWT tokens, passwords), and business-sensitive logic.

This CR implements a read-time masking middleware that:
- Stores content unchanged in the database (preserving full fidelity)
- Applies redaction rules when returning content via API responses based on the requester's role
- Provides auto-classification of sensitivity levels with admin oversight
- Offers an admin configuration UI for managing masking rules and allowlists

### 1.2 Out of Scope

- Write-time encryption (content remains plaintext in DB)
- Database-level column encryption
- Full DLP integration with external services
- Masking for non-KB modules (analytics, code-intelligence)
- Multi-tenant isolation (existing scope system handles this)
- Real-time PII detection during ingestion

### 1.3 Preliminary Requirements

- Admin Portal running at localhost:4572/admin (existing)
- KB Memory module operational (existing MemoryEngine)
- RBAC system in place (existing rbac.router.ts)
- SQLite database for KB entries (existing)

---

## 2. Business Requirements

### 2.1 High Level Process Map

The masking system operates as a middleware layer between KB storage and the API response:

1. Content is ingested into KB normally (no changes to write path)
2. When a read request arrives (mem_search, mem_map, etc.), the masking middleware intercepts the response
3. The middleware classifies content sensitivity (if not already classified)
4. Based on the requester's role and the content's sensitivity level, appropriate masking is applied
5. The masked response is returned to the caller
6. All masking events are logged to the audit trail

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a system admin, I want PII auto-masked for non-admin users | MUST HAVE | KSA-296 |
| 2 | As a system admin, I want credentials always masked for all users | MUST HAVE | KSA-296 |
| 3 | As a developer, I want CONFIDENTIAL content to show summary-only | MUST HAVE | KSA-296 |
| 4 | As a system admin, I want auto-suggest sensitivity >80% accuracy | SHOULD HAVE | KSA-296 |
| 5 | As a system admin, I want admin UI for masking config | MUST HAVE | KSA-296 |
| 6 | As a compliance officer, I want audit trail for masking events | MUST HAVE | KSA-296 |
| 7 | As a system admin, I want allowlists to skip masking | SHOULD HAVE | KSA-296 |
| 8 | As a user, I want less than 5ms overhead per request | MUST HAVE | KSA-296 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** User or AI agent sends a KB read request (mem_search, mem_map, mem_crud read)

**Step 2:** The masking middleware intercepts the response before return

**Step 3:** For each content field, check if entry has a pre-classified sensitivity level

**Step 4:** If not classified, run auto-classification pipeline:
- Allowlist check (skip if allowlisted)
- Code block extraction (preserve code structure)
- PII pattern scan (regex: email, phone, IP, credit card, national ID)
- Credential pattern scan (API keys, JWT, passwords, connection strings, private keys)
- Business logic sensitivity scan (keyword heuristic + source/type classification)

**Step 5:** Apply masking based on sensitivity level and requester role:
- PUBLIC: no masking
- INTERNAL: mask PII for external users
- CONFIDENTIAL: summary-only for developers, full for admins
- RESTRICTED: fully masked for all non-admin users, credentials always masked

**Step 6:** Log masking event to audit trail

**Step 7:** Return masked response to caller

---

#### STORY 1: PII Auto-Masking

> As a system admin, I want PII (email, phone, IP, credit card) to be automatically masked for non-admin users so that sensitive personal data is protected.

**Requirement Details:**

1. Detect and mask PII patterns using regex:
   - Email addresses: `user@domain.com` -> `u***@d***.com`
   - Phone numbers: `+1-234-567-8901` -> `+1-***-***-8901`
   - IP addresses: `192.168.1.100` -> `192.168.*.*`
   - Credit card numbers: `4111-1111-1111-1111` -> `****-****-****-1111`
   - National ID / SSN: `123-45-6789` -> `***-**-6789`
2. Masking applied at READ time only
3. Admin users see unmasked content
4. Detection uses deterministic regex patterns

**Acceptance Criteria:**

1. Given a KB entry with email, when non-admin reads, then email is masked as `u***@d***.com`
2. Given a KB entry with phone, when non-admin reads, then phone masked preserving last 4 digits
3. Given a KB entry with IP, when non-admin reads, then last two octets masked
4. Given a KB entry with credit card, when non-admin reads, then only last 4 digits visible
5. Given a KB entry with PII, when admin reads, then content shown unmasked
6. Masking MUST NOT corrupt surrounding text or break markdown formatting

---

#### STORY 2: Credential Masking (Always-On)

> As a system admin, I want credentials always masked for all users so that secrets are never exposed via KB reads.

**Requirement Details:**

1. Detect and ALWAYS mask credentials regardless of user role:
   - API keys: `sk-`, `pk_`, `AKIA`, `ghp_`, `glpat-`
   - JWT tokens: `eyJ...` pattern
   - Passwords in config: `password=`, `secret=`, `token=`
   - Connection strings with credentials
   - Private keys: `-----BEGIN (RSA|EC|PRIVATE) KEY-----`
2. Even admin users see masked credentials in normal read mode
3. Admin can explicitly "reveal" with audit logging

**Acceptance Criteria:**

1. Given entry with API key `sk-abc123xyz`, when ANY user reads, then masked as `sk-***[REDACTED]`
2. Given entry with JWT, when ANY user reads, then masked as `eyJ***[REDACTED]`
3. Given entry with connection string containing password, when ANY user reads, then credentials masked
4. Given admin with explicit reveal request, then content shown and audit entry created
5. Credentials detected even when embedded in larger text blocks

---

#### STORY 3: Business Logic Sensitivity

> As a developer, I want business logic content marked CONFIDENTIAL to show only summaries so that proprietary algorithms are protected.

**Requirement Details:**

1. 3-tier detection system:
   - Pattern-based (deterministic): keyword detection for proprietary terms
   - Context-aware (heuristic): source file type, ingestion context
   - Source-based classification: entries from certain sources auto-classified
2. Sensitivity levels: PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED
3. Role-based read filtering:
   - Developers: summaries for CONFIDENTIAL
   - Admins: full content at all levels
   - External/guest: only PUBLIC

**Acceptance Criteria:**

1. Given CONFIDENTIAL entry, when developer reads, then only summary returned
2. Given PUBLIC entry, when any user reads, then full content returned
3. Given RESTRICTED entry, when non-admin reads, then entry hidden from results
4. Classification accuracy >80% vs admin manual review

---

#### STORY 4: Auto-Classification with Admin Oversight

> As a system admin, I want auto-suggest sensitivity levels with >80% accuracy.

**Requirement Details:**

1. Auto-classify on first read (or background job)
2. Classification uses: PII/credential detection, source-based rules, keyword heuristics
3. Stored as suggestion; admin confirms or overrides
4. Confirmed classification locked from re-classification

**Acceptance Criteria:**

1. New entry without classification -> auto-suggest on first read
2. Admin can confirm or change in admin UI
3. Confirmed entries skipped by re-classification
4. >80% accuracy over 100 sample entries

---

#### STORY 5: Admin Configuration UI

> As a system admin, I want admin UI for masking configuration.

**Requirement Details:**

1. New "Data Masking" page in Admin Portal (localhost:4572/admin)
2. Sections: Masking Rules, Sensitivity Levels, Allowlists, Classification Rules, Audit Log Viewer

**UI Specifications:**

| No. | Name | Type | Required | Description |
|-----|------|------|----------|-------------|
| 1 | Pattern toggle | Switch | Yes | Enable/disable each detection pattern |
| 2 | Custom regex input | Input | No | Override default regex |
| 3 | Sensitivity level matrix | Table | Yes | Role x Level permission grid |
| 4 | Allowlist entries | Table + Add/Remove | Yes | Entry IDs or patterns |
| 5 | Source rules table | Table + CRUD | Yes | Source -> level mapping |
| 6 | Audit log table | Table + Filters | Yes | Filterable masking events |

**Acceptance Criteria:**

1. Admin navigates to /admin/data-masking -> sees config page
2. Disabling email pattern -> email masking stops immediately
3. Adding entry ID to allowlist -> entry never masked
4. Changes take effect immediately without restart

---

#### STORY 6: Audit Trail

> As a compliance officer, I want all masking events logged.

**Requirement Details:**

1. Log: timestamp, entry ID, requester, patterns matched, action taken, sensitivity level
2. Stored in SQLite (separate table)
3. Retention: configurable, default 90 days
4. Queryable via admin UI and API

**Acceptance Criteria:**

1. Any masking event -> audit entry created with all fields
2. Admin filters by date range -> matching events shown
3. Entries older than retention -> auto-purged
4. Audit logging adds < 1ms to response time

---

#### STORY 7: Allowlist

> As a system admin, I want allowlists for known-safe content.

**Requirement Details:**

1. Supports: specific entry IDs, tag-based rules, source-based rules
2. Checked FIRST in pipeline (before detection)
3. Changes take effect immediately

**Acceptance Criteria:**

1. Entry ID in allowlist -> no masking applied
2. Tag-based rule -> matching entries skip masking
3. Entry removed from allowlist -> masking applies on next read

---

#### STORY 8: Performance Requirement

> As a user, I want less than 5ms masking overhead.

**Requirement Details:**

1. < 5ms for typical entries (< 10KB)
2. < 20ms for large entries (10-100KB)
3. Regex patterns pre-compiled and cached
4. No external service calls in masking hot path

**Acceptance Criteria:**

1. Typical entry (< 10KB) -> overhead < 5ms (p95)
2. Large entry (10-100KB) -> overhead < 20ms (p95)
3. 100 concurrent reads -> no degradation beyond limits

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Memory Module | System | N/A | KB read path supports middleware injection |
| Admin Portal | System | N/A | Existing admin UI at localhost:4572 |
| RBAC System | System | N/A | Role detection for masking decisions |
| SQLite Database | Infrastructure | N/A | Storage for config, audit, classifications |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Project Lead | Approve requirements, UAT |
| Developer | Dev Team | Implement masking middleware |
| System Admin | Ops Team | Configure masking rules |
| Compliance | Security Team | Verify audit trail |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| False positives (masking non-sensitive data) | Medium | Medium | Allowlist + admin override |
| Performance overhead > 5ms | High | Low | Pre-compiled regex, caching, benchmarks |
| Auto-classification < 80% accuracy | Medium | Medium | Human-in-the-loop confirmation |
| Masking breaks markdown/code formatting | Medium | Medium | Code block extraction step |

### 5.2 Assumptions

- Content primarily English text with code blocks
- Admin portal accessible only to authorized personnel
- Existing RBAC correctly identifies user roles
- SQLite sufficient for audit log volume (< 10K events/day)
- Read-time masking is sufficient (no write-time encryption needed)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | < 5ms overhead (p95) | For entries < 10KB |
| Performance | < 20ms overhead (p95) | For entries 10-100KB |
| Accuracy | > 80% auto-classification | Measured by admin review |
| Security | Credentials never exposed in normal reads | Even for admin users |
| Availability | Fail-open for non-credentials | Masking failure returns unmasked with warning |
| Scalability | 100 concurrent reads | Without degradation |
| Auditability | 90-day retention | Configurable |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-296 | KB Sensitive Data Masking - Read-time PII/Business Logic Redaction | In Progress | Task | Main ticket |

---

## 8. Appendix

### Sensitivity Level Matrix

| Level | Description | Developer Access | Admin Access | External Access |
|-------|-------------|-----------------|--------------|-----------------|
| PUBLIC | Non-sensitive | Full | Full | Full |
| INTERNAL | Contains PII | Masked PII | Full | Hidden |
| CONFIDENTIAL | Business-sensitive | Summary only | Full | Hidden |
| RESTRICTED | Credentials, secrets | Always masked | Masked (reveal+audit) | Hidden |

### Detection Pipeline

```
Content In -> Allowlist Check -> Code Block Extract -> PII Scan -> Credential Scan -> Business Scan -> Apply Masking -> Audit Log -> Return
```

### Masking Formats

| Data Type | Example Input | Masked Output |
|-----------|---------------|---------------|
| Email | user@example.com | u***@e***.com |
| Phone | +1-234-567-8901 | +1-***-***-8901 |
| IP Address | 192.168.1.100 | 192.168.*.* |
| Credit Card | 4111-1111-1111-1111 | ****-****-****-1111 |
| SSN | 123-45-6789 | ***-**-6789 |
| API Key | sk-abc123xyz789 | sk-***[REDACTED] |
| JWT | eyJhbGciOiJIUzI1... | eyJ***[REDACTED] |
| Connection String | postgres://user:pass@host | postgres://***:***@host |

### Glossary

| Term | Definition |
|------|------------|
| PII | Personally Identifiable Information |
| KB | Knowledge Base |
| Masking | Replacing sensitive content with redacted placeholders |
| Allowlist | Entries excluded from masking |
| Sensitivity Level | Classification (PUBLIC/INTERNAL/CONFIDENTIAL/RESTRICTED) |

![Use Case Diagram](diagrams/use-case.png)

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
