# Business Requirements Document (BRD)

## MCP Code Intelligence — KSA-162: [Quality] Entry Point & HTTP Handler Detection

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-162 |
| Title | [Quality] Entry Point & HTTP Handler Detection |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-05 |
| Status | Draft |
| Parent Epic | KSA-144: Code Intelligence v2 — Graph Engine + Static Analysis |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-05 | BA Agent | Initial document — auto-generated from Jira ticket KSA-162 |

---

## 1. Introduction

### 1.1 Scope

This ticket implements detection of application entry points and HTTP handlers across 7+ web frameworks. Using tree-sitter AST (KSA-145) and the graph engine (KSA-153), the system identifies main functions, HTTP route handlers (FastAPI/Flask/Django, NestJS, Spring/JAX-RS, Gin/Echo/Fiber, ASP.NET, Rails, Laravel), CLI commands, and event handlers.

**Key deliverables:**
- Entry point detection engine (main functions, CLI commands, event handlers)
- HTTP handler detection for 7 framework families (14+ specific frameworks)
- Route extraction (HTTP method, path, middleware)
- MCP tool `find_entry_points` exposing results to AI agents
- Classification taxonomy (HTTP, CLI, Event, Scheduled, Main)
- Support for 6 languages matching framework ecosystems

### 1.2 Out of Scope

- Tree-sitter core integration (KSA-145 — prerequisite)
- Graph data model (KSA-153 — prerequisite for relationship storage)
- Cyclomatic complexity (KSA-161 — separate ticket)
- Security analysis of handlers (KSA-164, KSA-165 — separate tickets)
- Runtime detection (only static/AST-based detection)
- API documentation generation

### 1.3 Preliminary Requirements

- KSA-145: Tree-sitter core integration (AST parsing)
- KSA-146: TypeScript/JS parser (for Express/NestJS/Fastify detection)
- KSA-153: Graph data model (for storing entry point relationships)
- Tree-sitter grammars for Python, TypeScript, Java, Kotlin, Go, C#

---

## 2. Business Requirements

### 2.1 High Level Process Map

Currently, AI agents have no way to identify which functions are application entry points — the "surface area" of a codebase. This makes it impossible to:
- Understand application architecture at a glance
- Identify all API endpoints for security review
- Map HTTP routes to handler implementations
- Find dead code (functions never called from entry points)

This feature provides:
- **Automatic entry point discovery** — find all ways into the application
- **HTTP route mapping** — method + path + handler for every endpoint
- **Framework-aware detection** — understands decorators, annotations, router patterns
- **Classification** — categorize entry points by type (HTTP, CLI, Event, etc.)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|-----------------|----------|---------------|
| 1 | As a developer, I want all HTTP handlers detected automatically so that I can see the full API surface | MUST HAVE | KSA-162 |
| 2 | As a developer, I want main/CLI entry points detected so that I understand how the app starts | MUST HAVE | KSA-162 |
| 3 | As a security reviewer, I want route + method + middleware extracted so that I can audit access control | MUST HAVE | KSA-162 |
| 4 | As an AI agent, I want to query entry points via MCP tool so that I can provide architecture context | MUST HAVE | KSA-162 |
| 5 | As a developer, I want event handlers and scheduled tasks detected so that I have complete entry point coverage | SHOULD HAVE | KSA-162 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** During indexing, system parses source files with tree-sitter

**Step 2:** Entry point detector scans AST for known patterns (decorators, annotations, function signatures)

**Step 3:** For HTTP handlers: extract HTTP method, route path, middleware chain

**Step 4:** For main/CLI: detect main functions, CLI command registrations

**Step 5:** For events: detect event listener registrations, message queue consumers

**Step 6:** Classify each entry point and store in entry_points table

**Step 7:** MCP tool `find_entry_points` serves results to AI agents

---

#### STORY 1: HTTP Handler Detection

> As a developer, I want all HTTP handlers detected automatically so that I can see the full API surface.

**Requirement Details:**

Detection patterns for 7 framework families:

| Framework Family | Language | Detection Pattern | Example |
|-----------------|----------|-------------------|---------|
| FastAPI | Python | `@app.get/post/put/delete("/path")` decorator | `@app.get("/users/{id}")` |
| Flask | Python | `@app.route("/path", methods=["GET"])` decorator | `@bp.route("/api/items")` |
| Django | Python | `urlpatterns` list entries, `@api_view` decorator | `path("users/", views.list)` |
| Express/Fastify | TypeScript/JS | `app.get/post("/path", handler)`, `router.get()` | `router.get("/api", ctrl)` |
| NestJS | TypeScript | `@Get/@Post/@Put/@Delete()` + `@Controller("/prefix")` | `@Get(":id")` |
| Spring/JAX-RS | Java/Kotlin | `@GetMapping/@PostMapping`, `@RequestMapping`, `@Path` | `@GetMapping("/users")` |
| Gin/Echo/Fiber | Go | `r.GET("/path", handler)`, `e.POST()`, `app.Get()` | `r.GET("/api", h)` |
| ASP.NET | C# | `[HttpGet]`, `[Route("api/[controller]")]`, `MapGet()` | `[HttpGet("{id}")]` |
| Rails | Ruby | `resources :users`, `get "/path" => "ctrl#action"` | `get "/users" => "users#index"` |
| Laravel | PHP | `Route::get("/path", [Ctrl::class, "method"])` | `Route::post("/login")` |

**Data Fields per HTTP Handler:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| symbol_id | integer | Yes | FK to symbols table | 42 |
| entry_type | string | Yes | Classification | "HTTP" |
| http_method | string | Yes | GET/POST/PUT/DELETE/PATCH | "GET" |
| route_path | string | Yes | URL path pattern | "/api/users/{id}" |
| framework | string | Yes | Detected framework | "fastapi" |
| middleware | string[] | No | Middleware/guards | ["auth", "rate_limit"] |
| controller | string | No | Parent controller/class | "UserController" |
| file_path | string | Yes | Source file | "src/routes/users.py" |
| line | integer | Yes | Line number | 45 |

**Acceptance Criteria:**

1. Detects HTTP handlers for all 7 framework families listed above
2. Extracts HTTP method, route path, and handler function name
3. Resolves route prefixes from controller-level decorators (e.g., NestJS `@Controller("/users")`)
4. Handles route parameters (`:id`, `{id}`, `<int:id>`)
5. Detection accuracy >= 95% on test corpus of 100 handlers across frameworks

---

#### STORY 2: Main/CLI Entry Point Detection

> As a developer, I want main/CLI entry points detected so that I understand how the app starts.

**Requirement Details:**

| Language | Main Pattern | CLI Pattern |
|----------|-------------|-------------|
| Python | `if __name__ == "__main__":` | `@click.command()`, `argparse`, `typer.command()` |
| TypeScript/JS | Top-level execution, `process.argv` | `commander.command()`, `yargs.command()` |
| Java/Kotlin | `fun main()`, `public static void main(String[])` | `@Command` (picocli), Spring Boot `@SpringBootApplication` |
| Go | `func main()` | `cobra.Command{}`, flag package |
| Rust | `fn main()` | `clap::Command`, `structopt` |
| C# | `static void Main()`, top-level statements | `[Command]` attributes |

**Acceptance Criteria:**

1. Detects `main` functions in all 6 languages
2. Detects CLI command registrations for major CLI frameworks
3. Identifies Spring Boot / NestJS / Django application bootstrap entry points
4. Classifies as "MAIN" or "CLI" appropriately

---

#### STORY 3: Route Metadata Extraction

> As a security reviewer, I want route + method + middleware extracted so that I can audit access control.

**Requirement Details:**

1. Extract full route path including prefix resolution
2. Detect middleware/guards/interceptors applied to routes
3. Identify authentication requirements (auth decorators, guards)
4. Flag routes without authentication middleware

**Acceptance Criteria:**

1. Route paths fully resolved (controller prefix + method path)
2. Middleware chain extracted where framework supports it
3. Auth-related middleware identified and flagged
4. Unauthenticated routes flagged with warning

---

#### STORY 4: MCP Tool Exposure

> As an AI agent, I want to query entry points via MCP tool so that I can provide architecture context.

**Requirement Details:**

1. New MCP tool: `find_entry_points`
2. Input parameters:
   - `entry_type` (optional): Filter by type (HTTP, CLI, EVENT, MAIN, SCHEDULED)
   - `framework` (optional): Filter by framework
   - `http_method` (optional): Filter by HTTP method
   - `path_pattern` (optional): Regex filter on route path
   - `file_path` (optional): Filter by source file
   - `limit` (optional): Max results (default 50)
3. Output includes entry point details + summary statistics

**Acceptance Criteria:**

1. MCP tool `find_entry_points` registered and callable
2. Supports all filter parameters
3. Returns structured entry point data with route details
4. Includes summary (total endpoints by type, by framework, by method)
5. Response time < 200ms

---

#### STORY 5: Event Handler Detection

> As a developer, I want event handlers and scheduled tasks detected so that I have complete entry point coverage.

**Requirement Details:**

| Type | Pattern Examples |
|------|----------------|
| Event Listeners | `@EventListener`, `@On("event")`, `emitter.on("event")`, `@Subscribe` |
| Message Queue | `@RabbitListener`, `@KafkaListener`, `@SqsListener`, Celery `@task` |
| Scheduled Tasks | `@Scheduled`, `@Cron`, `setInterval`, cron decorators |
| WebSocket | `@WebSocketGateway`, `@SubscribeMessage`, `ws.on("message")` |
| GraphQL | `@Query`, `@Mutation`, `@Resolver`, resolver functions |

**Acceptance Criteria:**

1. Event listeners detected for major event systems
2. Message queue consumers detected (RabbitMQ, Kafka, SQS)
3. Scheduled tasks detected (cron, interval)
4. Each classified with appropriate entry_type

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Tree-sitter core integration | System | KSA-145 | AST parsing for decorator/annotation detection |
| TypeScript/JS parser | System | KSA-146 | Express/NestJS/Fastify patterns |
| Graph data model | System | KSA-153 | Storage for entry point relationships |
| Python parser | System | KSA-147 | FastAPI/Flask/Django patterns |
| Framework grammar knowledge | Configuration | N/A | Pattern definitions per framework |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | Development Team Lead | Approve requirements, prioritize |
| Developer | Code Intelligence Team | Implement detection engine |
| QA | QA Team | Verify detection accuracy across frameworks |
| Users | AI Agent developers, Security reviewers | Consume entry point data |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Framework-specific patterns change between versions | Medium | Medium | Version-aware patterns, configurable |
| Dynamic route registration not detectable via AST | High | High | Document limitation, flag dynamic patterns |
| Decorator/annotation resolution requires import analysis | Medium | Medium | Use graph engine for import resolution |
| Too many false positives for generic patterns | Medium | Medium | Confidence scoring, framework-specific validation |

### 5.2 Assumptions

- Static AST analysis sufficient for 90%+ of entry points (dynamic registration is edge case)
- Framework detection based on import statements + decorator patterns
- Route prefix resolution requires class-level decorator access (tree-sitter provides this)
- Entry points stored in dedicated table, not just symbol metadata

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Detection < 10ms per file | During indexing |
| Accuracy | >= 95% detection rate | On test corpus of 100 handlers |
| False Positive Rate | < 5% | Validated against manual review |
| Extensibility | New framework patterns via config | No code change for new frameworks |
| Coverage | 7 framework families minimum | 14+ specific frameworks |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-162 | [Quality] Entry Point & HTTP Handler Detection | To Do | Task | Main ticket |
| KSA-144 | Code Intelligence v2 — Graph Engine + Static Analysis | To Do | Epic | Parent epic |
| KSA-145 | [Tree-sitter] Core Integration | To Do | Task | Prerequisite (AST parsing) |
| KSA-153 | [Graph] Data Model & Storage | To Do | Task | Prerequisite (relationship storage) |
| KSA-161 | [Quality] Cyclomatic Complexity | To Do | Task | Related (complexity of handlers) |
| KSA-165 | [Security] Injection Detection | To Do | Task | Downstream (injection in handlers) |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Entry Point | A function that serves as an external interface to the application |
| HTTP Handler | A function that processes HTTP requests for a specific route |
| Route | URL path pattern mapped to a handler function |
| Middleware | Functions that process requests before/after the handler |
| Decorator | Language construct that annotates functions with metadata |

### Reference Documents

| Document | Location |
|----------|----------|
| CodeGraph vs FEC Comparison | documents/CodeGraph-vs-FEC-Comparison.md |
| CodeGraph entry_points tool | Section 3 of comparison doc |
| KSA-145 BRD | documents/KSA-145/BRD.md |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
