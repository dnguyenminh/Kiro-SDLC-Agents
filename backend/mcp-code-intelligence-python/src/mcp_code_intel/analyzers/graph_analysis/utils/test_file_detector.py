"""KSA-163: Test file detection heuristics."""
from __future__ import annotations
import re

_TEST_PATTERNS = [
    re.compile(r"\.test\.[jt]sx?$"), re.compile(r"\.spec\.[jt]sx?$"),
    re.compile(r"_test\.(py|go|rs)$"), re.compile(r"test_.*\.py$"),
    re.compile(r"Test\.java$"), re.compile(r"Test\.kt$"),
]
_TEST_DIRS = ["__tests__", "tests", "test", "spec"]


class TestFileDetector:
    def is_test_file(self, file_path: str) -> bool:
        normalized = file_path.replace("\\", "/")
        return (any(p.search(normalized) for p in _TEST_PATTERNS) or
                any(f"/{d}/" in normalized for d in _TEST_DIRS))

    def is_test_function(self, name: str) -> bool:
        return (name.startswith("test_") or name.startswith("Test") or
                name.startswith("it_") or name.startswith("should_") or
                bool(re.match(r"^(describe|it|test)\b", name)))
