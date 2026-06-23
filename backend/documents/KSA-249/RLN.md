# Release Notes (RLN)

## KSA-249: Steering Optimization + Context Usage Graph + Full Hook System

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | v1.18.0 (MINOR) |
| Release Date | 2025-06-09 |
| Jira Ticket | KSA-249 |
| Branch | KSA-249 |
| Author | DevOps Agent |

---

## 1. Summary

Three developer experience improvements: (1) Steering file optimization reduces context token consumption by loading only relevant steering files, (2) Context usage graph provides real-time visualization of token budget allocation, (3) Full hook system enables custom pre/post lifecycle event handlers.

---

## 2. New Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | Steering Optimization | Smart loading reduces token waste from irrelevant steering files |
| 2 | Context Usage Graph | Visual panel showing token consumption per component |
| 3 | Hook System | Pre/post hooks for pipeline lifecycle events (phase start/end, agent invoke) |

---

## 3. Technical Changes

### New Modules

| Module | Purpose |
|--------|---------|
| Steering optimizer | Analyzes ticket type to load minimal steering set |
| Context graph renderer | Token usage visualization |
| Hook registry | Register and fire lifecycle hooks |

---

## 4. Breaking Changes

None. All changes are additive.

---

## 5. Testing

| Test Type | Result |
|-----------|--------|
| Unit Tests | PASS |
| Integration | PASS |
| E2E | PASS |

---

## 6. Known Limitations

- Context graph refreshes on pipeline completion (not real-time during execution)
- Hook system is synchronous (async hooks planned for future)

---

## 7. Upgrade Instructions

1. Update extension to latest version
2. No configuration changes needed
3. Context graph available in new panel

---

## 8. Rollback

Revert to previous extension version. No data migration needed.
