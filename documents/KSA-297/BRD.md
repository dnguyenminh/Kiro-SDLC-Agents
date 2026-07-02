# Business Requirements Document (BRD)

## Kiro Chatbox — KSA-297: Internet/Network Tools (fetch_url, web_search, git_browse, download_file, api_call, read_webpage)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-297 |
| Title | Chatbox Internet/Network Tools |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-07-03 |
| Status | Draft |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-03 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-297 |

---

## 1. Introduction

### 1.1 Scope

Mở rộng khả năng của Chatbox LangGraph bằng cách thêm 6 Internet/Network tools mới. Hiện tại chatbox chỉ có local tools (read_file, write_file, search_text, list_directory, get_diagnostics, get_open_files). Sau khi hoàn thành, chatbox có thể truy cập internet, fetch URLs, tìm kiếm web, browse Git repositories, download files, gọi REST APIs, và render JavaScript pages.

Các tools được implement trong backend server tại `backend/src/modules/web/WebModule.ts` và chatbox truy cập qua MCP bridge (cùng pattern với các backend tools hiện tại).

### 1.2 Out of Scope

- WebSocket / real-time streaming connections
- Authenticated browsing sessions (OAuth flows, login pages)
- Crawling / spidering (chỉ single-page fetch)
- File upload to external services
- Proxy configuration
- Browser automation beyond content extraction (form filling, clicking)

### 1.3 Preliminary Requirements

- Backend server đã chạy với ModuleRegistry pattern
- Playwright đã có trong backend dependencies
- MCP bridge giữa chatbox LangGraph và backend tools đã hoạt động
- SearXNG hoặc DuckDuckGo search API available (hoặc fallback)

---

## 2. Business Requirements

### 2.1 High Level Process Map

Chatbox LangGraph agent nhận user request → Xác định cần tool nào → Gọi tool qua MCP bridge → Backend WebModule xử lý HTTP request/browser rendering → Trả kết quả về cho agent → Agent tổng hợp trả user.

**Security flow:** Mỗi request → SSRF check (blocklist internal IPs) → Rate limit check (10 req/min) → Timeout enforcement (30s) → Size limit (100KB response) → Return sanitized content.

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | Fetch URL content | MUST HAVE | KSA-297 |
| 2 | Web search | MUST HAVE | KSA-297 |
| 3 | Browse Git repository | SHOULD HAVE | KSA-297 |
| 4 | Download file to workspace | SHOULD HAVE | KSA-297 |
| 5 | Make API calls | MUST HAVE | KSA-297 |
| 6 | Render JavaScript pages | COULD HAVE | KSA-297 |
| 7 | SSRF Protection | MUST HAVE | KSA-297 |
| 8 | Rate Limiting | MUST HAVE | KSA-297 |

---

### 2.3 Details of User Stories

---

#### Business Flow

![Business Flow](diagrams/business-flow.png)

**Step 1:** User gửi message trong chatbox yêu cầu thông tin từ internet (e.g., "Đọc README của repo này", "Fetch API docs tại URL này")

**Step 2:** LangGraph agent phân tích request và quyết định tool phù hợp (fetch_url, web_search, etc.)

**Step 3:** Agent gọi tool qua MCP bridge → request chuyển đến backend WebModule

**Step 4:** WebModule thực hiện security checks (SSRF blocklist, rate limit)

**Step 5:** Nếu pass security → thực hiện request (HTTP fetch / browser render / Git API call)

**Step 6:** Kết quả được truncate/sanitize theo size limit (100KB max)

**Step 7:** Response trả về agent qua MCP bridge

**Step 8:** Agent tổng hợp thông tin và trả lời user

---

#### STORY 1: Fetch URL Content (fetch_url)

> As a developer using the chatbox, I want to fetch content from any public URL so that I can read documentation, API responses, or web page content without leaving the IDE.

**Requirement Details:**

1. Tool nhận URL và trả về text content (HTML rendered to text, JSON, hoặc plain text)
2. Hỗ trợ 3 modes: `full` (toàn bộ content), `truncated` (first N chars), `selective` (CSS selector extract)
3. Maximum response size: 100KB
4. Timeout: 30 giây
5. Follow redirects (max 5 hops)
6. Proper User-Agent header

**Acceptance Criteria:**

1. AC1: fetch_url trả về text content từ bất kỳ public URL trong vòng 10 giây
2. Hỗ trợ mode `full` — trả toàn bộ content (truncate tại 100KB)
3. Hỗ trợ mode `truncated` — trả N ký tự đầu (user-specified limit)
4. Hỗ trợ mode `selective` — extract content theo CSS selector
5. Trả metadata: status_code, content_type, content_length, title (nếu HTML)
6. Timeout sau 30s nếu URL không respond
7. Reject internal IPs (SSRF protection)

---

#### STORY 2: Web Search (web_search)

> As a developer using the chatbox, I want to search the internet so that I can find documentation, solutions, and references relevant to my coding task.

**Requirement Details:**

1. Tìm kiếm internet bằng SearXNG hoặc DuckDuckGo API
2. Trả về top 5 results gồm: title, url, snippet
3. Hỗ trợ language/region filter (optional)
4. Có thể search theo category: general, code, documentation

**Acceptance Criteria:**

1. AC2: web_search trả về top 5 results với title/url/snippet
2. Results relevant và up-to-date
3. Response time < 5 giây
4. Graceful error nếu search engine unavailable
5. Sanitize results (no tracking URLs)

---

#### STORY 3: Browse Git Repository (git_clone_browse)

> As a developer, I want to browse GitHub/GitLab repositories without cloning them locally so that I can quickly check code structure, read files, and view READMEs.

**Requirement Details:**

1. Browse GitHub/GitLab repo via REST API (không cần full git clone)
2. Operations: list tree (directory structure), read single file, get README
3. Hỗ trợ cả public repos và private repos (nếu có token)
4. Hỗ trợ specific branch/tag/commit reference
5. File size limit: 1MB per file read

**Acceptance Criteria:**

1. AC3: git_clone_browse list được tree của repo và đọc individual files
2. Hỗ trợ GitHub repos (github.com)
3. Hỗ trợ GitLab repos (gitlab.com)
4. Trả directory listing với file types và sizes
5. Đọc file content với proper encoding detection
6. Rate limit compliance với GitHub/GitLab API limits

---

#### STORY 4: Download File (download_file)

> As a developer, I want to download files from URLs to my workspace so that I can use external assets, libraries, or sample data in my project.

**Requirement Details:**

1. Download file từ URL về workspace directory
2. Maximum file size: 50MB
3. Hiển thị progress (bytes downloaded / total)
4. Validate file type (blocklist executable extensions: .exe, .bat, .sh, .cmd, .ps1)
5. Lưu vào user-specified path hoặc auto-detect filename từ URL/headers

**Acceptance Criteria:**

1. AC4: download_file lưu file vào workspace với progress tracking
2. Enforce 50MB size limit (abort nếu vượt quá)
3. Block dangerous file types (.exe, .bat, .cmd, .ps1, .sh)
4. Auto-detect filename từ Content-Disposition header hoặc URL path
5. Verify file integrity (size match)
6. Return file path, size, and content-type sau khi download

---

#### STORY 5: API Call (api_call)

> As a developer, I want to make HTTP API calls from the chatbox so that I can test endpoints, fetch data, or interact with REST services during development.

**Requirement Details:**

1. Hỗ trợ HTTP methods: GET, POST, PUT, DELETE, PATCH
2. Custom headers (Authorization, Content-Type, etc.)
3. Request body (JSON, form-data, plain text)
4. Response includes: status, headers, body
5. Timeout: 30 giây
6. Maximum response body: 100KB

**Acceptance Criteria:**

1. AC5: api_call hỗ trợ tất cả HTTP methods với custom headers/body
2. Đúng Content-Type handling (JSON auto-parse, text pass-through)
3. Return full response (status, headers subset, body)
4. SSRF protection (block internal IPs)
5. Proper error messages cho network failures, timeouts
6. Hỗ trợ basic auth và bearer token authentication

---

#### STORY 6: Render JavaScript Pages (read_webpage)

> As a developer, I want to read content from JavaScript-heavy pages so that I can access SPAs and dynamically-rendered documentation.

**Requirement Details:**

1. Dùng Playwright headless browser để render JavaScript
2. Wait cho page load complete (networkidle hoặc custom wait)
3. Extract rendered text content (not raw HTML)
4. Optional: screenshot capture
5. Timeout: 30 giây
6. Maximum content: 100KB

**Acceptance Criteria:**

1. AC6: read_webpage render được JS-heavy pages và extract text
2. Support SPAs (React, Vue, Angular rendered content)
3. Wait strategies: networkidle, domcontentloaded, custom selector
4. Resource blocking (images, fonts, media) để tăng tốc
5. Content extraction từ specific elements (selector)
6. Sandbox isolation — page không access local filesystem

---

#### STORY 7: SSRF Protection

> As a security-conscious system, I must prevent Server-Side Request Forgery attacks by blocking requests to internal network addresses.

**Requirement Details:**

1. Blocklist private/internal IP ranges: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, ::1, fc00::/7
2. DNS rebinding protection: resolve hostname → check IP before connecting
3. Block file:// and other non-HTTP protocols
4. Log blocked attempts

**Acceptance Criteria:**

1. AC7: SSRF protection block tất cả internal IPs
2. Block cả IPv4 và IPv6 private ranges
3. DNS resolution check (prevent DNS rebinding)
4. Block non-HTTP(S) protocols
5. Log blocked requests với reason

---

#### STORY 8: Rate Limiting

> As a system, I must enforce rate limits to prevent abuse and excessive resource consumption.

**Requirement Details:**

1. Global rate limit: 10 requests per minute across all web tools
2. Per-tool rate limiting configurable
3. Token bucket algorithm
4. Clear error message khi rate limited

**Acceptance Criteria:**

1. AC8: Rate limiting enforced max 10 req/min per tool
2. Clear 429-style response khi exceeded
3. Rate limit info in response (remaining, reset time)
4. Configurable limits per tool

---

## 3. Dependencies

| Dependency | Type | Description |
|------------|------|-------------|
| Backend ModuleRegistry | System | WebModule registers into existing module system |
| Playwright | Infrastructure | Headless browser for read_webpage tool |
| MCP Bridge | System | Tool communication between chatbox LangGraph and backend |
| SearXNG / DuckDuckGo | External | Search engine for web_search tool |
| GitHub/GitLab REST API | External | Repository browsing for git_clone_browse |
| Node.js fetch / undici | System | HTTP client for fetch_url, api_call, download_file |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Developer | Duc Nguyen Minh | Ticket creator, requirements owner |
| Backend Team | Dev Team | Implement WebModule |
| Chatbox Team | Dev Team | Integration via MCP bridge |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| SSRF bypass via DNS rebinding | High | Medium | Double-check IP after DNS resolution |
| Search engine API rate limits/blocks | Medium | Medium | Fallback engines, caching |
| Playwright memory consumption | Medium | Medium | Page timeout, resource blocking, process isolation |
| Large file downloads blocking event loop | Medium | Low | Streaming with backpressure |
| Malicious content injection from fetched URLs | High | Medium | Treat all fetched content as untrusted, sanitize |

### 5.2 Assumptions

- Backend server chạy trên Node.js 18+ (native fetch available)
- Playwright chromium binary đã installed hoặc có thể tự install
- SearXNG instance available (self-hosted hoặc public) hoặc DuckDuckGo API accessible
- Workspace directory writable cho download_file
- User hiểu rằng fetched content có thể không chính xác / outdated

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Response time < 10s cho fetch_url | Timeout 30s, target < 10s cho normal URLs |
| Performance | web_search < 5s | Phụ thuộc search engine latency |
| Security | SSRF blocklist enforced | 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 |
| Security | Rate limit 10 req/min | Token bucket, per-tool configurable |
| Security | Content size limit | Max 100KB response, 50MB download |
| Reliability | Graceful degradation | Tool unavailable → clear error, not crash |
| Scalability | Concurrent requests | Max 3 concurrent browser instances |
| Maintainability | Module isolation | WebModule self-contained, no coupling to other modules |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-297 | Chatbox Internet/Network Tools | In Progress | Task | Main ticket |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| SSRF | Server-Side Request Forgery — attack where server is tricked into making requests to internal resources |
| MCP | Model Context Protocol — communication protocol between AI agents and tool servers |
| SearXNG | Privacy-respecting metasearch engine |
| Playwright | Node.js library for browser automation |
| Token Bucket | Rate limiting algorithm allowing burst traffic up to bucket capacity |

### Use Case Diagram

![Use Case Diagram](diagrams/use-case.png)

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
