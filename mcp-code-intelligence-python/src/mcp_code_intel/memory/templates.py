"""KSA-73: Template Enforcement Engine."""

import json
import re
import sqlite3
from typing import Any


class TemplateEngine:
    """Enforce content templates on knowledge entries."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def create_template(self, name: str, type_: str,
                        required_sections: list[str],
                        schema: dict | None = None) -> dict[str, Any]:
        """Create a new content template."""
        schema_json = json.dumps(schema or {})
        sections_str = ",".join(required_sections)
        self._conn.execute(
            """INSERT OR REPLACE INTO content_templates
               (name, type, schema_json, required_sections)
               VALUES (?, ?, ?, ?)""",
            (name, type_, schema_json, sections_str),
        )
        self._conn.commit()
        return {"name": name, "type": type_, "sections": required_sections}

    def list_templates(self) -> list[dict[str, Any]]:
        """List all available templates."""
        cur = self._conn.execute(
            "SELECT * FROM content_templates ORDER BY type, name"
        )
        results = []
        for row in cur.fetchall():
            d = dict(row)
            d["required_sections"] = d["required_sections"].split(",") if d["required_sections"] else []
            d["schema"] = json.loads(d["schema_json"])
            del d["schema_json"]
            results.append(d)
        return results

    def validate_entry(self, entry_id: int) -> dict[str, Any]:
        """Validate an entry against its type's template."""
        entry = self._get_entry(entry_id)
        if not entry:
            return {"error": f"Entry {entry_id} not found"}

        template = self._get_template_for_type(entry["type"])
        if not template:
            return {"entry_id": entry_id, "valid": True, "message": "No template for type"}

        violations = self._check_violations(entry, template)
        is_valid = len(violations) == 0

        self._conn.execute(
            """INSERT INTO template_validations (entry_id, template_id, is_valid, violations)
               VALUES (?, ?, ?, ?)""",
            (entry_id, template["id"], int(is_valid), json.dumps(violations)),
        )
        self._conn.commit()

        return {
            "entry_id": entry_id,
            "template": template["name"],
            "valid": is_valid,
            "violations": violations,
        }

    def validate_content(self, content: str, type_: str) -> dict[str, Any]:
        """Validate content against a type's template (pre-ingest check)."""
        template = self._get_template_for_type(type_)
        if not template:
            return {"valid": True, "message": "No template for type"}

        violations = self._check_content_violations(content, template)
        return {
            "template": template["name"],
            "valid": len(violations) == 0,
            "violations": violations,
        }

    def get_template_for_type(self, type_: str) -> dict[str, Any] | None:
        """Get template for a given entry type."""
        return self._get_template_for_type(type_)

    def _get_template_for_type(self, type_: str) -> dict[str, Any] | None:
        """Internal: find template matching type."""
        cur = self._conn.execute(
            "SELECT * FROM content_templates WHERE type = ? LIMIT 1", (type_,)
        )
        row = cur.fetchone()
        if not row:
            return None
        d = dict(row)
        d["required_sections"] = d["required_sections"].split(",") if d["required_sections"] else []
        return d

    def _check_violations(self, entry: dict, template: dict) -> list[str]:
        """Check entry against template requirements."""
        return self._check_content_violations(entry["content"], template)

    @staticmethod
    def _check_content_violations(content: str, template: dict) -> list[str]:
        """Check content string against template."""
        violations = []
        sections = template["required_sections"]
        if isinstance(sections, str):
            sections = sections.split(",") if sections else []

        for section in sections:
            section = section.strip()
            if not section:
                continue
            escaped = re.escape(section)
            pattern = r"(?i)(#{1,3}\s*" + escaped + r"|" + escaped + r"\s*:)"
            if not re.search(pattern, content):
                violations.append(f"Missing required section: '{section}'")

        if len(content.strip()) < 50:
            violations.append("Content too short (minimum 50 characters)")

        return violations

    def _get_entry(self, entry_id: int) -> dict[str, Any] | None:
        """Get entry by ID."""
        cur = self._conn.execute(
            "SELECT * FROM knowledge_entries WHERE id = ?", (entry_id,)
        )
        row = cur.fetchone()
        return dict(row) if row else None
