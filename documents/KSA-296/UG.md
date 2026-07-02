# User Guide — KB Sensitive Data Masking

## KSA-296: Read-time PII/Business Logic Redaction

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-296 |
| Version | 1.0 |
| Date | 2025-01-28 |

---

## 1. Overview

The KB Sensitive Data Masking system automatically detects and redacts sensitive data from Knowledge Base read responses at read-time based on the requester's role.

### Key Features
- PII Detection (email, phone, IP, credit card, SSN)
- Credential Masking (always-on for all users)
- Role-Based Access (Admin/Developer/User/External)
- Auto-Classification with admin confirmation
- Admin Configuration UI
- Audit Trail

---

## 2. Quick Start

The masking module is integrated into the backend Memory module. No separate install needed.

### 2.1 Database Migration

Run the migration to create masking tables:

```sql
-- Auto-runs on server start
-- File: backend/src/modules/memory/masking/db/migrations/001-masking-tables.sql
```

### 2.2 Verify

After server starts, call `mem_search(query: "test")`. Response includes `masking_applied` metadata.

---

## 3. Configuration

### 3.1 Sensitivity Levels

| Level | Developer | Admin | External |
|-------|-----------|-------|----------|
| PUBLIC | Full | Full | Full |
| INTERNAL | Masked PII | Full | Hidden |
| CONFIDENTIAL | Summary only | Full | Hidden |
| RESTRICTED | Hidden | Masked creds | Hidden |

### 3.2 Detection Patterns

| Pattern | Example Mask |
|---------|-------------|
| email | u***@e***.com |
| phone | +*-***-***-8901 |
| ip | 192.168.*.* |
| credit_card | ****-****-****-1111 |
| ssn | ***-**-6789 |
| api_key | sk-***[REDACTED] |
| jwt | eyJ***[REDACTED] |
| password | [REDACTED] |
| connection_string | postgres://***:***@host |
| private_key | [REDACTED_KEY] |

### 3.3 Admin API

- GET /api/admin/masking/config
- PUT /api/admin/masking/config/:type { enabled: true/false }

Changes take effect immediately.

---

## 4. Allowlist

Allowlisted entries bypass masking. Types: entry_id, tag, source, pattern.

- GET /api/admin/masking/allowlist
- POST /api/admin/masking/allowlist { rule_type, rule_value, description }
- DELETE /api/admin/masking/allowlist/:id

---

## 5. Auto-Classification

Entries auto-classified on first read. Admin confirms via:
- GET /api/admin/masking/classifications?status=pending
- PUT /api/admin/masking/classifications/:id { level, action: "confirm" }

---

## 6. Audit

All events logged. Query: GET /api/admin/masking/audit?from=&to=&entry_id=
Retention: 90 days (auto-purge).

---

## 7. Credential Reveal

Admin-only: `mem_search(query: "...", reveal: true)`. Creates audit trail.

---

## 8. Troubleshooting

| Issue | Solution |
|-------|----------|
| Not masking | Check pattern enabled in config |
| Over-masking | Add to allowlist |
| Slow (>5ms) | Check entry size |

---

## 9. Error Handling

- PII error: fail-open (unmasked)
- Credential error: fail-closed (block masked)
- Config error: use cached/defaults
- Audit error: non-blocking, continues

---

## 10. FAQ

- Masking is read-time only, stored content unchanged
- Code blocks never masked
- Auto-classification >80% accuracy target
