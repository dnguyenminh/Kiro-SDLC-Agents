# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-167: [Security] Misconfig + Secrets + SBOM + SARIF

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-167 |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-07 |
| Related FSD | FSD-v1-KSA-167.docx |

---

## 1. Architecture Overview

Four security modules providing supply-chain and configuration security analysis.

```
┌─────────────────────────────────────────────────────┐
│ MCP Tools (scan_misconfig, detect_secrets, etc.)     │
├─────────────────────────────────────────────────────┤
│ Security Modules (NEW)                               │
│  ├── MisconfigScanner                               │
│  │   ├── ConfigFileParser (env/yml/json/toml/xml)   │
│  │   ├── MisconfigPatternRegistry (20 patterns)    │
│  │   └── CodeMisconfigDetector                      │
│  ├── SecretsDetector                                │
│  │   ├── EntropyAnalyzer (Shannon)                  │
│  │   ├── SecretPatternRegistry (10+ patterns)      │
│  │   ├── ContextAnalyzer (variable names)           │
│  │   └── ExclusionFilter                            │
│  ├── SBOMGenerator                                  │
│  │   ├── LockfileParser (8 formats)                │
│  │   ├── PURLGenerator                              │
│  │   └── CycloneDXFormatter                         │
│  ├── DependencyAuditor                              │
│  │   ├── OSVClient (API + cache)                   │
│  │   └── VulnerabilityMatcher                       │
│  └── SARIFExporter                                  │
│      ├── RuleMapper (CWE → SARIF rules)            │
│      └── LocationFormatter                          │
├─────────────────────────────────────────────────────┤
│ Shared: SuppressionChecker, FindingAggregator        │
└─────────────────────────────────────────────────────┘
```

---

## 2. Module Design

### 2.1 File Structure

```
src/mcp_code_intel/
├── analyzers/
│   └── security/
│       ├── misconfig/
│       │   ├── __init__.py
│       │   ├── misconfig_scanner.py    # Orchestrator
│       │   ├── config_file_parser.py   # Parse .env/.yml/.json etc.
│       │   ├── pattern_registry.py     # 20 misconfig patterns
│       │   └── code_misconfig.py       # Detect misconfigs in source
│       ├── secrets/
│       │   ├── __init__.py
│       │   ├── secrets_detector.py     # Orchestrator
│       │   ├── entropy_analyzer.py     # Shannon entropy
│       │   ├── pattern_registry.py     # Known secret patterns
│       │   ├── context_analyzer.py     # Variable name analysis
│       │   └── exclusion_filter.py     # Test/placeholder exclusions
│       ├── sbom/
│       │   ├── __init__.py
│       │   ├── sbom_generator.py       # Orchestrator
│       │   ├── lockfile_parsers/
│       │   │   ├── npm.py              # package-lock.json, yarn.lock
│       │   │   ├── pip.py              # requirements.txt, poetry.lock
│       │   │   ├── maven.py            # pom.xml, gradle.lockfile
│       │   │   ├── go.py               # go.sum
│       │   │   ├── cargo.py            # Cargo.lock
│       │   │   ├── composer.py         # composer.lock
│       │   │   ├── gems.py             # Gemfile.lock
│       │   │   └── nuget.py            # packages.lock.json
│       │   ├── purl_generator.py       # Package URL generation
│       │   └── cyclonedx_formatter.py  # CycloneDX 1.5 output
│       ├── audit/
│       │   ├── __init__.py
│       │   ├── dependency_auditor.py   # Orchestrator
│       │   ├── osv_client.py           # OSV API client + cache
│       │   └── vuln_matcher.py         # Version range matching
│       └── sarif/
│           ├── __init__.py
│           ├── sarif_exporter.py       # SARIF 2.1.0 formatter
│           ├── rule_mapper.py          # CWE → SARIF rule mapping
│           └── location_formatter.py   # File/line → SARIF location
```

### 2.2 Key Classes

#### EntropyAnalyzer

```python
class EntropyAnalyzer:
    """Shannon entropy analysis for secret detection."""
    
    def __init__(self, threshold: float = 4.5):
        self.threshold = threshold
    
    def compute_entropy(self, text: str) -> float:
        """Compute Shannon entropy (bits per character)."""
        if not text:
            return 0.0
        freq = Counter(text)
        length = len(text)
        entropy = -sum((count/length) * log2(count/length) for count in freq.values())
        return entropy
    
    def is_high_entropy(self, text: str) -> bool:
        """Check if string has suspiciously high entropy."""
        return len(text) >= 8 and self.compute_entropy(text) > self.threshold
```

#### LockfileParser (Abstract)

```python
class LockfileParser(ABC):
    """Base class for lockfile parsers."""
    
    @abstractmethod
    def can_parse(self, file_path: str) -> bool:
        """Check if this parser handles the given file."""
    
    @abstractmethod
    def parse(self, file_path: str) -> list[Dependency]:
        """Parse lockfile and return dependencies."""

@dataclass
class Dependency:
    name: str
    version: str
    scope: str  # "required" or "dev"
    hashes: list[str]
    license: Optional[str]
    ecosystem: str  # npm, pypi, maven, etc.
```

#### OSVClient

```python
class OSVClient:
    """Client for OSV.dev vulnerability API with caching."""
    
    def __init__(self, cache_ttl: int = 86400):  # 24h
        self.cache_ttl = cache_ttl
        self.cache: dict[str, CachedResult] = {}
    
    async def query_batch(self, packages: list[PackageQuery]) -> list[Vulnerability]:
        """Batch query OSV API for vulnerabilities."""
        # POST https://api.osv.dev/v1/querybatch
        
    def _check_cache(self, package: str, version: str) -> Optional[list[Vulnerability]]:
        """Check local cache before API call."""
```

#### SARIFExporter

```python
class SARIFExporter:
    """Export security findings as SARIF v2.1.0."""
    
    def export(self, findings: list[SecurityFinding], output_path: str) -> SARIFReport:
        """Generate SARIF report from all findings."""
        
    def _build_rules(self, findings) -> list[SARIFRule]:
        """Build SARIF rule definitions from CWE codes."""
        
    def _build_results(self, findings) -> list[SARIFResult]:
        """Convert findings to SARIF results with locations."""
```

---

## 3. Configuration

### 3.1 Misconfig Patterns (config-driven)

```yaml
# config/security/misconfig_patterns.yaml
patterns:
  - id: "MISC-001"
    name: "Debug Mode Enabled"
    cwe: "CWE-489"
    severity: "High"
    config_patterns:
      - key_regex: "^(DEBUG|debug)$"
        value_regex: "^(true|True|1|yes)$"
        files: ["*.env", "settings.py", "application.yml"]
    code_patterns:
      - regex: "app\\.debug\\s*=\\s*True"
      - regex: "DEBUG\\s*=\\s*True"
```

### 3.2 Secret Patterns

```yaml
# config/security/secret_patterns.yaml
patterns:
  - id: "SEC-001"
    name: "AWS Access Key"
    regex: "AKIA[0-9A-Z]{16}"
    entropy_required: false
    severity: "Critical"
  - id: "SEC-008"
    name: "Generic API Key"
    regex: "(api[_-]?key|secret|token)\\s*[:=]\\s*['\"][^'\"]{16,}['\"]"
    entropy_required: true
    min_entropy: 4.5
    severity: "High"
```

---

## 4. Performance Design

| Operation | Target | Approach |
|-----------|--------|----------|
| Misconfig scan | < 10s | Regex on config files only |
| Secrets scan | < 15s | Entropy pre-filter, then pattern match |
| SBOM generation | < 5s | Direct lockfile parse |
| Dep audit | < 30s | Batch OSV API + cache |
| SARIF export | < 2s | In-memory formatting |

---

## 5. Implementation Checklist

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | MisconfigScanner + 20 patterns | misconfig/ | 2d |
| 2 | EntropyAnalyzer | secrets/entropy_analyzer.py | 0.5d |
| 3 | SecretPatternRegistry | secrets/pattern_registry.py | 1d |
| 4 | SecretsDetector orchestrator | secrets/secrets_detector.py | 1d |
| 5 | LockfileParsers (8 formats) | sbom/lockfile_parsers/ | 3d |
| 6 | CycloneDX formatter | sbom/cyclonedx_formatter.py | 1d |
| 7 | OSVClient + cache | audit/osv_client.py | 1d |
| 8 | DependencyAuditor | audit/dependency_auditor.py | 0.5d |
| 9 | SARIFExporter | sarif/sarif_exporter.py | 1d |
| 10 | MCP tool integration | tools/ | 1d |
| 11 | Tests | tests/security/ | 2d |

**Total estimate:** ~14 days (2 weeks matches Jira estimate)

---

## 6. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
