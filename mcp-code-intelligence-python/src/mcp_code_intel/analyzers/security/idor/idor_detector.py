"""
KSA-166: IDOR Detector — Detects Insecure Direct Object Reference vulnerabilities.
"""

from __future__ import annotations
import re
from typing import Any, Optional
from ..taint.taint_analyzer import TaintAnalyzer
from ..types import IDORFinding


_ID_PARAM_PATTERNS = [
    re.compile(r"id$", re.IGNORECASE),
    re.compile(r"Id$"),
    re.compile(r"_id$", re.IGNORECASE),
    re.compile(r"Id\b"),
    re.compile(r"uuid", re.IGNORECASE),
    re.compile(r"key$", re.IGNORECASE),
    re.compile(r"slug", re.IGNORECASE),
    re.compile(r"params\.id"),
    re.compile(r"params\.\w+Id"),
    re.compile(r"params\.\w+_id"),
]

_DB_LOOKUP_PATTERNS = [
    "findById(", "findOne(", "findByPk(", "get(", ".find(",
    "findUnique(", "findFirst(", "getOne(", "load(",
    "SELECT", "WHERE", "query(",
]

_AUTHZ_PATTERNS = [
    "owner", "user_id", "userId", "createdBy", "belongsTo",
    "canAccess", "isOwner", "hasPermission", "authorize",
    "checkAccess", "verifyOwnership", "req.user.id",
    "currentUser", "session.user",
]


class IDORDetector:
    def __init__(self, taint_analyzer: Optional[TaintAnalyzer] = None) -> None:
        self._taint_analyzer = taint_analyzer or TaintAnalyzer()

    def detect(self, function_node: Any, file_path: str, language: str, handler_name: str) -> list[IDORFinding]:
        """Detect IDOR in a handler function."""
        findings: list[IDORFinding] = []
        body_text_raw = function_node.text
        body_text = body_text_raw.decode("utf-8", errors="replace") if isinstance(body_text_raw, bytes) else str(body_text_raw)

        # Step 1: Find ID parameters
        id_params = self._find_id_params(body_text)
        if not id_params:
            return []

        # Step 2: For each ID param, check if there's a DB lookup
        for param in id_params:
            db_lookup = self._find_db_lookup(body_text, param)
            if not db_lookup:
                continue

            # Step 3: Check if there's an authorization check
            has_authz = self._has_authorization_check(body_text)

            if not has_authz:
                trust_tier = self._classify_trust_tier(body_text, param)
                findings.append(IDORFinding(
                    handler=handler_name,
                    file_path=file_path,
                    id_param=param,
                    db_lookup=db_lookup,
                    missing_authz_check=True,
                    trust_tier=trust_tier,
                    confidence=90 if trust_tier == "T1" else 70 if trust_tier == "T2" else 50,
                    cwe="CWE-639",
                    severity="High" if trust_tier == "T1" else "Medium",
                ))

        return findings

    def _find_id_params(self, text: str) -> list[str]:
        params: list[str] = []
        for pattern in _ID_PARAM_PATTERNS:
            matches = pattern.findall(text)
            for match in matches:
                if match not in params:
                    params.append(match)
        return params

    def _find_db_lookup(self, body_text: str, param: str) -> Optional[dict]:
        for pattern in _DB_LOOKUP_PATTERNS:
            idx = body_text.find(pattern)
            if idx != -1:
                context = body_text[max(0, idx - 50):idx + 100]
                if param in context or self._is_nearby(body_text, idx, param):
                    line = body_text[:idx].count("\n") + 1
                    return {"function": pattern.rstrip("("), "line": line}
        return None

    def _has_authorization_check(self, body_text: str) -> bool:
        return any(pattern in body_text for pattern in _AUTHZ_PATTERNS)

    def _classify_trust_tier(self, body_text: str, param: str) -> str:
        lines = body_text.split("\n")
        param_line = -1
        lookup_line = -1

        for i, line in enumerate(lines):
            if param in line and param_line == -1:
                param_line = i
            if any(p in line for p in _DB_LOOKUP_PATTERNS):
                lookup_line = i

        if param_line >= 0 and lookup_line >= 0:
            distance = abs(lookup_line - param_line)
            if distance <= 2:
                return "T1"
            if distance <= 5:
                return "T2"
        return "T3"

    def _is_nearby(self, text: str, idx: int, param: str) -> bool:
        window = text[max(0, idx - 200):idx + 200]
        return param in window
