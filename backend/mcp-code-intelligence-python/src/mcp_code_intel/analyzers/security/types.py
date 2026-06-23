"""
Security Analysis — Shared type definitions.
Ported from KSA-164/165/166/167.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Literal, Optional


# ─── CFG Types (KSA-164) ───────────────────────────────────────────────────

BlockType = Literal["entry", "exit", "normal", "branch", "loop-header", "catch"]

EdgeType = Literal[
    "sequential", "branch-true", "branch-false",
    "loop-back", "loop-exit", "exception", "return"
]


@dataclass
class Statement:
    node: Any  # tree-sitter Node
    line: int
    type: str
    text: str


@dataclass
class VariableDef:
    name: str
    line: int
    block_id: int
    node: Any


@dataclass
class VariableUse:
    name: str
    line: int
    block_id: int
    node: Any


# ─── Data Flow Types (KSA-164) ─────────────────────────────────────────────

@dataclass(frozen=True)
class Definition:
    variable: str
    line: int
    block_id: int
    id: int


@dataclass
class DefUseChain:
    definition: Definition
    uses: list[dict]  # [{line, block_id}]


@dataclass
class DataFlowResult:
    reaching_defs: dict  # block_id -> set of Definition
    def_use_chains: list[DefUseChain]
    definitions: list[Definition]


# ─── Taint Types (KSA-164) ─────────────────────────────────────────────────

TaintSourceType = Literal[
    "http_param", "http_body", "http_header", "http_cookie",
    "url_param", "file_read", "env_var", "db_result",
    "user_input", "cli_arg", "websocket"
]

TaintSinkType = Literal[
    "sql_query", "shell_exec", "file_write", "file_path",
    "html_output", "eval", "deserialize", "ldap_query",
    "xml_parse", "url_fetch", "redirect", "log_output"
]

TaintStepAction = Literal[
    "assign", "concat", "template_literal", "format_string",
    "function_call", "collection_add", "destructure", "sanitize", "pass_through"
]


@dataclass
class TaintSource:
    variable: str
    type: str  # TaintSourceType
    line: int
    expression: str


@dataclass
class TaintSink:
    function: str
    type: str  # TaintSinkType
    line: int
    expression: str
    param_index: int


@dataclass
class TaintStep:
    variable: str
    line: int
    action: str  # TaintStepAction
    expression: str


@dataclass
class TaintPath:
    source: TaintSource
    sink: TaintSink
    chain: list[TaintStep]
    sanitized: bool
    length: int


@dataclass
class TaintResult:
    paths: list[TaintPath]
    sources: list[TaintSource]
    sinks: list[TaintSink]
    sanitizers: list[dict]


@dataclass
class TaintOptions:
    max_path_length: int = 20
    include_sanitized: bool = False
    sink_types: Optional[list[str]] = None
    source_types: Optional[list[str]] = None


# ─── Injection Types (KSA-165) ──────────────────────────────────────────────

Severity = Literal["Critical", "High", "Medium", "Low", "Info"]
Confidence = Literal["High", "Medium", "Low"]


@dataclass
class InjectionPattern:
    id: int
    name: str
    category: str
    cwe: str
    severity: str  # Severity
    sink_patterns: list[str]
    dangerous_ops: list[str]
    safe_patterns: list[str]
    description: str


@dataclass
class Finding:
    id: str
    rule_id: str
    category: str
    pattern: InjectionPattern
    taint_path: TaintPath
    severity: str  # Severity
    confidence: str  # Confidence
    cwe: str
    message: str
    remediation: str
    location: dict  # {file, start_line, end_line}
    suppressed: bool = False
    suppression_info: Optional[dict] = None


@dataclass
class SuppressionInfo:
    marker: str
    scope: str  # "line" | "block" | "file"
    line: int


@dataclass
class ScanOptions:
    file_path: Optional[str] = None
    include_suppressed: bool = False
    severity_threshold: Optional[str] = None
    categories: Optional[list[str]] = None
    output_format: str = "json"


@dataclass
class ScanResult:
    findings: list[Finding]
    suppressed: list[Finding]
    summary: dict


# ─── SSRF/IDOR Types (KSA-166) ──────────────────────────────────────────────

TrustTier = Literal["T1", "T2", "T3"]


@dataclass
class SSRFFinding:
    handler: str
    file_path: str
    source: TaintSource
    sink: TaintSink
    path: list[int]
    trust_tier: str  # TrustTier
    confidence: int
    missing_control: str
    cwe: str
    severity: str


@dataclass
class IDORFinding:
    handler: str
    file_path: str
    id_param: str
    db_lookup: dict  # {function, line}
    missing_authz_check: bool
    trust_tier: str  # TrustTier
    confidence: int
    cwe: str
    severity: str
