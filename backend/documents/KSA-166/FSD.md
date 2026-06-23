# Functional Specification Document (FSD)

## MCP Code Intelligence — KSA-166: [Security] SSRF + IDOR + Missing Auth Detection

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-166 |
| Title | [Security] SSRF + IDOR + Missing Auth Detection |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-07 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-166.docx |

---

## 1. Use Cases

### UC-166-01: Detect SSRF Vulnerabilities

**Actor:** Security Engineer / AI Agent

**Main Flow:**
1. User calls `detect_ssrf` (or `security_scan` with category="ssrf")
2. System identifies HTTP handlers (from KSA-162 entry points)
3. For each handler: extract request parameters (URL, hostname fields)
4. Run taint trace (KSA-164) from parameter to outbound HTTP calls
5. Check if taint path passes through URL validation/allowlist
6. If no validation found → report SSRF finding with trust-tier
7. Return findings with CWE-918, severity, remediation

**Alternative Flows:**
- 3a. No URL-like parameters found → skip handler
- 5a. URL validated against allowlist → mark as safe, skip
- 5b. Only path component used (not full URL) → mark as safe

### UC-166-02: Detect IDOR Vulnerabilities

**Actor:** Security Engineer / AI Agent

**Main Flow:**
1. User calls `detect_idor` (or `security_scan` with category="idor")
2. System identifies handlers with path/query parameters (e.g., `/users/:id`)
3. For each handler: trace parameter to database/storage lookup
4. Check if authorization check exists between parameter and lookup
5. If no authz check → report IDOR finding
6. Return findings with CWE-639, severity, missing check type

**Alternative Flows:**
- 3a. Parameter not used in DB lookup → skip (not IDOR-relevant)
- 4a. Ownership check found (obj.owner == user) → safe
- 4b. Role-based check found (@admin_required) → safe
- 4c. Handler is explicitly public (health, docs) → skip

### UC-166-03: Detect Missing Auth on REST Handlers

**Actor:** Security Engineer / AI Agent

**Main Flow:**
1. User calls `detect_missing_auth` (or `security_scan` with category="auth")
2. System groups handlers by controller/router
3. For each group: count handlers with auth middleware vs without
4. If >= 70% have auth but some don't → flag unprotected handlers
5. Return findings with CWE-862, which auth mechanism siblings use

**Alternative Flows:**
- 3a. All handlers have auth → no findings (fully protected)
- 3b. No handlers have auth → no findings (intentionally public API)
- 4a. Handler is known-public (login, register, health) → exclude from count

### UC-166-04: Combined Security Scan

**Actor:** Tech Lead

**Main Flow:**
1. User calls `security_scan` with categories=["ssrf", "idor", "auth"]
2. System runs all three detectors in sequence
3. Aggregate findings, deduplicate (same handler, multiple issues)
4. Apply trust-tier classification to all findings
5. Return combined report with summary

---

## 2. Business Rules

| ID | Rule | Rationale |
|----|------|-----------|
| BR-166-01 | SSRF: URL from request + outbound fetch without allowlist = finding | Core SSRF pattern |
| BR-166-02 | SSRF: Only path component from request (not full URL) = safe | Path-only can't reach internal hosts |
| BR-166-03 | IDOR: DB lookup with request param without authz = finding | Core IDOR pattern |
| BR-166-04 | IDOR: Admin-only endpoints are excluded | Admins have full access by design |
| BR-166-05 | Missing Auth: threshold = 70% of siblings have auth | Below 70% suggests intentionally mixed API |
| BR-166-06 | Missing Auth: login/register/health/docs endpoints excluded | Known-public endpoints |
| BR-166-07 | Trust-Tier T1 (Critical): direct user input → dangerous op | Highest confidence |
| BR-166-08 | Trust-Tier T2 (High): indirect path with some validation | Medium confidence |
| BR-166-09 | Trust-Tier T3 (Medium): multi-step indirect path | Lower confidence |
| BR-166-10 | Suppression markers honored (nosec, NOLINT) | Developer override |

---

## 3. Data Specifications

### 3.1 SSRF Sink Registry

| Language | Outbound HTTP Functions |
|----------|------------------------|
| Python | requests.get/post/put/delete, urllib.urlopen, httpx.get/post, aiohttp.ClientSession.get/post |
| TypeScript/JS | fetch, axios.get/post, http.request, got, node-fetch, undici.request |
| Kotlin/Java | HttpClient.send, RestTemplate.exchange/getForObject, OkHttpClient.newCall, WebClient.get |
| Go | http.Get, http.Post, http.NewRequest, resty.R().Get |
| Rust | reqwest::get, reqwest::Client::get, hyper::Client::get |

### 3.2 Authorization Check Patterns

| Pattern Type | Examples |
|-------------|----------|
| Decorator/Annotation | @login_required, @require_role, @PreAuthorize, @Secured |
| Middleware | authMiddleware, authenticate(), Depends(get_current_user) |
| Ownership Check | if obj.owner_id == current_user.id, if resource.user == user |
| Policy Check | authorize(user, :read, resource), can?(user, action) |
| Guard | AuthGuard, RoleGuard, PermissionGuard |

### 3.3 Finding Output Schema

```json
{
  "findings": [
    {
      "id": "SSRF-001",
      "type": "ssrf",
      "cwe": "CWE-918",
      "severity": "Critical",
      "trust_tier": "T1",
      "confidence": 92,
      "handler": {"file": "src/api/proxy.py", "function": "proxy_request", "line": 15},
      "source": {"expression": "request.args.get('url')", "line": 16},
      "sink": {"expression": "requests.get(target_url)", "line": 22},
      "path": [16, 18, 20, 22],
      "missing_control": "URL allowlist validation",
      "remediation": "Validate URL against allowlist before making outbound request",
      "suppressed": false
    }
  ],
  "summary": {
    "total": 3,
    "by_type": {"ssrf": 1, "idor": 1, "missing_auth": 1},
    "by_severity": {"Critical": 1, "High": 1, "Medium": 1}
  }
}
```

---

## 4. API Specifications

### 4.1 MCP Tool: `security_scan`

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| categories | string[] | No | Filter: ["ssrf", "idor", "auth"] (default: all) |
| file_path | string | No | Scope to specific file |
| min_confidence | integer | No | Minimum confidence (default: 50) |
| include_suppressed | boolean | No | Include suppressed findings (default: false) |

**Output:** Finding list + summary (see schema above)

### 4.2 MCP Tool: `detect_ssrf`

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file_path | string | No | Scope to specific file |
| include_indirect | boolean | No | Include T3 indirect paths (default: true) |

### 4.3 MCP Tool: `detect_idor`

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file_path | string | No | Scope to specific file |
| auth_patterns | string[] | No | Additional auth patterns to recognize |

### 4.4 MCP Tool: `detect_missing_auth`

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| threshold | float | No | Sibling auth percentage threshold (default: 0.7) |
| exclude_paths | string[] | No | Additional paths to exclude (e.g., "/api/public/") |

---

## 5. Processing Logic

### 5.1 SSRF Detection Algorithm

```
for each handler in entry_points:
  params = extract_url_params(handler)  # URL, hostname, endpoint params
  for param in params:
    taint_paths = taint_trace(source=param, sinks=SSRF_SINKS)
    for path in taint_paths:
      if not has_url_validation(path):
        tier = classify_trust_tier(path)
        report_finding(type="ssrf", cwe="CWE-918", tier=tier)
```

### 5.2 IDOR Detection Algorithm

```
for each handler in entry_points:
  id_params = extract_id_params(handler)  # path params, query params with "id" suffix
  for param in id_params:
    lookups = find_db_lookups_using(param)
    for lookup in lookups:
      if not has_authz_check_between(param, lookup):
        if not is_admin_only(handler) and not is_public(handler):
          report_finding(type="idor", cwe="CWE-639")
```

### 5.3 Missing Auth Detection Algorithm

```
for each controller_group in group_handlers_by_router():
  handlers_with_auth = [h for h in group if has_auth_middleware(h)]
  handlers_without_auth = [h for h in group if not has_auth_middleware(h)]
  
  if len(handlers_with_auth) / len(group) >= 0.7:
    for handler in handlers_without_auth:
      if not is_known_public(handler):
        report_finding(type="missing_auth", cwe="CWE-862",
                      sibling_auth=get_auth_type(handlers_with_auth[0]))
```

---

## 6. Non-Functional Requirements

| Category | Requirement | Metric |
|----------|-------------|--------|
| Performance | Single file scan | < 3s (all 3 detectors) |
| Performance | Full project scan | < 60s (100 files) |
| Accuracy | SSRF true positive | >= 75% for T1 findings |
| Accuracy | IDOR true positive | >= 65% |
| Accuracy | Missing auth precision | >= 80% |
| Extensibility | New auth patterns | Via config, no code change |

---

## 7. Error Handling

| Scenario | Severity | Behavior |
|----------|----------|----------|
| Taint trace timeout | Warning | Skip handler, report partial results |
| Unknown framework auth pattern | Info | Log for pattern registry update |
| No entry points found | Info | Return empty results, suggest KSA-162 |
| Circular taint path | Warning | Break cycle, report with lower confidence |

---

## 8. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | SSRF Detection Sequence | [sequence-ssrf.png](diagrams/sequence-ssrf.png) | [sequence-ssrf.drawio](diagrams/sequence-ssrf.drawio) |
| 3 | Detection State Machine | [state-detection.png](diagrams/state-detection.png) | [state-detection.drawio](diagrams/state-detection.drawio) |
