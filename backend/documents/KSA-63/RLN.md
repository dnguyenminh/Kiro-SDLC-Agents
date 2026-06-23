# Release Notes (RLN)

## KSA-63: Fix Tool Discovery, Semantic Grouping and Fallback Chain Execution

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | PATCH (bug fixes) |
| Release Date | 2025-07-15 |
| Jira Ticket | KSA-63 |
| Branch | KSA-63 |
| Author | DevOps Agent |

---

## 1. Summary

Fixed three critical bugs in the tool system: unreliable tool discovery (tools sometimes missing from list), incorrect semantic grouping (tools in wrong categories), and broken fallback chain (secondary tools not executing when primary fails). Fixes ported to both Python and Node.js implementations.

---

## 2. Bug Fixes

| # | Bug | Resolution |
|---|-----|------------|
| 1 | Tool discovery misses tools intermittently | Fixed race condition in discovery scan |
| 2 | Semantic grouping miscategorizes tools | Fixed similarity threshold and matching algorithm |
| 3 | Fallback chain stops after primary failure | Fixed chain continuation logic |

---

## 3. Technical Changes

| Component | Files | Change |
|-----------|-------|--------|
| Python port | 21 files | Full implementation of fixes |
| Node.js port | 18 files | Full implementation of fixes |
| Core discovery | Modified | Race condition fix |
| Grouping engine | Modified | Threshold tuning |
| Chain executor | Modified | Continuation logic |

---

## 4. Breaking Changes

None. Bug fixes only.

---

## 5. Testing

| Test Type | Result |
|-----------|--------|
| All tests | PASS |
| Discovery reliability | 100% (previously ~85%) |
| Fallback execution | Correct chain behavior |

---

## 6. Upgrade Instructions

Pull latest, rebuild both runtimes. Fixes activate automatically.

---

## 7. Rollback

Revert merge. Known bugs will return (intermittent discovery failures).
