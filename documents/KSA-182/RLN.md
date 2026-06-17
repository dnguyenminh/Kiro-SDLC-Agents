# Release Notes (RLN)

## KSA-182: [Bug] httpStream Transport Not Supported for Upstream MCP Servers

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | PATCH (bug fix) |
| Release Date | 2025-07-15 |
| Jira Ticket | KSA-182 |
| Branch | KSA-182 |
| Author | DevOps Agent |

---

## 1. Summary

Fixed: MCP server now supports httpStream transport for connecting to upstream servers. This resolves connection failures when upstream MCP servers use HTTP streaming instead of stdio or SSE.

---

## 2. Bug Fix

| # | Issue | Resolution |
|---|-------|------------|
| 1 | httpStream transport rejected by connection factory | Added httpStream to supported transport types |
| 2 | No HTTP streaming client implementation | Implemented native fetch-based streaming |

---

## 3. Technical Changes

| Component | Change |
|-----------|--------|
| Transport layer | Added httpStream type |
| Connection factory | httpStream connection handler |
| Config validation | Accepts httpStream transport option |

---

## 4. Breaking Changes

None. Additive fix.

---

## 5. Testing

| Test Type | Result |
|-----------|--------|
| All tests | PASS |
| Regression (stdio/SSE) | No regressions |

---

## 6. Upgrade Instructions

Pull latest, rebuild. httpStream transport available immediately.

---

## 7. Rollback

Revert merge. httpStream connections will fail (returns to previous behavior).
