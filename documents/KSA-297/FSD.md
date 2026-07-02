# Functional Specification Document (FSD)

## Kiro Chatbox — KSA-297: Internet/Network Tools

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-297 |
| Title | Internet/Network Tools Functional Specification |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-07-03 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-297.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-03 | BA + TA | Initial FSD — Use Cases, API Contracts, Integration Specs |

---

## 1. System Context

![System Context](diagrams/system-context.png)

### 1.1 System Boundary

The WebModule sits within the Backend MCP Server and provides internet/network tools accessible via the MCP protocol. External dependencies include search engines, Git hosting APIs, and target web servers.

### 1.2 Actors

| Actor | Type | Description |
|-------|------|-------------|
| LangGraph Agent | Internal | AI chatbox agent invoking tools via MCP |
| Developer | Human | End user interacting via chatbox |
| Target Web Server | External | Any public URL being fetched |
| Search Engine (SearXNG) | External | Web search provider |
| GitHub/GitLab API | External | Git repository browsing |

---

## 2. Use Cases

### UC-1: Fetch URL Content

| Field | Value |
|-------|-------|
| ID | UC-1 |
| Name | Fetch URL Content |
| Actor | LangGraph Agent |
| Priority | MUST HAVE |
| Trigger | Agent needs web content for user query |

**Main Flow:**

| Step | Actor | Action |
|------|-------|--------|
| 1 | Agent | Calls `fetch_url` with URL, mode, and optional selector |
| 2 | System | Validates URL format (must be http:// or https://) |
| 3 | System | Resolves DNS, checks resolved IP against SSRF blocklist |
| 4 | System | Checks rate limit (token bucket) |
| 5 | System | Sends HTTP GET with timeout=30s, User-Agent header |
| 6 | System | Receives response, checks content-length ≤ 100KB |
| 7 | System | Processes content based on mode (full/truncated/selective) |
| 8 | System | Returns { content, metadata } |

**Alternative Flows:**

| ID | Condition | Action |
|----|-----------|--------|
| AF-1.1 | mode=truncated | Truncate content to specified max_length |
| AF-1.2 | mode=selective | Parse HTML, extract via CSS selector |
| AF-1.3 | Content is JSON | Return formatted JSON directly |
| AF-1.4 | Redirect (3xx) | Follow up to 5 redirects, re-check SSRF each hop |

**Exception Flows:**

| ID | Condition | Response |
|----|-----------|----------|
| EF-1.1 | SSRF blocked IP | Error: "URL resolves to internal IP — blocked for security" |
| EF-1.2 | Rate limit exceeded | Error: "Rate limit exceeded. Reset in Xs" |
| EF-1.3 | Timeout (30s) | Error: "Request timed out after 30s" |
| EF-1.4 | Content > 100KB | Truncate at 100KB, metadata.truncated=true |
| EF-1.5 | Invalid URL | Error: "Invalid URL format" |
| EF-1.6 | DNS resolution fail | Error: "Cannot resolve hostname" |

---

### UC-2: Web Search

| Field | Value |
|-------|-------|
| ID | UC-2 |
| Name | Web Search |
| Actor | LangGraph Agent |
| Priority | MUST HAVE |
| Trigger | Agent needs to search internet |

**Main Flow:**

| Step | Actor | Action |
|------|-------|--------|
| 1 | Agent | Calls `web_search` with query |
| 2 | System | Checks rate limit |
| 3 | System | Calls SearXNG API with query, category, language |
| 4 | System | Parses response, extracts top N results |
| 5 | System | Returns array of { title, url, snippet } |

**Alternative Flows:**

| ID | Condition | Action |
|----|-----------|--------|
| AF-2.1 | SearXNG unavailable | Fallback to DuckDuckGo HTML API |
| AF-2.2 | < requested results found | Return whatever is available |

**Exception Flows:**

| ID | Condition | Response |
|----|-----------|----------|
| EF-2.1 | All search engines unavailable | Error: "Search service temporarily unavailable" |
| EF-2.2 | Rate limit exceeded | Error with rate limit info |
| EF-2.3 | Empty query | Error: "Search query cannot be empty" |

---

### UC-3: Browse Git Repository

| Field | Value |
|-------|-------|
| ID | UC-3 |
| Name | Browse Git Repository |
| Actor | LangGraph Agent |
| Priority | SHOULD HAVE |
| Trigger | Agent needs to explore remote repository |

**Main Flow:**

| Step | Actor | Action |
|------|-------|--------|
| 1 | Agent | Calls `git_clone_browse` with repo URL and operation |
| 2 | System | Parses repo URL, extracts owner/repo/host |
| 3 | System | Checks rate limit |
| 4 | System | Calls GitHub/GitLab REST API based on operation |
| 5 | System | Returns tree listing OR file content OR README |

**Operations:**

| Operation | API Endpoint | Returns |
|-----------|-------------|---------|
| tree | GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1 | File list with sizes |
| read_file | GET /repos/{owner}/{repo}/contents/{path} | Decoded file content |
| readme | GET /repos/{owner}/{repo}/readme | README content |

**Exception Flows:**

| ID | Condition | Response |
|----|-----------|----------|
| EF-3.1 | Invalid repo URL | Error: "Cannot parse repository URL" |
| EF-3.2 | 404 Not Found | Error: "Repository or file not found" |
| EF-3.3 | File > 1MB | Error: "File too large (max 1MB)" |
| EF-3.4 | API rate limit | Error: "GitHub API rate limit exceeded" |

---

### UC-4: Download File

| Field | Value |
|-------|-------|
| ID | UC-4 |
| Name | Download File |
| Actor | LangGraph Agent |
| Priority | SHOULD HAVE |

**Main Flow:**

| Step | Actor | Action |
|------|-------|--------|
| 1 | Agent | Calls `download_file` with URL and optional dest_path |
| 2 | System | Validates URL (SSRF check) |
| 3 | System | HEAD request for content-length and type |
| 4 | System | Validates size ≤ 50MB and extension not blocked |
| 5 | System | Determines filename |
| 6 | System | Streams download to workspace |
| 7 | System | Returns { path, size, content_type } |

**Exception Flows:**

| ID | Condition | Response |
|----|-----------|----------|
| EF-4.1 | Size > 50MB | Error: "File too large (max 50MB)" |
| EF-4.2 | Blocked extension | Error: "Blocked file type" |
| EF-4.3 | SSRF blocked | Error: "Internal IP blocked" |
| EF-4.4 | Download interrupted | Delete partial file, error |
| EF-4.5 | Path outside workspace | Error: "Path must be within workspace" |

---

### UC-5: API Call

| Field | Value |
|-------|-------|
| ID | UC-5 |
| Name | Make API Call |
| Actor | LangGraph Agent |
| Priority | MUST HAVE |

**Main Flow:**

| Step | Actor | Action |
|------|-------|--------|
| 1 | Agent | Calls `api_call` with method, URL, headers, body |
| 2 | System | Validates URL (SSRF check) |
| 3 | System | Checks rate limit |
| 4 | System | Sends HTTP request |
| 5 | System | Returns { status, headers, body } |

**Exception Flows:**

| ID | Condition | Response |
|----|-----------|----------|
| EF-5.1 | Invalid method | Error: "Method must be GET/POST/PUT/DELETE/PATCH" |
| EF-5.2 | SSRF blocked | Error with blocked IP info |
| EF-5.3 | Timeout | Error: "Request timed out after 30s" |

---

### UC-6: Render Webpage (Playwright)

| Field | Value |
|-------|-------|
| ID | UC-6 |
| Name | Render JavaScript Page |
| Actor | LangGraph Agent |
| Priority | COULD HAVE |

**Main Flow:**

| Step | Actor | Action |
|------|-------|--------|
| 1 | Agent | Calls `read_webpage` with URL and wait strategy |
| 2 | System | Validates URL (SSRF check), rate limit |
| 3 | System | Launches Playwright browser (headless) |
| 4 | System | Navigates to URL with resource blocking |
| 5 | System | Waits for load (networkidle / selector / timeout) |
| 6 | System | Extracts text content |
| 7 | System | Closes browser context |
| 8 | System | Returns { content, title, url } |

**Exception Flows:**

| ID | Condition | Response |
|----|-----------|----------|
| EF-6.1 | SSRF blocked | Error |
| EF-6.2 | Page timeout (30s) | Return partial + metadata.partial=true |
| EF-6.3 | Browser crash | Error: "Browser rendering failed" |

---

## 3. Business Rules

| ID | Rule | Applies To |
|----|------|-----------|
| BR-1 | All requests MUST pass SSRF validation before execution | UC-1,3,4,5,6 |
| BR-2 | Rate limit: max 10 requests/min per tool, token bucket | All UCs |
| BR-3 | Response content max 100KB (truncate, don't reject) | UC-1,5,6 |
| BR-4 | Download max 50MB (reject if exceeded) | UC-4 |
| BR-5 | Timeout 30s for all network operations | All UCs |
| BR-6 | Follow max 5 redirects, re-validate SSRF each hop | UC-1,5 |
| BR-7 | Block file://, ftp://, non-HTTP(S) protocols | All UCs |
| BR-8 | Blocked extensions: .exe .bat .cmd .ps1 .sh .msi .scr | UC-4 |
| BR-9 | Max 3 concurrent Playwright instances | UC-6 |
| BR-10 | All fetched content treated as untrusted | All UCs |

---

## 4. API Contracts

### 4.1 fetch_url

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "url": { "type": "string", "description": "URL to fetch (http/https only)" },
    "mode": { "type": "string", "enum": ["full", "truncated", "selective"], "default": "full" },
    "max_length": { "type": "number", "description": "Max chars for truncated mode", "default": 50000 },
    "selector": { "type": "string", "description": "CSS selector for selective mode" },
    "headers": { "type": "object", "description": "Custom request headers" }
  },
  "required": ["url"]
}
```

**Output:**

```json
{
  "content": "...",
  "metadata": {
    "status_code": 200,
    "content_type": "text/html",
    "content_length": 45000,
    "title": "Page Title",
    "truncated": false,
    "url": "https://final-url-after-redirects.com"
  }
}
```

### 4.2 web_search

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "query": { "type": "string", "description": "Search query" },
    "num_results": { "type": "number", "default": 5, "maximum": 10 },
    "category": { "type": "string", "enum": ["general", "code", "docs"], "default": "general" },
    "language": { "type": "string", "default": "en" }
  },
  "required": ["query"]
}
```

**Output:**

```json
{
  "results": [
    { "title": "Result Title", "url": "https://example.com", "snippet": "..." }
  ],
  "total_found": 5,
  "search_engine": "searxng"
}
```

### 4.3 git_clone_browse

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "repo_url": { "type": "string", "description": "GitHub/GitLab repo URL" },
    "operation": { "type": "string", "enum": ["tree", "read_file", "readme"], "default": "readme" },
    "path": { "type": "string", "description": "File path for read_file" },
    "ref": { "type": "string", "description": "Branch/tag/commit" },
    "token": { "type": "string", "description": "Access token for private repos" }
  },
  "required": ["repo_url"]
}
```

**Output (tree):** `{ "tree": [...], "repo": "owner/repo", "ref": "main", "total_files": 42 }`

**Output (read_file):** `{ "content": "...", "path": "...", "size": 1234, "encoding": "utf-8" }`

### 4.4 download_file

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "url": { "type": "string", "description": "File URL" },
    "dest_path": { "type": "string", "description": "Destination in workspace" },
    "overwrite": { "type": "boolean", "default": false }
  },
  "required": ["url"]
}
```

**Output:** `{ "path": "downloads/file.pdf", "filename": "file.pdf", "size": 2048576, "content_type": "application/pdf" }`

### 4.5 api_call

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "url": { "type": "string", "description": "API endpoint URL" },
    "method": { "type": "string", "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"], "default": "GET" },
    "headers": { "type": "object", "description": "Request headers" },
    "body": { "type": ["string", "object"], "description": "Request body" },
    "timeout": { "type": "number", "default": 30000, "maximum": 60000 }
  },
  "required": ["url"]
}
```

**Output:** `{ "status": 200, "headers": {...}, "body": "...", "elapsed_ms": 234 }`

### 4.6 read_webpage

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "url": { "type": "string", "description": "URL to render" },
    "wait_for": { "type": "string", "enum": ["networkidle", "domcontentloaded", "load", "selector"], "default": "networkidle" },
    "selector": { "type": "string", "description": "CSS selector to wait/extract" },
    "timeout": { "type": "number", "default": 30000 },
    "block_resources": { "type": "array", "items": { "type": "string" }, "default": ["image", "font", "media"] }
  },
  "required": ["url"]
}
```

**Output:** `{ "content": "...", "title": "Page Title", "url": "...", "metadata": { "partial": false } }`

---

## 5. Integration Requirements

### 5.1 MCP Tool Registration

Tools register via `WebModule.getToolDefinitions()` and `WebModule.getToolHandlers()`. Category: `'web'` (new category to add to ToolDefinition type).

### 5.2 Search Engine Integration

- **Primary:** SearXNG (`SEARXNG_URL` env var, default `http://localhost:8080`)
- **Fallback:** DuckDuckGo HTML API
- **Request:** `GET {SEARXNG_URL}/search?q={query}&format=json&categories={category}`

### 5.3 Git API Integration

- **GitHub:** `https://api.github.com/repos/{owner}/{repo}/...`
- **GitLab:** `https://gitlab.com/api/v4/projects/{id}/repository/...`
- **Auth:** Optional Bearer token

### 5.4 Playwright Integration

- Reuse existing playwright dep
- Chromium headless, launch on first use
- Max 3 concurrent contexts
- Resource blocking via route interception

---

## 6. Data Model

### 6.1 Configuration

```typescript
interface WebModuleConfig {
  searxng_url: string;          // Default: 'http://localhost:8080'
  rate_limit_rpm: number;       // Default: 10
  timeout_ms: number;           // Default: 30000
  max_response_kb: number;      // Default: 100
  max_download_mb: number;      // Default: 50
  max_browser_contexts: number; // Default: 3
  blocked_extensions: string[];
  ssrf_blocklist: string[];
  user_agent: string;           // Default: 'Kiro-WebModule/1.0'
}
```

### 6.2 Rate Limiter (Token Bucket)

```typescript
interface TokenBucket {
  tokens: number;
  max_tokens: number;   // 10
  refill_rate: number;  // tokens/sec = 10/60
  last_refill: number;  // timestamp
}
```

---

## 7. Error Handling

| Error Code | Message | Recovery |
|-----------|---------|----------|
| SSRF_BLOCKED | URL resolves to blocked IP | Use public URL |
| RATE_LIMITED | Rate limit exceeded | Wait for reset |
| TIMEOUT | Request timed out | Retry or shorter timeout |
| CONTENT_TOO_LARGE | Exceeds size limit | Use truncated mode |
| INVALID_URL | URL format invalid | Fix URL |
| DNS_FAILED | Cannot resolve hostname | Check spelling |
| BLOCKED_EXTENSION | File type not allowed | Cannot download |
| BROWSER_FAILED | Rendering failed | Retry or use fetch_url |

---

## 8. Non-Functional Requirements

| Category | Metric | Target |
|----------|--------|--------|
| Performance | fetch_url p95 | < 10s |
| Performance | web_search p95 | < 5s |
| Performance | read_webpage p95 | < 15s |
| Security | SSRF block rate | 100% |
| Resource | Playwright memory | < 200MB/context |
| Resource | Max concurrent browsers | 3 |

---

## 9. State Diagram

![Request State](diagrams/state-request.png)

---

## 10. Sequence Diagram

![Fetch URL Sequence](diagrams/sequence-fetch-url.png)

---

## 11. Open Issues

| ID | Issue | Impact | Owner |
|----|-------|--------|-------|
| OI-1 | SearXNG not deployed yet | web_search unavailable | DevOps |
| OI-2 | Playwright binary size (~400MB) | Docker image bloat | DevOps |
| OI-3 | GitHub unauthenticated rate limit (60/hr) | git_browse limited | Dev |

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Request State | [state-request.png](diagrams/state-request.png) | [state-request.drawio](diagrams/state-request.drawio) |
| 3 | Fetch URL Sequence | [sequence-fetch-url.png](diagrams/sequence-fetch-url.png) | [sequence-fetch-url.drawio](diagrams/sequence-fetch-url.drawio) |
