"""KSA-165: SQL Injection Matcher."""
from ..pattern_matcher import PatternMatcher
from ...types import InjectionPattern


class SQLInjectionMatcher(PatternMatcher):
    @property
    def category(self) -> str:
        return "sql_injection"

    @property
    def patterns(self) -> list[InjectionPattern]:
        return [
            InjectionPattern(id=1, name="String Concatenation in SQL Query", category="sql_injection", cwe="CWE-89", severity="Critical",
                sink_patterns=["query(", "execute(", "raw(", "knex.raw", "sequelize.query", "db.run(", "cursor.execute"],
                dangerous_ops=["concat", "template_literal", "format_string"],
                safe_patterns=["?", "$1", "%s", "prepare", "parameterize"],
                description="Use parameterized queries instead of string concatenation."),
            InjectionPattern(id=2, name="Template Literal in SQL Query", category="sql_injection", cwe="CWE-89", severity="Critical",
                sink_patterns=["query(", "execute(", "raw(", "knex.raw", "sequelize.query"],
                dangerous_ops=["template_literal"],
                safe_patterns=["?", "$1", "tagged_template", "sql`"],
                description="Use tagged template literals or parameterized queries."),
            InjectionPattern(id=3, name="Dynamic Table/Column Name in SQL", category="sql_injection", cwe="CWE-89", severity="High",
                sink_patterns=["query(", "execute(", "raw("],
                dangerous_ops=["concat", "template_literal", "format_string"],
                safe_patterns=["whitelist", "allowedColumns", "allowedTables", "includes("],
                description="Validate table/column names against a whitelist."),
            InjectionPattern(id=4, name="ORM Raw Query with User Input", category="sql_injection", cwe="CWE-89", severity="High",
                sink_patterns=["raw(", "rawQuery(", "literal(", "$queryRaw"],
                dangerous_ops=["concat", "template_literal", "format_string", "pass_through"],
                safe_patterns=["bind", "replacements", "Prisma.sql"],
                description="Use ORM binding parameters."),
        ]
