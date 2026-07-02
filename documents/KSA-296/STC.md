# Software Test Cases (STC)

## FEC Code Intelligence — KSA-296: KB Sensitive Data Masking - Read-time PII/Business Logic Redaction

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-296 |
| Title | KB Sensitive Data Masking - Test Cases |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-01-28 |
| Status | Draft |
| Related STP | STP-v1-KSA-296.docx |
| Related FSD | FSD-v1-KSA-296.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-28 | QA Agent | Initial test cases from FSD use cases and business rules |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| PBT — Property-Based Testing | PBT-001 to PBT-006 | 6 | High |
| UT — PII Detection | TC-001 to TC-011 | 11 | High |
| UT — Credential Detection | TC-012 to TC-018 | 7 | High |
| UT — Classification and Masking | TC-019 to TC-027 | 9 | High |
| IT — Full Pipeline Integration | TC-028 to TC-041 | 14 | High |
| E2E-API — Admin REST Endpoints | TC-042 to TC-053 | 12 | High |
| E2E-UI — Admin Config Page | TC-054 to TC-061 | 8 | Medium |
| SIT — Manual Exploratory | TC-062 to TC-065 | 4 | Medium |
| **Total** | | **71** | |

---

## 1. Property-Based Testing (PBT)

### PBT-001: Email Detection — Random Valid Emails Always Detected

| Field | Value |
|-------|-------|
| **Level** | PBT |
| **Priority** | High |
| **Requirement** | Story 1, BR-02 |
| **Property** | For any randomly generated valid email address embedded in text, PiiDetector MUST detect it |

**Generator:** `fc.emailAddress()` embedded in `fc.lorem()`
**Iterations:** 1000
**Property:** `detections.length >= 1 && detections[0].type === 'email'`

---

### PBT-002: Phone Detection — Random Valid Phones Always Detected

| Field | Value |
|-------|-------|
| **Level** | PBT |
| **Priority** | High |
| **Requirement** | Story 1, BR-02 |
| **Property** | For any randomly generated valid phone number, PiiDetector MUST detect it |

**Generator:** `fc.string().filter(isValidPhone)`
**Iterations:** 1000
**Property:** `detections.length >= 1 && detections[0].type === 'phone'`

---

### PBT-003: IP Address Detection — Random Valid IPs Always Detected

| Field | Value |
|-------|-------|
| **Level** | PBT |
| **Priority** | High |
| **Requirement** | Story 1, BR-02 |
| **Property** | For any valid IPv4 address, PiiDetector MUST detect it |

**Generator:** `fc.tuple(fc.nat(255), fc.nat(255), fc.nat(255), fc.nat(255)).map(t => t.join('.'))`
**Iterations:** 1000
**Property:** `detections.length >= 1 && detections[0].type === 'ip'`

---

### PBT-004: Credit Card Detection — Random Valid CC Numbers

| Field | Value |
|-------|-------|
| **Level** | PBT |
| **Priority** | High |
| **Requirement** | Story 1, BR-02 |
| **Property** | For any 16-digit number with separators, PiiDetector MUST detect it |

**Generator:** `fc.array(fc.nat(9999).map(pad4), {len:4}).map(a => a.join('-'))`
**Iterations:** 1000
**Property:** `detections.length >= 1 && detections[0].type === 'credit_card'`

---

### PBT-005: SSN Detection — Random Valid SSNs

| Field | Value |
|-------|-------|
| **Level** | PBT |
| **Priority** | High |
| **Requirement** | Story 1, BR-02 |
| **Property** | For any XXX-XX-XXXX pattern, PiiDetector MUST detect it |

**Generator:** `fc.tuple(fc.nat(999), fc.nat(99), fc.nat(9999)).map(format)`
**Iterations:** 1000
**Property:** `detections.length >= 1 && detections[0].type === 'ssn'`

---

### PBT-006: No False Positives on Clean Text

| Field | Value |
|-------|-------|
| **Level** | PBT |
| **Priority** | High |
| **Requirement** | BR-07 |
| **Property** | For random text WITHOUT PII patterns, PiiDetector returns empty |

**Generator:** `fc.lorem({ maxCount: 50 })` filtered to exclude PII-like patterns
**Iterations:** 1000
**Property:** `detections.length === 0`

---

## 2. Unit Tests — PII Detection

### TC-001: Detect Email in Plain Text

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 1, BR-02 |
| **Preconditions** | PiiDetector instantiated with default config |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call detect("Contact us at user@example.com for info") | Returns DetectionResult with type='email', match='user@example.com' |
| 2 | Verify mask format | Masked as 'u***@e***.com' |

**Test Data:** `"Contact us at user@example.com for info"`

---

### TC-002: Detect Multiple Emails in Same Content

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 1 |
| **Preconditions** | PiiDetector instantiated |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call detect("Email admin@corp.io or support@corp.io") | Returns 2 DetectionResult entries |
| 2 | Verify both detected | types=['email','email'] |

---

### TC-003: Email Not Detected in Code Block

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | BR-07, BR-08 |
| **Preconditions** | ContentMasker with code block extraction |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Input with code block containing email | Code block extracted before scan |
| 2 | PII detection on non-code text | No detections in code block |
| 3 | Restore code blocks | Original code block unchanged |

---

### TC-004: Detect Phone — International Format

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 1, BR-02 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | detect("Call +1-234-567-8901") | type='phone', match='+1-234-567-8901' |
| 2 | Verify mask | '+1-***-***-8901' |

---

### TC-005: Detect Phone — Parentheses Format

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 1 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | detect("Phone: (234) 567-8901") | type='phone' detected |

---

### TC-006: Detect IP Address

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 1, BR-02 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | detect("Server at 192.168.1.100") | type='ip', match='192.168.1.100' |
| 2 | Verify mask | '192.168.*.*' |

---

### TC-007: IP — No False Positive on Version Numbers

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | Medium |
| **Requirement** | BR-07 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | detect("node v18.0.0") | No detection |

---

### TC-008: Detect Credit Card — Dashes

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 1, BR-02 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | detect("Card: 4111-1111-1111-1111") | type='credit_card' |
| 2 | Verify mask | '****-****-****-1111' |

---

### TC-009: Detect Credit Card — Spaces

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 1 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | detect("4111 1111 1111 1111") | type='credit_card' |

---

### TC-010: Detect SSN

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 1, BR-02 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | detect("SSN: 123-45-6789") | type='ssn' |
| 2 | Verify mask | '***-**-6789' |

---

### TC-011: No PII in Clean Text

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | BR-07 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | detect("Normal text without PII") | Empty array |

---

## 3. Unit Tests — Credential Detection

### TC-012: Detect API Key — sk- Prefix

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 2, BR-01 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | detect("key: sk-abc123xyz789abcdefgh") | type='api_key' |
| 2 | Verify mask | 'sk-***[REDACTED]' |

---

### TC-013: Detect API Key — ghp_ (GitHub PAT)

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 2, BR-01 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | detect("ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") | type='api_key' |

---

### TC-014: Detect JWT Token

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 2, BR-01 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | detect("Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.x") | type='jwt' |
| 2 | Verify mask | 'eyJ***[REDACTED]' |

---

### TC-015: Detect Password in Config

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 2, BR-01 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | detect("password=MyS3cr3tP@ss") | type='password' |
| 2 | detect("secret: api_token_value") | type='password' |

---

### TC-016: Detect Connection String

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 2, BR-01 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | detect("postgres://admin:secret@db.host:5432/mydb") | type='connection_string' |
| 2 | Verify mask | 'postgres://***:***@db.host' |

---

### TC-017: Detect Private Key

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 2, BR-01 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | detect("-----BEGIN RSA PRIVATE KEY-----") | type='private_key' |
| 2 | Verify mask | '[REDACTED_KEY]' |

---

### TC-018: Credential Masked Even for Admin

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 2, BR-01 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | applyMasking(entry_with_cred, 'ADMIN', reveal=false) | Credential masked |
| 2 | Verify audit log | action='mask_credential' |

---

## 4. Unit Tests — Classification and Masking

### TC-019: Auto-Classify Entry with Credentials as RESTRICTED

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 4, BR-01 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | autoClassify(entry with API key) | level='RESTRICTED', confidence >= 0.95 |

---

### TC-020: Auto-Classify Entry with PII as INTERNAL

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 4 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | autoClassify(entry with email) | level='INTERNAL', confidence >= 0.9 |

---

### TC-021: Auto-Classify by Source Rule

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 4 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add source rule: source='internal-docs' -> CONFIDENTIAL | |
| 2 | autoClassify(entry with source='internal-docs') | level='CONFIDENTIAL', confidence=1.0 |

---

### TC-022: Business Keyword Scoring

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | Medium |
| **Requirement** | Story 3 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | autoClassify(entry with "proprietary algorithm") | level='CONFIDENTIAL' |

---

### TC-023: CONFIDENTIAL — Developer Sees Summary Only

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 3, BR-03 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | applyMasking(CONFIDENTIAL entry, 'DEVELOPER') | Summary only returned |

---

### TC-024: RESTRICTED — Hidden for Non-Admin

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | BR-04 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | applyMasking(RESTRICTED entry, 'DEVELOPER') | Entry hidden |
| 2 | applyMasking(RESTRICTED entry, 'EXTERNAL') | Entry hidden |

---

### TC-025: Admin Reveals Credential with Audit

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | UC-02, Story 2 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | applyMasking(entry_cred, 'ADMIN', reveal=true) | Full content |
| 2 | Check audit log | action='reveal' logged |

---

### TC-026: Allowlist Bypasses Masking

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | Story 7, BR-05 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add entry_id=42 to allowlist | |
| 2 | applyMasking(entry_id=42 with PII, 'DEV') | No masking |

---

### TC-027: Config Cache Invalidation

| Field | Value |
|-------|-------|
| **Level** | UT |
| **Priority** | High |
| **Requirement** | BR-09 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load config (from cache) | Cached version |
| 2 | Update config in DB, invalidate cache | |
| 3 | Load config again | Fresh from DB |

---

## 5. Integration Tests — Full Pipeline

### TC-028: Full Pipeline — mem_search with PII (Non-Admin)

| Field | Value |
|-------|-------|
| **Level** | IT |
| **Priority** | High |
| **Requirement** | UC-01, Story 1 |
| **Preconditions** | SQLite DB with masking tables, KB entry with email |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Insert KB entry: "Contact: user@test.com" | Stored |
| 2 | mem_search as DEVELOPER | Email masked: 'u***@t***.com' |
| 3 | Verify metadata | masking_applied=true |
| 4 | Verify audit | Entry created |

---

### TC-029: Full Pipeline — Credential Entry (Admin)

| Field | Value |
|-------|-------|
| **Level** | IT |
| **Priority** | High |
| **Requirement** | UC-01, Story 2, BR-01 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Insert entry: "api_key=sk-abc123xyz" | |
| 2 | mem_search ADMIN (no reveal) | Credential masked |
| 3 | mem_search ADMIN (reveal=true) | Visible + audit |

---

### TC-030: Allowlisted Entry Not Masked

| Field | Value |
|-------|-------|
| **Level** | IT |
| **Priority** | High |
| **Requirement** | Story 7, BR-05 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Insert entry with PII, add to allowlist | |
| 2 | mem_search as DEVELOPER | No masking |
| 3 | Verify audit action | 'skip_allowlist' |

---

### TC-031: CONFIDENTIAL Entry — Developer Gets Summary

| Field | Value |
|-------|-------|
| **Level** | IT |
| **Priority** | High |
| **Requirement** | Story 3, BR-03 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Entry classified CONFIDENTIAL | |
| 2 | DEVELOPER reads | Summary only |
| 3 | ADMIN reads | Full content |

---

### TC-032: RESTRICTED Entry — Hidden for Non-Admin

| Field | Value |
|-------|-------|
| **Level** | IT |
| **Priority** | High |
| **Requirement** | BR-04 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Entry classified RESTRICTED | |
| 2 | DEVELOPER search | Entry absent |
| 3 | ADMIN search | Entry present |

---

### TC-033: Config Toggle Immediate Effect

| Field | Value |
|-------|-------|
| **Level** | IT |
| **Priority** | High |
| **Requirement** | UC-03, BR-09 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Disable email pattern | |
| 2 | Read entry with email | Not masked |
| 3 | Re-enable email | |
| 4 | Read same entry | Masked |

---

### TC-034: Audit Log Query

| Field | Value |
|-------|-------|
| **Level** | IT |
| **Priority** | High |
| **Requirement** | Story 6 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Generate 10 events | |
| 2 | Query by date range | Filtered results |
| 3 | Query by entry_id | Matching only |

---

### TC-035: Audit Purge Expired

| Field | Value |
|-------|-------|
| **Level** | IT |
| **Priority** | Medium |
| **Requirement** | BR-10 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Insert old entries (>90 days) | |
| 2 | purgeExpired(90) | Old deleted |
| 3 | Recent entries remain | |

---

### TC-036: Classification Lock After Confirm

| Field | Value |
|-------|-------|
| **Level** | IT |
| **Priority** | High |
| **Requirement** | Story 4, UC-05 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Auto-classify entry | source='auto' |
| 2 | Admin confirms | source='manual' |
| 3 | Re-classify attempt | Skipped |

---

### TC-037: Multiple Patterns in Single Entry

| Field | Value |
|-------|-------|
| **Level** | IT |
| **Priority** | High |
| **Requirement** | Story 1, Story 2 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Entry: "user@test.com key sk-abc" | |
| 2 | Read as DEV | Both masked |
| 3 | Audit shows both patterns | |

---

### TC-038: Performance — Entry < 10KB in < 5ms

| Field | Value |
|-------|-------|
| **Level** | IT |
| **Priority** | High |
| **Requirement** | Story 8, BR-12 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Entry < 10KB with PII | |
| 2 | Measure 100 iterations | p95 < 5ms |

---

### TC-039: Performance — Entry 50KB in < 20ms

| Field | Value |
|-------|-------|
| **Level** | IT |
| **Priority** | High |
| **Requirement** | Story 8 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Entry 50KB with PII | |
| 2 | Measure 50 iterations | p95 < 20ms |

---

### TC-040: Fail-Open — PII Error Returns Unmasked

| Field | Value |
|-------|-------|
| **Level** | IT |
| **Priority** | High |
| **Requirement** | BR-11 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Break PII regex | |
| 2 | Read entry with PII | Unmasked (fail-open) |

---

### TC-041: Fail-Closed — Credential Error Masks Block

| Field | Value |
|-------|-------|
| **Level** | IT |
| **Priority** | High |
| **Requirement** | BR-11 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Break credential detection | |
| 2 | Read entry with credential | Block masked (fail-closed) |

---

## 6. E2E-API — Admin REST Endpoints

### TC-042: GET /api/admin/masking/config

| Field | Value |
|-------|-------|
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-03, FSD 6.1 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /api/admin/masking/config | 200 with patterns array (10 defaults) |

---

### TC-043: PUT /api/admin/masking/config/:type — Toggle

| Field | Value |
|-------|-------|
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-03, FSD 6.2 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | PUT email {enabled:false} | 200 |
| 2 | GET config | email.enabled=false |

---

### TC-044: GET /api/admin/masking/allowlist

| Field | Value |
|-------|-------|
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-04, FSD 6.3 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET /api/admin/masking/allowlist | 200 with rules |

---

### TC-045: POST /api/admin/masking/allowlist — Add

| Field | Value |
|-------|-------|
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-04, FSD 6.4 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST {rule_type:'tag', rule_value:'public'} | 201 |
| 2 | GET allowlist | New rule present |

---

### TC-046: DELETE /api/admin/masking/allowlist/:id

| Field | Value |
|-------|-------|
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-04, FSD 6.5 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | DELETE allowlist/1 | 204 |
| 2 | GET allowlist | Removed |

---

### TC-047: GET classifications?status=pending

| Field | Value |
|-------|-------|
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-05, FSD 6.6 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET ?status=pending | 200 with entries |

---

### TC-048: PUT classifications/:id — Confirm

| Field | Value |
|-------|-------|
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-05, FSD 6.7 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | PUT {level:'CONFIDENTIAL', action:'confirm'} | 200 |

---

### TC-049: GET /api/admin/masking/audit

| Field | Value |
|-------|-------|
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | Story 6, FSD 6.8 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET audit?from=2025-01-01 | 200 with events + pagination |

---

### TC-050: POST Allowlist — Invalid Type Rejected

| Field | Value |
|-------|-------|
| **Level** | E2E-API |
| **Priority** | Medium |
| **Requirement** | Validation |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST {rule_type:'invalid'} | 400 |

---

### TC-051: PUT Config — Nonexistent Type 404

| Field | Value |
|-------|-------|
| **Level** | E2E-API |
| **Priority** | Medium |
| **Requirement** | Validation |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | PUT /config/nonexistent | 404 |

---

### TC-052: Non-Admin Access — 403

| Field | Value |
|-------|-------|
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | Security |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | GET config as DEVELOPER | 403 |

---

### TC-053: 100 Concurrent Reads

| Field | Value |
|-------|-------|
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | Story 8 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | 100 parallel mem_search | All masked correctly, p95 < 5ms |

---

## 7. E2E-UI — Admin Config Page (Playwright)

### TC-054: Navigate to Data Masking Page

| Field | Value |
|-------|-------|
| **Level** | E2E-UI |
| **Priority** | High |
| **Requirement** | Story 5 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open localhost:4572/admin | Portal loads |
| 2 | Click Data Masking tab | Config page renders |

---

### TC-055: Toggle Pattern in UI

| Field | Value |
|-------|-------|
| **Level** | E2E-UI |
| **Priority** | High |
| **Requirement** | Story 5, UC-03 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click email toggle off | Switch changes |
| 2 | Verify API change | Pattern disabled |

---

### TC-056: Add Allowlist via UI

| Field | Value |
|-------|-------|
| **Level** | E2E-UI |
| **Priority** | High |
| **Requirement** | Story 5, UC-04 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click Add Rule | Form appears |
| 2 | Fill type=tag, value=public | |
| 3 | Save | Rule in table |

---

### TC-057: Remove Allowlist via UI

| Field | Value |
|-------|-------|
| **Level** | E2E-UI |
| **Priority** | High |
| **Requirement** | UC-04 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click delete on rule | Confirmation |
| 2 | Confirm | Rule removed |

---

### TC-058: View Audit Log

| Field | Value |
|-------|-------|
| **Level** | E2E-UI |
| **Priority** | Medium |
| **Requirement** | Story 6 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Audit section | Events table |
| 2 | Apply date filter | Filtered |

---

### TC-059: Confirm Classification

| Field | Value |
|-------|-------|
| **Level** | E2E-UI |
| **Priority** | High |
| **Requirement** | UC-05 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View pending entries | List shown |
| 2 | Click Confirm | Status locked |

---

### TC-060: Change Classification Level

| Field | Value |
|-------|-------|
| **Level** | E2E-UI |
| **Priority** | Medium |
| **Requirement** | UC-05 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select different level | Updated |
| 2 | Confirm | Saved |

---

### TC-061: Sensitivity Matrix Display

| Field | Value |
|-------|-------|
| **Level** | E2E-UI |
| **Priority** | Medium |
| **Requirement** | Story 5 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View matrix section | 4 levels x 4 roles visible |

---

## 8. SIT — Manual Exploratory

### TC-062: Masked Content Readability

| Field | Value |
|-------|-------|
| **Level** | SIT |
| **Priority** | Medium |
| **Requirement** | BR-07 |

**Steps:** Verify masked content is readable, markdown intact, code blocks unchanged.

---

### TC-063: Admin UI Overall UX

| Field | Value |
|-------|-------|
| **Level** | SIT |
| **Priority** | Medium |
| **Requirement** | Story 5 |

**Steps:** Complete full admin workflow. Verify intuitive, responsive.

---

### TC-064: Entry with Only Code Blocks

| Field | Value |
|-------|-------|
| **Level** | SIT |
| **Priority** | Medium |
| **Requirement** | BR-08 |

**Steps:** Entry 100% code — verify no masking inside code blocks.

---

### TC-065: Very Large Entry (100KB+)

| Field | Value |
|-------|-------|
| **Level** | SIT |
| **Priority** | Medium |
| **Requirement** | Story 8 |

**Steps:** Read 100KB entry, verify all PII masked, no corruption, acceptable time.

---

## Appendix

### Test Data Files

| File | Purpose |
|------|---------|
| testdata/pii-samples.csv | Email, phone, IP, CC, SSN vectors |
| testdata/credential-samples.csv | API keys, JWTs, passwords |
| testdata/clean-content.csv | False positive verification |
| testdata/mixed-content.csv | PII in code blocks |

### Diagram Index

| # | Diagram | Image | Source |
|---|---------|-------|--------|
| 1 | Test Coverage | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
