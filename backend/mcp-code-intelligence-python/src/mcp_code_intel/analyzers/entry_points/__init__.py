"""KSA-162: Entry Point Detection — Models and types."""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class EntryType(str, Enum):
    HTTP_HANDLER = "HTTP_HANDLER"
    MAIN = "MAIN"
    CLI_COMMAND = "CLI_COMMAND"
    EVENT_HANDLER = "EVENT_HANDLER"
    SCHEDULED = "SCHEDULED"


class Confidence(str, Enum):
    High = "High"
    Medium = "Medium"
    Low = "Low"


@dataclass
class EntryPoint:
    symbol_id: int
    symbol_name: str
    file_path: str
    start_line: int
    entry_type: EntryType
    framework: Optional[str] = None
    http_method: Optional[str] = None
    route_path: Optional[str] = None
    full_route: Optional[str] = None
    middleware: list[str] = field(default_factory=list)
    has_auth: bool = False
    controller: Optional[str] = None
    event_name: Optional[str] = None
    confidence: Confidence = Confidence.Medium


@dataclass
class FrameworkInfo:
    name: str
    language: str
    confidence: Confidence


@dataclass
class EntryPointFilters:
    entry_type: Optional[EntryType] = None
    framework: Optional[str] = None
    http_method: Optional[str] = None
    route_pattern: Optional[str] = None
    has_auth: Optional[bool] = None
    file_path: Optional[str] = None
    limit: int = 30


@dataclass
class AuthCoverage:
    with_auth: int
    without_auth: int


@dataclass
class EntryPointSummary:
    by_type: dict[str, int]
    by_framework: dict[str, int]
    auth_coverage: AuthCoverage


@dataclass
class EntryPointQueryResult:
    results: list[EntryPoint]
    total: int
    summary: EntryPointSummary


@dataclass
class FrameworkPatterns:
    language: str
    imports: list[str]
    decorators: Optional[dict[str, list[str]]] = None
    call_patterns: Optional[dict[str, list[str]]] = None
    auth_indicators: list[str] = field(default_factory=list)


@dataclass
class SymbolInput:
    id: int
    name: str
    file_path: str
    start_line: int
    decorators: Optional[list[str]] = None
    parent_name: Optional[str] = None
