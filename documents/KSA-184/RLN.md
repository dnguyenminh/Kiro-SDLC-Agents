# Release Notes (RLN)

## KSA-184: Migrate Extension Build from tsc to esbuild

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | PATCH (build tooling) |
| Release Date | 2025-07-15 |
| Jira Ticket | KSA-184 |
| Branch | KSA-184 |
| Author | DevOps Agent |

---

## 1. Summary

Migrated the extension build system from tsc to esbuild. Results: 50%+ smaller VSIX, faster builds, simplified CI pipeline. No functional changes to the extension itself.

---

## 2. Improvements

| # | Improvement | Impact |
|---|-------------|--------|
| 1 | VSIX size reduction | 50%+ smaller package |
| 2 | Build speed | Significantly faster compilation |
| 3 | Single bundle output | Fewer files, faster activation |
| 4 | Watch mode | Faster incremental rebuilds for dev |

---

## 3. Technical Changes

| File | Change |
|------|--------|
| esbuild.mjs | New build configuration |
| package.json | Updated build/watch scripts |
| tsconfig.json | Adjusted compiler options |
| CI workflow | Updated build commands |

---

## 4. Breaking Changes

None for end users. Build tooling change only.

---

## 5. Testing

| Test Type | Result |
|-----------|--------|
| All tests | PASS |
| Extension activation | PASS |
| VSIX install | PASS |

---

## 6. Upgrade Instructions

No user action needed. Build tooling is internal.

---

## 7. Rollback

Revert build scripts to tsc. No runtime impact.
