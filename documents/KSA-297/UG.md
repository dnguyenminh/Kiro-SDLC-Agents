# User Guide (UG)

## Kiro Chatbox — KSA-297: Internet/Network Tools (WebModule)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-297 |
| Title | WebModule — Internet/Network Tools |
| Author | DEV Agent |
| Reviewer | BA Agent |
| Version | 1.0 |
| Date | 2026-07-03 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-297.docx |
| Related FSD | FSD-v1-KSA-297.docx |
| Related TDD | TDD-v1-KSA-297.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-03 | DEV Agent | Initial document |

---

## 1. Introduction

### 1.1 Purpose

WebModule cung cấp 6 Internet/Network tools cho Kiro Chatbox, cho phép AI agent truy cập internet, fetch URLs, tìm kiếm web, browse Git repos, download files, gọi REST APIs, và render JavaScript pages. Tất cả tools được bảo vệ bởi SSRF guard, rate limiter, và content truncation.

### 1.2 Audience

| Audience | What They Need |
|----------|---------------|
| AI Agent (LangGraph) | Gọi tools qua MCP bridge để truy cập internet |
| System Administrator | Cấu hình rate limits, SSRF blocklist, timeouts |
| Developer | Extend module, thêm tools mới theo handler pattern |

### 1.3 Prerequisites

| Prerequisite | Version | Required |
|-------------|---------|----------|
| Node.js | ≥18.14.1 | Yes |
| Playwright (chromium) | ≥1.60 | Only for `read_webpage` |
| SearXNG instance | Any | Optional (DuckDuckGo fallback) |

---

## 2. Getting Started

### 2.1 Quick Start

```bash
# Step 1: Build backend
cd backend
npm install
npm run build

# Step 2: Set environment variables (optional — defaults work)
export WEB_RATE_LIMIT_RPM=10
export WEB_TIMEOUT_MS=30000

# Step 3: Run server
npm start

# Step 4: Verify WebModule loaded
# Expected log output:
# {"level":"info","module":"web","msg":"Initializing web module"}
# {"level":"info","module":"web","msg":"Web module ready"}
```

### 2.2 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Node.js | 18.14.1 | 20.x LTS |
| Memory | 256 MB | 512 MB |
| Disk | 50 MB | 200 MB (for downloads) |
| OS | Windows 10, Linux, macOS | Any |
| Network | Internet access | Low-latency connection |

### 2.3 Distribution Formats

| Format | How to Get | Use Case |
|--------|-----------|----------|
| Source (npm) | `cd backend && npm install && npm run build` | Development |
| Compiled JS | `backend/dist/` after build | Production |

### 2.4 Configuration Methods

| Method | Priority | Best For |
|--------|----------|----------|
| Environment variables | 1 (highest) | Docker, CI/CD |
| Default values in code | 2 (fallback) | Local development |

WebModule config is loaded via environment variables. All settings have sensible defaults — no config file required for basic operation.

### 2.5 Verify Configuration

1. **Server started**: Log shows `Web module ready`
2. **SearXNG connected** (optional): Send `web_search` → get results from SearXNG. If SearXNG unavailable, auto-fallback to DuckDuckGo.
3. **Basic test**: Call `fetch_url` with `https://example.com` → should return HTML content.

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Web module ready` not in logs | Module not registered | Check `src/index.ts` imports WebModule |
| `SSRF_BLOCKED` on all URLs | DNS resolving to private IP | Check DNS, verify target is public |
| `RATE_LIMITED` immediately | RPM set too low | Increase `WEB_RATE_LIMIT_RPM` |

---

## 3. Configuration

### 3.1 Environment Variables

All WebModule settings are controlled via environment variables. No config file is needed.

### 3.2 Configuration Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WEB_SEARXNG_URL` | string | `http://localhost:8080` | SearXNG instance URL for web search |
| `WEB_RATE_LIMIT_RPM` | number | `10` | Max requests per minute per tool |
| `WEB_TIMEOUT_MS` | number | `30000` | HTTP request timeout in milliseconds |
| `WEB_MAX_RESPONSE_KB` | number | `100` | Max response content size in KB |
| `WEB_MAX_DOWNLOAD_MB` | number | `50` | Max file download size in MB |
| `WEB_MAX_BROWSER_CONTEXTS` | number | `3` | Max concurrent Playwright browser contexts |
| `WEB_USER_AGENT` | string | `Kiro-WebModule/1.0` | HTTP User-Agent header |

### 3.3 Security Configuration (Built-in, non-configurable)

| Setting | Value | Purpose |
|---------|-------|---------|
| Allowed protocols | `http:`, `https:` only | Prevent file://, ftp:// attacks |
| SSRF blocklist | `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1/128`, `fc00::/7` | Block internal network access |
| Blocked extensions | `.exe`, `.bat`, `.cmd`, `.ps1`, `.sh`, `.msi`, `.scr` | Prevent dangerous file downloads |

### 3.4 Configuration Examples

#### Minimal (defaults work)

```bash
# No env vars needed — all defaults are production-ready
npm start
```

#### Full Configuration

```bash
export WEB_SEARXNG_URL=http://searxng.internal:8080
export WEB_RATE_LIMIT_RPM=20
export WEB_TIMEOUT_MS=60000
export WEB_MAX_RESPONSE_KB=200
export WEB_MAX_DOWNLOAD_MB=100
export WEB_MAX_BROWSER_CONTEXTS=5
export WEB_USER_AGENT="MyApp-WebAgent/2.0"
npm start
```

---

## 4. Usage

All tools are called via MCP protocol (JSON-RPC). The AI agent sends tool calls through the MCP bridge to the backend server.

### 4.1 fetch_url — Fetch content from a URL

**Description:** Fetches and extracts text content from a public URL. Supports full, truncated, and selective (CSS selector) modes.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | Yes | — | Target URL (http/https only) |
| `mode` | string | No | `full` | `full`, `truncated`, or `selective` |
| `max_length` | number | No | 50000 | Max chars for truncated mode |
| `selector` | string | No | — | CSS selector for selective mode |

**Example — Full fetch:**

```json
{
  "tool": "fetch_url",
  "arguments": {
    "url": "https://example.com"
  }
}
```

**Response:**

```json
{
  "content": "Example Domain\nThis domain is for use in illustrative examples...",
  "metadata": {
    "status_code": 200,
    "content_type": "text/html; charset=UTF-8",
    "content_length": 1256,
    "title": "Example Domain",
    "truncated": false,
    "url": "https://example.com"
  }
}
```

**Example — Selective (CSS selector):**

```json
{
  "tool": "fetch_url",
  "arguments": {
    "url": "https://news.ycombinator.com",
    "mode": "selective",
    "selector": ".titleline"
  }
}
```

---

### 4.2 web_search — Search the internet

**Description:** Searches via SearXNG with automatic DuckDuckGo fallback if SearXNG is unavailable.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search query |
| `num_results` | number | No | `5` | Number of results (max 10) |
| `category` | string | No | `general` | Search category |
| `language` | string | No | `en` | Search language |

**Example:**

```json
{
  "tool": "web_search",
  "arguments": {
    "query": "typescript MCP server tutorial",
    "num_results": 3
  }
}
```

**Response:**

```json
{
  "results": [
    { "title": "Building MCP Servers with TypeScript", "url": "https://...", "snippet": "Learn how to..." },
    { "title": "MCP Protocol Guide", "url": "https://...", "snippet": "The Model Context Protocol..." }
  ],
  "total_found": 2,
  "search_engine": "searxng"
}
```

---

### 4.3 git_clone_browse — Browse Git repositories

**Description:** Browses GitHub/GitLab repositories via their REST APIs. No local clone needed.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `repo_url` | string | Yes | — | GitHub/GitLab repository URL |
| `operation` | string | No | `readme` | `readme`, `tree`, or `read_file` |
| `path` | string | No | — | File path (for `read_file` operation) |
| `ref` | string | No | `HEAD` | Branch/tag/commit reference |
| `token` | string | No | — | Auth token for private repos |

**Example — Read README:**

```json
{
  "tool": "git_clone_browse",
  "arguments": {
    "repo_url": "https://github.com/modelcontextprotocol/typescript-sdk"
  }
}
```

**Example — Browse file tree:**

```json
{
  "tool": "git_clone_browse",
  "arguments": {
    "repo_url": "https://github.com/user/repo",
    "operation": "tree",
    "ref": "main"
  }
}
```

**Example — Read specific file:**

```json
{
  "tool": "git_clone_browse",
  "arguments": {
    "repo_url": "https://github.com/user/repo",
    "operation": "read_file",
    "path": "src/index.ts",
    "ref": "main"
  }
}
```

**Response (tree):**

```json
{
  "tree": [
    { "path": "src/index.ts", "type": "blob", "size": 1234 },
    { "path": "src/utils/", "type": "tree" }
  ],
  "repo": "user/repo",
  "ref": "main",
  "total_files": 42
}
```

---

### 4.4 download_file — Download file to workspace

**Description:** Downloads a file from a URL to the local workspace. Validates file extension and size.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | Yes | — | File URL to download |
| `dest_path` | string | No | auto from URL | Destination path relative to workspace |
| `overwrite` | boolean | No | — | Allow overwriting existing file |

**Example:**

```json
{
  "tool": "download_file",
  "arguments": {
    "url": "https://raw.githubusercontent.com/user/repo/main/data.json",
    "dest_path": "data/downloaded.json"
  }
}
```

**Response:**

```json
{
  "path": "data/downloaded.json",
  "filename": "downloaded.json",
  "size": 4096,
  "content_type": "application/json"
}
```

**Blocked extensions:** `.exe`, `.bat`, `.cmd`, `.ps1`, `.sh`, `.msi`, `.scr` — download will fail with `BLOCKED_EXTENSION` error.

---

### 4.5 api_call — Make HTTP API calls

**Description:** Makes HTTP API requests with custom method, headers, and body. Supports GET, POST, PUT, DELETE, PATCH.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | Yes | — | API endpoint URL |
| `method` | string | No | `GET` | HTTP method |
| `headers` | object | No | `{}` | Request headers |
| `body` | any | No | — | Request body (auto JSON if object) |
| `timeout` | number | No | `30000` | Timeout in ms (max 60000) |

**Example — GET:**

```json
{
  "tool": "api_call",
  "arguments": {
    "url": "https://api.github.com/repos/microsoft/vscode/releases/latest",
    "headers": { "Accept": "application/vnd.github+json" }
  }
}
```

**Example — POST with JSON body:**

```json
{
  "tool": "api_call",
  "arguments": {
    "url": "https://httpbin.org/post",
    "method": "POST",
    "headers": { "Authorization": "Bearer token123" },
    "body": { "name": "test", "value": 42 }
  }
}
```

**Response:**

```json
{
  "status": 200,
  "headers": { "content-type": "application/json", "x-request-id": "abc123" },
  "body": "{\"name\":\"test\",\"value\":42}",
  "elapsed_ms": 234
}
```

---

### 4.6 read_webpage — Render JavaScript pages

**Description:** Uses Playwright (headless Chromium) to render JavaScript-heavy pages and extract text content. Use this for SPAs, pages with dynamic content, or when `fetch_url` returns incomplete content.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | Yes | — | Page URL to render |
| `wait_for` | string | No | `networkidle` | Wait strategy: `networkidle`, `load`, `domcontentloaded`, `selector` |
| `selector` | string | No | — | CSS selector to wait for / extract from |
| `timeout` | number | No | `30000` | Page load timeout in ms |
| `block_resources` | array | No | `["image","font","media"]` | Resource types to block |

**Example — Render SPA:**

```json
{
  "tool": "read_webpage",
  "arguments": {
    "url": "https://react-app.example.com/dashboard"
  }
}
```

**Example — Wait for specific element:**

```json
{
  "tool": "read_webpage",
  "arguments": {
    "url": "https://app.example.com/results",
    "wait_for": "selector",
    "selector": "#results-table",
    "timeout": 15000
  }
}
```

**Response:**

```json
{
  "content": "Dashboard\nTotal Users: 1,234\nActive Today: 567...",
  "title": "My App - Dashboard",
  "url": "https://react-app.example.com/dashboard",
  "metadata": { "partial": false }
}
```

**Note:** Max 3 concurrent browser contexts. If limit reached, returns `RATE_LIMITED` error.

---

## 5. Administration

### 5.1 Rate Limit Management

The rate limiter uses a **token bucket** algorithm per tool. Each tool gets an independent bucket with `WEB_RATE_LIMIT_RPM` tokens that refill at a constant rate.

**Check current limits:**
- Default: 10 requests/minute per tool
- All 6 tools have independent buckets
- Tokens refill continuously (not reset at minute boundary)

**Adjust limits:**
```bash
# Double the rate limit
export WEB_RATE_LIMIT_RPM=20
# Restart server to apply
```

### 5.2 Browser Context Management

Playwright browser contexts are used by `read_webpage`. Contexts are created per-request and destroyed after extraction.

- Max concurrent contexts: controlled by `WEB_MAX_BROWSER_CONTEXTS`
- Browser is lazily initialized (first `read_webpage` call)
- Browser is cleanly shut down on module shutdown

### 5.3 Monitoring Health

WebModule reports status via the ModuleRegistry:
- `initializing` — loading config and creating handlers
- `ready` — all tools available
- `stopped` — gracefully shut down

Check module status in server logs:
```
{"level":"info","module":"web","msg":"Web module ready"}
```

---

## 6. Troubleshooting

### 6.1 Common Issues

| # | Symptom | Cause | Solution |
|---|---------|-------|----------|
| 1 | `SSRF_BLOCKED` error on valid URL | DNS resolves to private IP (e.g., behind VPN) | Verify URL resolves to public IP; check corporate DNS |
| 2 | `RATE_LIMITED` error | Too many requests within time window | Wait for reset (logged in error), or increase `WEB_RATE_LIMIT_RPM` |
| 3 | `TIMEOUT` on all requests | Network unreachable or timeout too low | Check internet connectivity; increase `WEB_TIMEOUT_MS` |
| 4 | `CONTENT_TOO_LARGE` | Response exceeds `WEB_MAX_RESPONSE_KB` | Increase limit or use `mode: "truncated"` with `max_length` |
| 5 | `BLOCKED_EXTENSION` on download | File has dangerous extension | File cannot be downloaded (security measure) |
| 6 | `BROWSER_FAILED` | Playwright not installed or crashed | Run `npx playwright install chromium`; check memory |
| 7 | `DNS_FAILED` | Cannot resolve hostname | Check DNS configuration; verify domain exists |
| 8 | `INVALID_URL` | Malformed URL or blocked protocol | Use `http://` or `https://` only; check URL format |
| 9 | Web search returns empty | SearXNG down + DuckDuckGo blocked | Verify SearXNG URL; check network access to DuckDuckGo API |
| 10 | `read_webpage` returns incomplete | Page needs more time to render | Increase `timeout`; use `wait_for: "selector"` with target element |

### 6.2 Error Codes

| Code | Message | Description | Action |
|------|---------|-------------|--------|
| `SSRF_BLOCKED` | Blocked internal IP: {ip} | URL resolves to private/internal IP | Use only public URLs |
| `RATE_LIMITED` | Rate limit exceeded. Reset in {N}s | Token bucket exhausted | Wait {N} seconds then retry |
| `TIMEOUT` | Request timed out after {N}ms | HTTP request or page load exceeded timeout | Retry, or increase `WEB_TIMEOUT_MS` |
| `CONTENT_TOO_LARGE` | File too large (max {N}MB) | Download exceeds size limit | Increase `WEB_MAX_DOWNLOAD_MB` or find smaller file |
| `INVALID_URL` | Invalid URL / Protocol not allowed / Method not allowed | URL format issue or protocol not http/https | Fix URL format, use http/https |
| `DNS_FAILED` | Cannot resolve: {hostname} | DNS lookup failed | Check hostname spelling, DNS config |
| `BLOCKED_EXTENSION` | Blocked file type: {ext} | File extension is in blocklist | Cannot download this file type (security) |
| `BROWSER_FAILED` | {Playwright error message} | Browser launch/navigation failed | Install Playwright, check memory/disk |

### 6.3 Logs

| Log Location | Content | Useful For |
|-------------|---------|------------|
| stdout (JSON) | All module lifecycle events | Startup/shutdown issues |
| pino logger (module: "web") | Per-request errors and warnings | Debugging specific tool calls |

### 6.4 FAQ

**Q: Can I access internal/private URLs?**
A: No. SSRF guard blocks all private IP ranges (127.x, 10.x, 172.16-31.x, 192.168.x). This is a security feature and cannot be disabled.

**Q: Why does `fetch_url` return different content than I see in browser?**
A: `fetch_url` does raw HTTP fetch without JavaScript execution. Use `read_webpage` for pages that require JS rendering.

**Q: Does `read_webpage` support login/authentication?**
A: No. Each request creates a fresh browser context without cookies or session state. For authenticated APIs, use `api_call` with auth headers.

**Q: What happens when SearXNG is unavailable?**
A: `web_search` automatically falls back to DuckDuckGo Instant Answer API. Results may be less comprehensive.

**Q: Can I download large files (>50MB)?**
A: Increase `WEB_MAX_DOWNLOAD_MB`. Note that very large downloads may hit the `WEB_TIMEOUT_MS` limit.

---

## 7. API Reference

### 7.1 fetch_url

| Attribute | Value |
|-----------|-------|
| Name | `fetch_url` |
| Category | web |
| Description | Fetch content from a public URL |

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "url": { "type": "string" },
    "mode": { "type": "string", "enum": ["full", "truncated", "selective"] },
    "max_length": { "type": "number" },
    "selector": { "type": "string" }
  },
  "required": ["url"]
}
```

### 7.2 web_search

| Attribute | Value |
|-----------|-------|
| Name | `web_search` |
| Category | web |
| Description | Search the internet |

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "query": { "type": "string" },
    "num_results": { "type": "number" },
    "category": { "type": "string" },
    "language": { "type": "string" }
  },
  "required": ["query"]
}
```

### 7.3 git_clone_browse

| Attribute | Value |
|-----------|-------|
| Name | `git_clone_browse` |
| Category | web |
| Description | Browse GitHub/GitLab repos via API |

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "repo_url": { "type": "string" },
    "operation": { "type": "string", "enum": ["readme", "tree", "read_file"] },
    "path": { "type": "string" },
    "ref": { "type": "string" },
    "token": { "type": "string" }
  },
  "required": ["repo_url"]
}
```

### 7.4 download_file

| Attribute | Value |
|-----------|-------|
| Name | `download_file` |
| Category | web |
| Description | Download file to workspace |

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "url": { "type": "string" },
    "dest_path": { "type": "string" },
    "overwrite": { "type": "boolean" }
  },
  "required": ["url"]
}
```

### 7.5 api_call

| Attribute | Value |
|-----------|-------|
| Name | `api_call` |
| Category | web |
| Description | Make HTTP API calls |

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "url": { "type": "string" },
    "method": { "type": "string", "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"] },
    "headers": { "type": "object" },
    "body": {},
    "timeout": { "type": "number" }
  },
  "required": ["url"]
}
```

### 7.6 read_webpage

| Attribute | Value |
|-----------|-------|
| Name | `read_webpage` |
| Category | web |
| Description | Render JS page and extract text |

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "url": { "type": "string" },
    "wait_for": { "type": "string", "enum": ["networkidle", "load", "domcontentloaded", "selector"] },
    "selector": { "type": "string" },
    "timeout": { "type": "number" },
    "block_resources": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["url"]
}
```

---

## 8. Appendix

### 8.1 Glossary

| Term | Definition |
|------|------------|
| SSRF | Server-Side Request Forgery — attack using server to access internal resources |
| MCP | Model Context Protocol — standard for AI tool communication |
| SearXNG | Open-source metasearch engine |
| Token Bucket | Rate limiting algorithm with gradual refill |
| Browser Context | Isolated Playwright session (like incognito window) |

### 8.2 Related Documents

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-297.docx |
| FSD | FSD-v1-KSA-297.docx |
| TDD | TDD-v1-KSA-297.docx |
| STP | STP-v1-KSA-297.docx |
| STC | STC-v1-KSA-297.docx |

### 8.3 Version Compatibility

| System Version | Config Version | Breaking Changes |
|---------------|---------------|-----------------|
| 1.0.0 | v1 | Initial release — 6 web tools |
