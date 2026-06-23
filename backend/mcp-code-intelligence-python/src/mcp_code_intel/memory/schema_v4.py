"""Schema V4 — Agent identification for knowledge entries.

Adds agent_name column to track which agent created each entry.
"""

# Add agent_name column to knowledge_entries
SCHEMA_V4_AGENT_NAME_ALTER = [
    "ALTER TABLE knowledge_entries ADD COLUMN agent_name TEXT DEFAULT NULL",
]

SCHEMA_V4_AGENT_NAME_INDEX = """
CREATE INDEX IF NOT EXISTS idx_ke_agent_name ON knowledge_entries(agent_name)
"""
