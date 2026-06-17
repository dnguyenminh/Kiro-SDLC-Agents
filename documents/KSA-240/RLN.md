# Release Notes (RLN)

## FEC CR Builder — KSA-240: Chat Panel UI: Context Window Usage Icon + Conversation Tabs

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | MINOR (new feature) |
| Release Date | 2026-06-17 |
| Jira Ticket | KSA-240 |
| Branch | KSA-240 |
| Author | DevOps Agent |

---

## 1. Summary

Added Context Window Usage Icon and Conversation Tabs to the Chat Panel. Users can now monitor token consumption in real-time and manage multiple independent chat conversations within a single panel.

---

## 2. New Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | Token usage icon | Real-time percentage display with color thresholds (green/yellow/orange/red) |
| 2 | Token tooltip | Hover to see "used / total tokens (percentage)" |
| 3 | Conversation tabs | Create, switch, close, rename chat threads |
| 4 | Tab persistence | All tabs and messages survive panel close/reopen |
| 5 | Per-tab token tracking | Each conversation has independent token counter |

---

## 3. Technical Changes

| File | Change |
|------|--------|
| `webview/token-counter/` | New — token icon component |
| `webview/conversation-tabs/` | New — tab bar UI |
| `src/chat/conversation-manager.ts` | New — multi-conversation state |
| `src/chat/token-counter.ts` | New — token counting service |

---

## 4. Testing

| Test Type | Cases | Result |
|-----------|-------|--------|
| PBT | 5 properties | PASS |
| Unit Tests | 26 | PASS |
| Integration | 4 | PASS |
| **Total** | **35** | **100% pass** |

---

## 5. Known Limitations

- Token count is approximate (model-specific tokenizer not bundled)
- Maximum 20 tabs per panel
- Tab rename requires double-click (no context menu yet)

---

## 6. Upgrade Instructions

1. Update extension to latest version
2. Restart IDE
3. No configuration changes needed

---

## 7. Rollback

Revert to previous version. Chat panel works without token icon and tabs.
