# Software Test Cases (STC)

## Kiro Chatbox — KSA-297: Internet/Network Tools

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-297 |
| Title | Internet/Network Tools — Test Cases |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-07-03 |
| Status | Draft |
| Related STP | STP-v1-KSA-297.docx |
| Related FSD | FSD-v1-KSA-297.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-03 | QA Agent | Initial STC — 124 test cases across 5 levels |

---

## Test Case Summary

| Level | ID Range | Count | Automation |
|-------|----------|-------|------------|
| PBT (Property-Based) | PBT-001 to PBT-012 | 12 | 100% |
| Unit Testing | UT-001 to UT-048 | 48 | 100% |
| Integration Testing | IT-001 to IT-032 | 32 | 100% |
| E2E-API Testing | E2E-001 to E2E-024 | 24 | 100% |
| System Integration (SIT) | SIT-001 to SIT-008 | 8 | 30% |
| **Total** | | **124** | **~95%** |

---

## 1. Property-Based Tests (PBT)

### PBT-001: SSRF Guard — All RFC1918 IPs Blocked

| Field | Value |
|-------|-------|
| **ID** | PBT-001 |
| **Priority** | Critical |
| **Level** | PBT |
| **Requirement** | BR-1, Story 7, AC7 |
| **Tool** | fast-check + Vitest |

**Property:** For any randomly generated IP in ranges 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16 — `ssrfGuard.isBlocked(ip)` returns `true`.

**Generator:** `fc.ipV4()` filtered to private ranges

---

### PBT-002: SSRF Guard — All Public IPs Allowed

| Field | Value |
|-------|-------|
| **ID** | PBT-002 |
| **Priority** | Critical |
| **Level** | PBT |
| **Requirement** | BR-1, Story 7 |

**Property:** For any randomly generated public IP — `ssrfGuard.isBlocked(ip)` returns `false`.

---

### PBT-003: Rate Limiter — Never Exceeds Max Tokens

| Field | Value |
|-------|-------|
| **ID** | PBT-003 |
| **Priority** | High |
| **Level** | PBT |
| **Requirement** | BR-2, Story 8 |

**Property:** After any sequence of consume/refill operations, `bucket.tokens` is in `[0, maxTokens]`.

---

### PBT-004: Rate Limiter — Refill Never Exceeds Capacity

| Field | Value |
|-------|-------|
| **ID** | PBT-004 |
| **Priority** | High |
| **Level** | PBT |
| **Requirement** | BR-2 |

**Property:** After any wait duration, tokens never exceed maxTokens.

---

### PBT-005: URL Validator — Rejects All Non-HTTP Protocols

| Field | Value |
|-------|-------|
| **ID** | PBT-005 |
| **Priority** | Critical |
| **Level** | PBT |
| **Requirement** | BR-7 |

**Property:** Any URL with protocol not http/https throws INVALID_URL.

---

### PBT-006: Content Truncator — Output Never Exceeds Limit

| Field | Value |
|-------|-------|
| **ID** | PBT-006 |
| **Priority** | High |
| **Level** | PBT |
| **Requirement** | BR-3 |

**Property:** `truncate(input, maxSize).length <= maxSize` for all inputs.

---

### PBT-007: Git URL Parser — Roundtrip Valid GitHub URLs

| Field | Value |
|-------|-------|
| **ID** | PBT-007 |
| **Priority** | Medium |
| **Level** | PBT |
| **Requirement** | UC-3 |

**Property:** parseGitUrl for valid owner/repo extracts correct components.

---

### PBT-008: HTML Extractor — Output Contains No Tags

| Field | Value |
|-------|-------|
| **ID** | PBT-008 |
| **Priority** | Medium |
| **Level** | PBT |
| **Requirement** | UC-1 |

**Property:** `toText(html)` output contains no `<` or `>` characters.

---

### PBT-009: SSRF Guard — IPv6 Private Ranges Blocked

| Field | Value |
|-------|-------|
| **ID** | PBT-009 |
| **Priority** | Critical |
| **Level** | PBT |
| **Requirement** | BR-1, AC7 |

**Property:** `::1` and fc00::/7 always blocked.

---

### PBT-010: Redirect — Max 5 Hops Enforced

| Field | Value |
|-------|-------|
| **ID** | PBT-010 |
| **Priority** | High |
| **Level** | PBT |
| **Requirement** | BR-6 |

**Property:** Chain length > 5 always terminates with error.

---

### PBT-011: Token Bucket — Monotonic Depletion

| Field | Value |
|-------|-------|
| **ID** | PBT-011 |
| **Priority** | Medium |
| **Level** | PBT |
| **Requirement** | BR-2 |

**Property:** Without refill, consecutive consume() strictly decrease until 0.

---

### PBT-012: Download — Extension Blocklist

| Field | Value |
|-------|-------|
| **ID** | PBT-012 |
| **Priority** | High |
| **Level** | PBT |
| **Requirement** | BR-8 |

**Property:** Any filename ending in blocked extensions is rejected (case-insensitive).

---

## 2. Unit Tests (UT)

### SSRF Guard (UT-001 to UT-010)

| ID | Title | Requirement | Input | Expected |
|----|-------|-------------|-------|----------|
| UT-001 | Block 127.0.0.1 | BR-1 | `http://127.0.0.1/path` | SSRF_BLOCKED |
| UT-002 | Block 10.x.x.x | BR-1 | `http://10.0.0.1/api` | SSRF_BLOCKED |
| UT-003 | Block 172.16.x.x | BR-1 | `http://172.16.0.1/` | SSRF_BLOCKED |
| UT-004 | Block 192.168.x.x | BR-1 | `http://192.168.1.1/` | SSRF_BLOCKED |
| UT-005 | Block 169.254.x.x | BR-1 | `http://169.254.1.1/` | SSRF_BLOCKED |
| UT-006 | Block ::1 IPv6 | BR-1 | `http://[::1]/` | SSRF_BLOCKED |
| UT-007 | Block fc00::/7 | BR-1 | `http://[fd00::1]/` | SSRF_BLOCKED |
| UT-008 | Allow public IP | BR-1 | `http://8.8.8.8/` | Pass |
| UT-009 | Reject file:// | BR-7 | `file:///etc/passwd` | INVALID_URL |
| UT-010 | Reject ftp:// | BR-7 | `ftp://server.com/file` | INVALID_URL |

### Rate Limiter (UT-011 to UT-018)

| ID | Title | Requirement | Input | Expected |
|----|-------|-------------|-------|----------|
| UT-011 | Allow first request | BR-2 | consume() full bucket | allowed:true, remaining:9 |
| UT-012 | Allow 10 requests | BR-2 | 10x consume() | All allowed:true |
| UT-013 | Block 11th request | BR-2 | 11th consume() | allowed:false, resetMs>0 |
| UT-014 | Refill after time | BR-2 | Wait 6s, consume | allowed:true |
| UT-015 | Per-tool isolation | BR-2 | Exhaust tool A, try tool B | B allowed |
| UT-016 | Reset time calc | BR-2 | Exhaust, check resetMs | Correct ms value |
| UT-017 | Burst allowed | BR-2 | 10 rapid from full | All pass |
| UT-018 | Partial refill capped | BR-2 | Use 5, wait 30s | tokens=10 (capped) |

### URL Validator (UT-019 to UT-024)

| ID | Title | Requirement | Input | Expected |
|----|-------|-------------|-------|----------|
| UT-019 | Valid HTTP | UC-1 | `http://example.com` | Valid |
| UT-020 | Valid HTTPS | UC-1 | `https://example.com/path` | Valid |
| UT-021 | No protocol | UC-1 | `example.com` | INVALID_URL |
| UT-022 | Empty string | UC-1 | `` | INVALID_URL |
| UT-023 | URL with port | UC-1 | `http://example.com:8080/` | Valid |
| UT-024 | javascript: proto | BR-7 | `javascript:alert(1)` | INVALID_URL |

### HTML Extractor (UT-025 to UT-030)

| ID | Title | Requirement | Input | Expected |
|----|-------|-------------|-------|----------|
| UT-025 | Strip tags | UC-1 | `<p>Hello <b>world</b></p>` | `Hello world` |
| UT-026 | CSS selector | UC-1 AF-1.2 | HTML + `.main` selector | .main content only |
| UT-027 | Empty HTML | UC-1 | `` | `` |
| UT-028 | Strip scripts | UC-1 | `<script>...</script>Text` | `Text` |
| UT-029 | Preserve whitespace | UC-1 | `<p>L1</p><p>L2</p>` | `L1\nL2` |
| UT-030 | Malformed HTML | UC-1 | `<p>Unclosed` | `Unclosed` |

### Git URL Parser (UT-031 to UT-036)

| ID | Title | Requirement | Input | Expected |
|----|-------|-------------|-------|----------|
| UT-031 | GitHub URL | UC-3 | `https://github.com/octocat/Hello-World` | owner:octocat, repo:Hello-World |
| UT-032 | GitLab URL | UC-3 | `https://gitlab.com/group/project` | owner:group, repo:project |
| UT-033 | .git suffix | UC-3 | `https://github.com/u/repo.git` | repo:repo (no .git) |
| UT-034 | With file path | UC-3 | `.../blob/main/file.ts` | path:file.ts, ref:main |
| UT-035 | Invalid URL | UC-3 EF-3.1 | `not-a-url` | Error |
| UT-036 | Unsupported host | UC-3 | `https://bitbucket.org/u/r` | Error/unsupported |

### Content Truncator (UT-037 to UT-040)

| ID | Title | Requirement | Input | Expected |
|----|-------|-------------|-------|----------|
| UT-037 | No truncation | BR-3 | 50KB, limit 100KB | Full, truncated=false |
| UT-038 | Truncate at limit | BR-3 | 150KB, limit 100KB | 100KB, truncated=true |
| UT-039 | Exact limit | BR-3 | 100KB, limit 100KB | Full, truncated=false |
| UT-040 | Custom max_length | UC-1 AF-1.1 | 10KB, max=5000 | 5000 chars |

### WebModule Lifecycle (UT-041 to UT-044)

| ID | Title | Requirement | Input | Expected |
|----|-------|-------------|-------|----------|
| UT-041 | Init sets ready | TDD 2.1 | initialize() | status='ready' |
| UT-042 | Shutdown closes browser | TDD 2.1 | shutdown() | browser.close() called |
| UT-043 | 6 tools registered | TDD 3.1 | getToolDefinitions() | 6 tools, category='web' |
| UT-044 | Default config | TDD 6 | No env vars | Default values |

### Error Handling (UT-045 to UT-048)

| ID | Title | Requirement | Input | Expected |
|----|-------|-------------|-------|----------|
| UT-045 | Error structure | TDD 5 | WebToolError('SSRF_BLOCKED') | code+message+isError |
| UT-046 | Timeout error | FSD EF-1.3 | 30s timeout | TIMEOUT code |
| UT-047 | DNS failure | FSD EF-1.6 | Bad hostname | DNS_FAILED code |
| UT-048 | Too large metadata | FSD EF-1.4 | 150KB response | truncated=true |

---

## 3. Integration Tests (IT)

### FetchUrlHandler Pipeline (IT-001 to IT-006)

| ID | Title | Requirement | Setup | Expected |
|----|-------|-------------|-------|----------|
| IT-001 | Fetch full mode | UC-1 | msw 200+HTML | Content+metadata |
| IT-002 | Fetch truncated | UC-1 AF-1.1 | msw 200, max=100 | 100 chars |
| IT-003 | Fetch selective | UC-1 AF-1.2 | msw HTML+.target | .target only |
| IT-004 | Fetch redirect | UC-1 AF-1.4 | msw 301->200 | Final content |
| IT-005 | Fetch SSRF | UC-1 EF-1.1 | Resolve to 127.0.0.1 | SSRF_BLOCKED |
| IT-006 | Fetch rate limit | UC-1 EF-1.2 | Exhaust bucket | RATE_LIMITED |

### WebSearchHandler Pipeline (IT-007 to IT-012)

| ID | Title | Requirement | Setup | Expected |
|----|-------|-------------|-------|----------|
| IT-007 | Search OK | UC-2 | msw SearXNG JSON | Results array |
| IT-008 | Search fallback | UC-2 AF-2.1 | SearXNG 500+DDG OK | DDG results |
| IT-009 | Search all down | UC-2 EF-2.1 | Both 500 | Service unavailable |
| IT-010 | Search empty query | UC-2 EF-2.3 | query="" | Error |
| IT-011 | Search rate limit | UC-2 EF-2.2 | Exhaust bucket | RATE_LIMITED |
| IT-012 | Search category | UC-2 | category="code" | Correct param |

### GitBrowseHandler Pipeline (IT-013 to IT-018)

| ID | Title | Requirement | Setup | Expected |
|----|-------|-------------|-------|----------|
| IT-013 | Git tree | UC-3 (tree) | msw GitHub tree | File list |
| IT-014 | Git read file | UC-3 (read) | msw contents | File content |
| IT-015 | Git readme | UC-3 (readme) | msw readme | README text |
| IT-016 | Git 404 | UC-3 EF-3.2 | msw 404 | Not found error |
| IT-017 | Git file>1MB | UC-3 EF-3.3 | msw size>1MB | Too large error |
| IT-018 | Git GitLab | UC-3 | GitLab URL | GitLab API used |

### DownloadFileHandler Pipeline (IT-019 to IT-024)

| ID | Title | Requirement | Setup | Expected |
|----|-------|-------------|-------|----------|
| IT-019 | Download OK | UC-4 | msw 10KB file | Saved+path |
| IT-020 | Download >50MB | UC-4 EF-4.1 | 60MB header | Too large |
| IT-021 | Download .exe | UC-4 EF-4.2 | URL .exe | Blocked type |
| IT-022 | Download SSRF | UC-4 EF-4.3 | Internal IP | SSRF_BLOCKED |
| IT-023 | Download path escape | UC-4 EF-4.5 | ../../etc | Path error |
| IT-024 | Download auto name | UC-4 | Content-Disposition | Correct name |

### ApiCallHandler Pipeline (IT-025 to IT-030)

| ID | Title | Requirement | Setup | Expected |
|----|-------|-------------|-------|----------|
| IT-025 | API GET 200 | UC-5 | msw JSON | status+body |
| IT-026 | API POST body | UC-5 | msw POST 201 | Body sent |
| IT-027 | API headers | UC-5 | Auth header | Forwarded |
| IT-028 | API SSRF | UC-5 EF-5.2 | Internal IP | SSRF_BLOCKED |
| IT-029 | API timeout | UC-5 EF-5.3 | msw delay 35s | TIMEOUT |
| IT-030 | API bad method | UC-5 EF-5.1 | "INVALID" | Error |

### ReadWebpageHandler Pipeline (IT-031 to IT-032)

| ID | Title | Requirement | Setup | Expected |
|----|-------|-------------|-------|----------|
| IT-031 | Render OK | UC-6 | Mock Playwright | Text content |
| IT-032 | Render SSRF | UC-6 EF-6.1 | Internal IP | SSRF_BLOCKED |

---

## 4. E2E-API Tests (via MCP Tool Call)

### fetch_url E2E (E2E-001 to E2E-004)

| ID | Title | Requirement | Action | Expected |
|----|-------|-------------|--------|----------|
| E2E-001 | fetch_url full | UC-1 AC1 | MCP fetch_url to local server | Content <10s |
| E2E-002 | fetch_url truncated | UC-1 AC3 | mode:truncated, max:200 | 200 chars |
| E2E-003 | fetch_url selective | UC-1 AC4 | mode:selective, selector:h1 | h1 text |
| E2E-004 | fetch_url metadata | UC-1 AC5 | fetch_url any URL | All metadata fields |

### web_search E2E (E2E-005 to E2E-008)

| ID | Title | Requirement | Action | Expected |
|----|-------|-------------|--------|----------|
| E2E-005 | search basic | UC-2 AC2 | query:"test" | 5 results |
| E2E-006 | search num_results | UC-2 | num_results:3 | 3 results |
| E2E-007 | search category | UC-2 | category:"code" | Results OK |
| E2E-008 | search timing | UC-2 AC3 | Measure | <5s |

### git_clone_browse E2E (E2E-009 to E2E-012)

| ID | Title | Requirement | Action | Expected |
|----|-------|-------------|--------|----------|
| E2E-009 | git tree | UC-3 AC3 | operation:tree | File list |
| E2E-010 | git read_file | UC-3 AC5 | operation:read_file | Content |
| E2E-011 | git readme | UC-3 AC1 | operation:readme | README |
| E2E-012 | git with ref | UC-3 | ref:"v1.0" | Tag content |

### download_file E2E (E2E-013 to E2E-016)

| ID | Title | Requirement | Action | Expected |
|----|-------|-------------|--------|----------|
| E2E-013 | download OK | UC-4 AC1 | dest_path:tmp/test.pdf | File exists |
| E2E-014 | download size | UC-4 AC5 | Any URL | Size matches |
| E2E-015 | download blocked | UC-4 AC3 | .exe URL | Error |
| E2E-016 | download type | UC-4 AC6 | Any URL | content_type |

### api_call E2E (E2E-017 to E2E-020)

| ID | Title | Requirement | Action | Expected |
|----|-------|-------------|--------|----------|
| E2E-017 | API GET | UC-5 AC1 | method:GET | Full response |
| E2E-018 | API POST | UC-5 AC2 | POST+body | Body echoed |
| E2E-019 | API auth | UC-5 AC6 | Bearer token | Received |
| E2E-020 | API error | UC-5 AC5 | Unreachable | Error msg |

### read_webpage E2E (E2E-021 to E2E-024)

| ID | Title | Requirement | Action | Expected |
|----|-------|-------------|--------|----------|
| E2E-021 | Render JS | UC-6 AC1 | SPA URL | Text content |
| E2E-022 | Render wait | UC-6 AC3 | networkidle | Full content |
| E2E-023 | Render blocking | UC-6 AC4 | block images | Faster |
| E2E-024 | Render selector | UC-6 AC5 | selector:.content | Subset |

---

## 5. System Integration Tests (SIT)

| ID | Title | Req | Environment | Expected |
|----|-------|-----|-------------|----------|
| SIT-001 | Fetch real website | UC-1 | Internet | HTML content returned |
| SIT-002 | Search real query | UC-2 | SearXNG/DDG | Real search results |
| SIT-003 | Browse GitHub repo | UC-3 | GitHub API | Real tree listing |
| SIT-004 | Download real file | UC-4 | Internet | File saved correctly |
| SIT-005 | API call httpbin | UC-5 | Internet | Echo response |
| SIT-006 | Render JS page | UC-6 | Playwright | Rendered text |
| SIT-007 | SSRF blocked live | BR-1 | Local | Request blocked |
| SIT-008 | Rate limit live | BR-2 | Local | 11th request blocked |

---

## 6. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Status |
|-------------|--------|------------|--------|
| UC-1 fetch_url | FSD 2.1 | PBT-005,6,8,10; UT-019-030,037-040; IT-001-006; E2E-001-004; SIT-001 | Covered |
| UC-2 web_search | FSD 2.2 | UT-011-018; IT-007-012; E2E-005-008; SIT-002 | Covered |
| UC-3 git_browse | FSD 2.3 | PBT-007; UT-031-036; IT-013-018; E2E-009-012; SIT-003 | Covered |
| UC-4 download | FSD 2.4 | PBT-012; UT-037-040; IT-019-024; E2E-013-016; SIT-004 | Covered |
| UC-5 api_call | FSD 2.5 | UT-019-024; IT-025-030; E2E-017-020; SIT-005 | Covered |
| UC-6 read_webpage | FSD 2.6 | IT-031-032; E2E-021-024; SIT-006 | Covered |
| BR-1 SSRF | FSD 3 | PBT-001,2,9; UT-001-010; IT-005,22,28,32; SIT-007 | Covered |
| BR-2 Rate limit | FSD 3 | PBT-003,4,11; UT-011-018; IT-006,11; SIT-008 | Covered |
| BR-3 100KB | FSD 3 | PBT-006; UT-037-040; IT-001 | Covered |
| BR-4 50MB | FSD 3 | IT-020; E2E-014 | Covered |
| BR-5 Timeout | FSD 3 | UT-046; IT-029 | Covered |
| BR-6 Redirects | FSD 3 | PBT-010; IT-004 | Covered |
| BR-7 Protocol | FSD 3 | PBT-005; UT-009,010,024 | Covered |
| BR-8 Extensions | FSD 3 | PBT-012; IT-021; E2E-015 | Covered |
| BR-9 Browsers | FSD 3 | UT-042; IT-031 | Covered |
| BR-10 Untrusted | FSD 3 | UT-025-030 | Covered |
| Story 7 SSRF ACs | BRD | PBT-001,2,9; UT-001-010 | Covered |
| Story 8 Rate ACs | BRD | PBT-003,4; UT-011-018 | Covered |

**Coverage Summary:**

| Category | Total | Covered | % |
|----------|-------|---------|---|
| Use Cases | 6 | 6 | 100% |
| Business Rules | 10 | 10 | 100% |
| User Stories | 8 | 8 | 100% |
| Error Codes | 8 | 8 | 100% |
| **Overall** | **32** | **32** | **100%** |

---

## 7. Test Data Files

| File | Purpose |
|------|---------|
| testdata/ssrf-ips.csv | SSRF test IPs |
| testdata/search-queries.csv | Search queries |
| testdata/git-repos.csv | Git repo URLs |
| testdata/download-urls.csv | Download URLs |
| testdata/api-endpoints.csv | API endpoints |

---

## 8. Test File Structure

```
backend/src/modules/web/__tests__/
├── pbt/
│   ├── ssrf-guard.pbt.test.ts
│   ├── rate-limiter.pbt.test.ts
│   └── validators.pbt.test.ts
├── unit/
│   ├── SsrfGuard.test.ts
│   ├── RateLimiter.test.ts
│   ├── UrlValidator.test.ts
│   ├── HtmlExtractor.test.ts
│   ├── GitUrlParser.test.ts
│   ├── ContentTruncator.test.ts
│   └── WebModule.test.ts
├── integration/
│   ├── FetchUrlHandler.it.test.ts
│   ├── WebSearchHandler.it.test.ts
│   ├── GitBrowseHandler.it.test.ts
│   ├── DownloadFileHandler.it.test.ts
│   ├── ApiCallHandler.it.test.ts
│   └── ReadWebpageHandler.it.test.ts
└── e2e/
    ├── web-tools.e2e.test.ts
    └── helpers/test-http-server.ts
```
