# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-166: [Security] SSRF + IDOR + Missing Auth Detection

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-166 |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-07 |
| Related FSD | FSD-v1-KSA-166.docx |

---

## 1. Architecture Overview

Three security detectors built on top of the taint analysis (KSA-164) and entry point detection (KSA-162) infrastructure.

```
┌─────────────────────────────────────────────────────┐
│ MCP Tools (security_scan, detect_ssrf, etc.)         │
├─────────────────────────────────────────────────────┤
│ Security Detectors (NEW)                             │
│  ├── SSRFDetector                                   │
│  │   ├── URLParamExtractor                          │
│  │   ├── OutboundHTTPSinkRegistry                   │
│  │   └── URLValidationChecker                       │
│  ├── IDORDetector                                   │
│  │   ├── IDParamExtractor                           │
│  │   ├── DBLookupFinder                             │
│  │   └── AuthzCheckRecognizer                       │
│  ├── MissingAuthDetector                            │
│  │   ├── HandlerGrouper                             │
│  │   ├── AuthMiddlewareRecognizer                   │
│  │   └── PublicEndpointExcluder                     │
│  └── TrustTierClassifier                            │
├─────────────────────────────────────────────────────┤
│ Shared Infrastructure                                │
│  ├── Taint Analysis (KSA-164)                       │
│  ├── Entry Point Detection (KSA-162)                │
│  └── Suppression Checker (KSA-165)                  │
└─────────────────────────────────────────────────────┘
```

---

## 2. Module Design

### 2.1 File Structure

```
src/mcp_code_intel/
├── analyzers/
│   └── security/
│       ├── ssrf/
│       │   ├── __init__.py
│       │   ├── ssrf_detector.py       # Main SSRF detection logic
│       │   ├── url_param_extractor.py # Extract URL params from requests
│       │   ├── http_sink_registry.py  # Outbound HTTP function registry
│       │   └── url_validator_checker.py # Check for URL validation
│       ├── idor/
│       │   ├── __init__.py
│       │   ├── idor_detector.py       # Main IDOR detection logic
│       │   ├── id_param_extractor.py  # Extract ID params from routes
│       │   ├── db_lookup_finder.py    # Find DB lookups using params
│       │   └── authz_recognizer.py    # Recognize authorization checks
│       ├── auth/
│       │   ├── __init__.py
│       │   ├── missing_auth_detector.py  # Main missing auth logic
│       │   ├── handler_grouper.py     # Group handlers by controller
│       │   ├── auth_middleware_recognizer.py # Detect auth patterns
│       │   └── public_endpoint_excluder.py  # Known-public exclusions
│       └── trust_tier.py              # Trust-tier classification
```

### 2.2 Class Design

#### SSRFDetector

```python
class SSRFDetector:
    """Detect Server-Side Request Forgery vulnerabilities."""
    
    def __init__(self, taint_analyzer, entry_points, sink_registry):
        self.taint = taint_analyzer
        self.entry_points = entry_points
        self.sinks = sink_registry
    
    def detect(self, file_path: Optional[str] = None) -> list[SSRFFinding]:
        """Run SSRF detection on handlers."""
        
    def _is_url_param(self, param: TaintSource) -> bool:
        """Check if parameter likely contains URL/hostname."""
        
    def _has_url_validation(self, path: TaintPath) -> bool:
        """Check if taint path passes through URL validation."""

@dataclass
class SSRFFinding:
    handler: HandlerInfo
    source: TaintSource  # URL parameter
    sink: TaintSink      # Outbound HTTP call
    path: list[int]      # Line numbers
    trust_tier: str      # T1/T2/T3
    confidence: int      # 0-100
    missing_control: str # What's missing
```

#### IDORDetector

```python
class IDORDetector:
    """Detect Insecure Direct Object Reference vulnerabilities."""
    
    def detect(self, file_path: Optional[str] = None) -> list[IDORFinding]:
        """Run IDOR detection on handlers with ID parameters."""
        
    def _extract_id_params(self, handler) -> list[Parameter]:
        """Find parameters that look like object IDs."""
        
    def _find_db_lookups(self, param, handler_body) -> list[DBLookup]:
        """Find database lookups using the parameter."""
        
    def _has_authz_check(self, param, lookup, handler_body) -> Optional[AuthzCheck]:
        """Check for authorization between param and lookup."""
```

#### MissingAuthDetector

```python
class MissingAuthDetector:
    """Detect REST handlers missing authentication."""
    
    def __init__(self, threshold: float = 0.7):
        self.threshold = threshold
        self.public_patterns = ["login", "register", "health", "docs", "swagger", "openapi"]
    
    def detect(self) -> list[MissingAuthFinding]:
        """Find handlers without auth when siblings have it."""
        
    def _group_handlers(self, handlers) -> dict[str, list[Handler]]:
        """Group handlers by controller/router."""
        
    def _has_auth(self, handler) -> Optional[AuthInfo]:
        """Check if handler has auth middleware/decorator."""
```

#### TrustTierClassifier

```python
class TrustTierClassifier:
    """Classify findings by trust tier (T1/T2/T3)."""
    
    def classify(self, finding) -> str:
        """Classify based on directness of data flow."""
        # T1: Direct (1-2 steps, no intermediate processing)
        # T2: Partial (3-5 steps, some processing but no validation)
        # T3: Indirect (6+ steps, or through config/lookup)
```

---

## 3. Sink & Pattern Registries

### 3.1 SSRF HTTP Sink Registry (config-driven)

```yaml
# config/security/ssrf_sinks.yaml
python:
  - module: "requests"
    functions: ["get", "post", "put", "delete", "patch", "head", "options"]
    url_param_index: 0
  - module: "urllib.request"
    functions: ["urlopen"]
    url_param_index: 0
  - module: "httpx"
    functions: ["get", "post", "put", "delete"]
    url_param_index: 0

typescript:
  - function: "fetch"
    url_param_index: 0
  - module: "axios"
    functions: ["get", "post", "put", "delete"]
    url_param_index: 0
```

### 3.2 Authorization Pattern Registry

```yaml
# config/security/auth_patterns.yaml
decorators:
  - "@login_required"
  - "@require_role"
  - "@authenticated"
  - "@PreAuthorize"
  - "@Secured"
  - "@RolesAllowed"

middleware:
  - pattern: "authenticate\\("
  - pattern: "authMiddleware"
  - pattern: "AuthGuard"
  - pattern: "Depends\\(get_current_user\\)"

ownership_checks:
  - pattern: "\\.owner_id\\s*==\\s*.*user"
  - pattern: "\\.user_id\\s*==\\s*.*current"
  - pattern: "belongs_to\\?"
```

---

## 4. Performance Design

| Operation | Target | Approach |
|-----------|--------|----------|
| SSRF scan (single file) | < 1s | Cached taint paths |
| IDOR scan (single file) | < 1s | Pattern matching |
| Missing auth (full project) | < 5s | Handler grouping |
| Combined scan (100 files) | < 60s | Parallel per-file |

---

## 5. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | SSRFDetector | security/ssrf/ssrf_detector.py | 2d |
| 2 | HTTP Sink Registry | security/ssrf/http_sink_registry.py | 1d |
| 3 | URL Validation Checker | security/ssrf/url_validator_checker.py | 1d |
| 4 | IDORDetector | security/idor/idor_detector.py | 2d |
| 5 | AuthzCheckRecognizer | security/idor/authz_recognizer.py | 1d |
| 6 | MissingAuthDetector | security/auth/missing_auth_detector.py | 1.5d |
| 7 | Auth Middleware Recognizer | security/auth/auth_middleware_recognizer.py | 1d |
| 8 | TrustTierClassifier | security/trust_tier.py | 0.5d |
| 9 | Config files (sinks, patterns) | config/security/*.yaml | 1d |
| 10 | MCP tool integration | tools/security_scan_tool.py | 1d |
| 11 | Tests | tests/security/ | 2d |

**Total estimate:** ~14 days (2 weeks matches Jira estimate)

---

## 6. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
