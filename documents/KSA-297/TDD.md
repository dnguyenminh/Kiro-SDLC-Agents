# Technical Design Document (TDD)

## Kiro Chatbox — KSA-297: Internet/Network Tools

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-297 |
| Title | Internet/Network Tools Technical Design |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-07-03 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-297.docx |
| Related BRD | BRD-v1-KSA-297.docx |

---

## 1. Architecture Overview

![Architecture Diagram](diagrams/architecture-web.png)

### 1.1 Design Philosophy

- **Module Isolation**: WebModule self-contained, no dependencies on other modules
- **Security First**: SSRF guard + Rate limiter as middleware before any request
- **Strategy Pattern**: Each tool = separate handler class implementing shared interface
- **Graceful Degradation**: Tool failure never crashes the server

### 1.2 Module Structure

```
backend/src/modules/web/
├── WebModule.ts              # IModule implementation, tool registration
├── handlers/
│   ├── FetchUrlHandler.ts    # fetch_url tool
│   ├── WebSearchHandler.ts   # web_search tool
│   ├── GitBrowseHandler.ts   # git_clone_browse tool
│   ├── DownloadFileHandler.ts # download_file tool
│   ├── ApiCallHandler.ts     # api_call tool
│   └── ReadWebpageHandler.ts # read_webpage (Playwright)
├── middleware/
│   ├── SsrfGuard.ts          # SSRF validation
│   ├── RateLimiter.ts        # Token bucket rate limiting
│   └── ContentTruncator.ts   # Response size enforcement
├── models/
│   ├── WebToolResult.ts      # Result types
│   ├── WebModuleConfig.ts    # Configuration interface
│   └── WebError.ts           # Error codes
└── utils/
    ├── UrlValidator.ts       # URL parsing/validation
    ├── HtmlExtractor.ts      # HTML→text, CSS selector
    └── GitUrlParser.ts       # GitHub/GitLab URL parsing
```

### 1.3 Integration

WebModule registers into existing ModuleRegistry. No changes to MCP server or chatbox integration layer — tools become available automatically.

---

## 2. Component Design

![Component Diagram](diagrams/component-web.png)

### 2.1 WebModule (Entry Point)

```typescript
export class WebModule implements IModule {
  readonly name = 'web';
  private _status: ModuleStatus = 'initializing';
  private ssrfGuard: SsrfGuard;
  private rateLimiter: RateLimiter;
  private config: WebModuleConfig;
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    this.config = loadWebConfig();
    this.ssrfGuard = new SsrfGuard(this.config.ssrf_blocklist);
    this.rateLimiter = new RateLimiter(this.config.rate_limit_rpm);
    this._status = 'ready';
  }

  async shutdown(): Promise<void> {
    if (this.browser) await this.browser.close();
    this._status = 'stopped';
  }
}
```

### 2.2 SsrfGuard

- Parse URL: reject non-http(s) protocols
- DNS resolve hostname to IP
- Check IP against CIDR blocklist (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
- Throw SSRF_BLOCKED if matched
- DNS Rebinding Protection: connect to resolved IP, not hostname

### 2.3 RateLimiter (Token Bucket)

- Per-tool bucket: `Map<string, TokenBucket>`
- Max 10 tokens, refill 10/min (0.167/sec)
- `consume(toolName)` returns `{ allowed, remaining, resetMs }`

### 2.4 Tool Handlers

Each handler:
1. Validate args
2. Call `ssrfGuard.validate(url)` (if applicable)
3. Call `rateLimiter.consume(toolName)`
4. Execute request
5. Process/truncate response
6. Return structured ToolResult

---

## 3. API Design

### 3.1 Category Extension

```typescript
// types/tool.ts — add 'web' to union
category: 'memory' | 'code' | 'orchestration' | 'analytics' | 'kb-graph' | 'utility' | 'web';
```

### 3.2 Tool Schemas

See FSD Section 4 for complete input/output schemas for all 6 tools.

---

## 4. Security Design

| Layer | Protection |
|-------|-----------|
| Protocol | Only http:// and https:// |
| DNS | Resolve before connect, check resolved IP |
| IP Blocklist | All RFC1918 + loopback + link-local |
| Redirect | Re-check SSRF each hop (max 5) |
| Timeout | Hard 30s prevents slowloris |
| Path | download_file dest must be within workspace |
| Extension | Blocklist: .exe .bat .cmd .ps1 .sh .msi .scr |
| Content | All fetched content = untrusted text, never executed |

---

## 5. Error Handling

```typescript
export class WebToolError extends Error {
  constructor(
    public readonly code: string,  // SSRF_BLOCKED, RATE_LIMITED, etc.
    message: string,
    public readonly details?: Record<string, unknown>
  ) { super(message); }
}
```

Errors returned as `ToolResult` with `isError: true`.

---

## 6. Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| WEB_SEARXNG_URL | http://localhost:8080 | SearXNG instance |
| WEB_RATE_LIMIT_RPM | 10 | Requests/min/tool |
| WEB_TIMEOUT_MS | 30000 | Default timeout |
| WEB_MAX_RESPONSE_KB | 100 | Max response size |
| WEB_MAX_DOWNLOAD_MB | 50 | Max download size |
| WEB_MAX_BROWSER_CONTEXTS | 3 | Concurrent Playwright |
| WEB_USER_AGENT | Kiro-WebModule/1.0 | User-Agent header |

---

## 7. Implementation Checklist

### Files to Create (16 files)

| # | File | Purpose | Est. Lines |
|---|------|---------|-----------|
| 1 | modules/web/WebModule.ts | Module entry, registration | ~100 |
| 2 | modules/web/handlers/FetchUrlHandler.ts | fetch_url | ~120 |
| 3 | modules/web/handlers/WebSearchHandler.ts | web_search | ~100 |
| 4 | modules/web/handlers/GitBrowseHandler.ts | git_clone_browse | ~150 |
| 5 | modules/web/handlers/DownloadFileHandler.ts | download_file | ~120 |
| 6 | modules/web/handlers/ApiCallHandler.ts | api_call | ~100 |
| 7 | modules/web/handlers/ReadWebpageHandler.ts | read_webpage | ~130 |
| 8 | modules/web/middleware/SsrfGuard.ts | SSRF validation | ~80 |
| 9 | modules/web/middleware/RateLimiter.ts | Token bucket | ~60 |
| 10 | modules/web/middleware/ContentTruncator.ts | Size enforcement | ~30 |
| 11 | modules/web/models/WebModuleConfig.ts | Config interface | ~25 |
| 12 | modules/web/models/WebError.ts | Error types | ~30 |
| 13 | modules/web/models/WebToolResult.ts | Result types | ~20 |
| 14 | modules/web/utils/UrlValidator.ts | URL validation | ~40 |
| 15 | modules/web/utils/HtmlExtractor.ts | HTML→text | ~60 |
| 16 | modules/web/utils/GitUrlParser.ts | Git URL parsing | ~50 |

### Files to Modify (2 files)

| # | File | Change |
|---|------|--------|
| 1 | backend/src/types/tool.ts | Add 'web' to category union |
| 2 | backend/src/index.ts | Register WebModule |

### Dependencies

- `playwright` — already installed
- `node-html-parser` — NEW (lightweight HTML parsing)
- `ipaddr.js` — NEW (CIDR matching)

---

## 8. Testing Strategy

- **Unit**: SsrfGuard, RateLimiter, UrlValidator, GitUrlParser, HtmlExtractor
- **Integration**: Handlers with real HTTP (httpbin.org or local mock)
- **Security**: SSRF bypass attempts, path traversal, extension bypass
- **E2E**: Full tool call via MCP bridge

---

## 9. Performance

| Concern | Mitigation |
|---------|-----------|
| Playwright memory | Lazy launch, max 3 contexts |
| Large downloads | Stream with size abort |
| DNS latency | Cache resolved IPs (60s TTL) |
| Event loop | All I/O async |

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture-web.png](diagrams/architecture-web.png) | [architecture-web.drawio](diagrams/architecture-web.drawio) |
| 2 | Component | [component-web.png](diagrams/component-web.png) | [component-web.drawio](diagrams/component-web.drawio) |
