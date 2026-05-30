"""KSA-161: Complexity Analyzer — Models (re-export from __init__)."""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Grade(str, Enum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"
    F = "F"


class SortBy(str, Enum):
    COMPLEXITY = "complexity"
    NAME = "name"
    FILE = "file"


@dataclass
class DecisionPointCounts:
    branches: int = 0
    loops: int = 0
    logical_ops: int = 0
    exception_handlers: int = 0


@dataclass
class ComplexityBreakdown:
    cyclomatic_complexity: int
    branches: int
    loops: int
    logical_ops: int
    exception_handlers: int
    nesting_depth: int
    early_returns: int


@dataclass
class ComplexityResult:
    symbol_id: int
    symbol_name: str
    file_path: str
    start_line: int
    end_line: int
    grade: Grade
    cyclomatic_complexity: int
    branches: int
    loops: int
    logical_ops: int
    exception_handlers: int
    nesting_depth: int
    early_returns: int


@dataclass
class FileComplexityResult:
    file_path: str
    functions: list[ComplexityResult]
    average_complexity: float
    max_complexity: int
    total_functions: int


@dataclass
class ComplexityFilters:
    file_path: Optional[str] = None
    symbol_name: Optional[str] = None
    min_complexity: Optional[int] = None
    grade_filter: Optional[list[Grade]] = None
    module: Optional[str] = None
    limit: int = 20
    sort_by: SortBy = SortBy.COMPLEXITY


@dataclass
class ComplexitySummary:
    average: float
    grade_distribution: dict[Grade, int] = field(default_factory=dict)


@dataclass
class ComplexityQueryResult:
    results: list[ComplexityResult]
    total: int
    summary: ComplexitySummary


@dataclass
class GradeThresholds:
    a: int = 5
    b: int = 10
    c: int = 20
    d: int = 50
