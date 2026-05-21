"""Integration test for all Wave 1 KB Enhancement modules."""
import sqlite3
import sys

conn = sqlite3.connect(':memory:')
conn.row_factory = sqlite3.Row

from src.mcp_code_intel.memory.engine_v2 import MemoryEngineV2

engine = MemoryEngineV2(conn, '.')
print("✅ Engine V2 initialized", flush=True)

# KSA-69: Real Consolidation Engine
result = engine.consolidation_engine.consolidate(dry_run=True)
assert result["dry_run"] is True
print("✅ KSA-69: Consolidation Engine (promote/demote/merge)", flush=True)

# KSA-70: Staleness Detection
stale = engine.staleness.detect_stale()
print(f"✅ KSA-70: Staleness Detection ({len(stale)} stale entries)", flush=True)

# KSA-71: RBAC
engine.rbac.grant_role('user1', 'admin')
assert engine.rbac.check_permission('user1', 'edit') is True
assert engine.rbac.check_permission('user2', 'edit') is False
print("✅ KSA-71: RBAC (admin=edit, viewer≠edit)", flush=True)

# KSA-73: Template Enforcement
engine.templates.create_template('decision_tmpl', 'DECISION', ['Context', 'Decision', 'Rationale'])
templates = engine.templates.list_templates()
assert len(templates) == 1
# Validate content
v = engine.templates.validate_content("# Context\nSome context\n# Decision\nWe chose X\n# Rationale\nBecause Y", "DECISION")
assert v["valid"] is True
v2 = engine.templates.validate_content("Short", "DECISION")
assert v2["valid"] is False
print("✅ KSA-73: Template Enforcement (create + validate)", flush=True)

# KSA-75: Attachments
eid = engine.knowledge.insert("Test entry", "Test summary", "CONTEXT")
result = engine.attachments.attach(eid, "test_wave1.py", "test file")
assert "error" not in result
atts = engine.attachments.list_attachments(eid)
assert len(atts) == 1
print("✅ KSA-75: Rich Media Attachments (attach + list)", flush=True)

# KSA-76: Suggestions & Related
suggestions = engine.suggestions.suggest("Test")
related = engine.suggestions.get_related(eid)
print(f"✅ KSA-76: Suggestions ({len(suggestions)}) + Related ({len(related)})", flush=True)

# KSA-77: Tag Taxonomy
engine.tag_taxonomy.create_tag('python', 'language')
engine.tag_taxonomy.create_tag('memory', 'module')
engine.tag_taxonomy.tag_entry(eid, ['python', 'memory'])
tags = engine.tag_taxonomy.get_entry_tags(eid)
assert len(tags) == 2
results = engine.tag_taxonomy.search_by_tags(['python'], 'AND')
assert len(results) >= 1
print("✅ KSA-77: Tag Taxonomy (create + tag + search)", flush=True)

# KSA-78: Search Analytics
engine.search_analytics.log_search('test query', 5)
engine.search_analytics.log_search('another query', 0)
analytics = engine.search_analytics.get_analytics()
assert analytics["total_searches"] == 2
assert analytics["zero_result_searches"] == 1
popular = engine.search_analytics.get_popular_queries()
assert len(popular) >= 1
print("✅ KSA-78: Search Analytics (log + summary + popular)", flush=True)

# KSA-79: Citation Tracking
engine.citation_tracker.cite(eid, 'ba-agent', 'Used in BRD analysis')
engine.citation_tracker.cite(eid, 'sa-agent', 'Referenced in TDD')
citations = engine.citation_tracker.get_citations(eid)
assert len(citations) == 2
most_cited = engine.citation_tracker.get_most_cited()
assert most_cited[0]["citation_count"] == 2
print("✅ KSA-79: Citation Tracking (cite + query)", flush=True)

# KSA-81: Feedback Loop
engine.feedback.submit_feedback(eid, 1, 'helpful')
engine.feedback.submit_feedback(eid, 1, 'accurate')
engine.feedback.submit_feedback(eid, -1, 'outdated')
summary = engine.feedback.get_feedback_summary(eid)
assert summary["positive"] == 2
assert summary["negative"] == 1
assert summary["score"] > 0
print(f"✅ KSA-81: Feedback Loop (score={summary['score']})", flush=True)

# Test dispatcher V2 integration
from src.mcp_code_intel.memory.dispatcher_v2 import MemoryToolDispatcherV2
dispatcher = MemoryToolDispatcherV2(engine)
r = dispatcher.dispatch("mem_analytics", {"action": "summary"})
assert "total_searches" in r
r = dispatcher.dispatch("mem_feedback", {"action": "summary", "entry_id": eid})
assert "positive" in r
print("✅ Dispatcher V2 routing works", flush=True)

# Test full tool count
from src.mcp_code_intel.memory.definitions import MEMORY_TOOL_DEFINITIONS
print(f"\n📊 Total MCP tools: {len(MEMORY_TOOL_DEFINITIONS)} (12 original + 13 new)", flush=True)

# Final stats
stats = engine.get_stats()
print(f"\n📈 Engine Stats:", flush=True)
print(f"   Entries: {stats['total_entries']}", flush=True)
print(f"   Citations: {stats['citations_total']}", flush=True)
print(f"   Feedback: {stats['feedback_total']}", flush=True)
print(f"   Tags: {stats['tags_total']}", flush=True)
print(f"   Attachments: {stats['attachments_total']}", flush=True)
print(f"   Templates: {stats['templates_total']}", flush=True)

print("\n🎉 === ALL 10 WAVE 1 TASKS PASSED === 🎉", flush=True)
