"""RoleFilter — maps agent roles to relevant knowledge entry types."""

from __future__ import annotations

ROLE_TYPES: dict[str, set[str]] = {
    "DEV": {"CODE_ENTITY", "ARCHITECTURE", "API_DESIGN", "DECISION"},
    "BA": {"REQUIREMENT", "CONTEXT", "DECISION", "LESSON_LEARNED"},
    "QA": {"PROCEDURE", "REQUIREMENT", "ERROR_PATTERN", "LESSON_LEARNED"},
    "SA": {"ARCHITECTURE", "API_DESIGN", "CODE_ENTITY", "DECISION"},
    "DEVOPS": {"PROCEDURE", "ARCHITECTURE", "CONTEXT"},
}


def types_for_role(role: str | None) -> set[str] | None:
    """Get allowed types for a role. Returns None if no filter (all types)."""
    if not role or not role.strip():
        return None
    return ROLE_TYPES.get(role.upper())
