# Release Notes

## Code Intelligence MCP Server — v1.13.1

---

## Release Information

| Field | Value |
|-------|-------|
| Version | 1.13.1 |
| Release Date | 2026-06-01 |
| Jira Ticket | KSA-190 |
| Type | Feature (minor) |

---

## What's New

### Auto-Linking on KB Ingest

Knowledge Base entries are now automatically linked to related existing entries when ingested. The knowledge graph grows organically without manual `mem_graph add_edge` calls.

**Four linking strategies:**

| Strategy | Relation Type | Trigger |
|----------|--------------|---------|
| Semantic Similarity | SIMILAR_TO | Cosine similarity >= 0.75 |
| Shared Entities | SHARES_ENTITY | Jaccard coefficient >= 0.3 |
| Shared Tags | SHARES_TAG | >= 2 tags in common |
| FTS Topic Overlap | TOPIC_OVERLAP | Fallback when < 2 edges from other methods |

**Key features:**
- Automatic edge creation during `mem_ingest` and `mem_ingest_file`
- Configurable thresholds and max edges per strategy
- Direction-agnostic deduplication (no duplicate edges)
- Backfill support via `mem_graph action=auto_link`
- Ingest response now includes: "Auto-linked: N edges (X semantic, Y entity, Z tag)"
- Master switch: `autoLink.enabled` to disable entirely

### Backfill Command

New `mem_graph` action `auto_link`:
- Without `entry_id`: processes all orphan entries (0 edges), max 50 per call
- With `entry_id`: auto-links a specific entry

---

## Breaking Changes

None. This is a purely additive feature. Existing APIs and behavior unchanged.

---

## Configuration

No configuration required — auto-linking is enabled by default with sensible thresholds.

---

## Test Results

- 39/39 automated tests pass (PBT + UT + IT + E2E-API)
- 2/2 manual SIT scenarios verified
- 100% pass rate

---

## Affected Files

### New Files
- `src/memory/auto-linker.ts` — Orchestrator
- `src/memory/auto-link-config.ts` — Configuration
- `src/memory/linking-strategies/semantic-strategy.ts`
- `src/memory/linking-strategies/entity-strategy.ts`
- `src/memory/linking-strategies/tag-strategy.ts`
- `src/memory/linking-strategies/fts-strategy.ts`
- `src/memory/linking-strategies/types.ts`
- `src/memory/__tests__/auto-linker.vitest.ts`
- `src/memory/__tests__/auto-linker-e2e.vitest.ts`

### Modified Files
- `src/memory/ingest-pipeline.ts` — Added tryAutoLink() step
- `src/memory/memory-engine.ts` — Wired AutoLinker
- `src/memory/graph-repo.ts` — Added helper queries
- `src/tools/mem-graph-tool.ts` — Added auto_link action

---

## Upgrade Instructions

1. `npm run build` in mcp-code-intelligence-nodejs/
2. `vsce package` to create VSIX
3. `kiro --install-extension code-intelligence-1.13.1.vsix`

No database migration needed. Existing KBs work as-is.
