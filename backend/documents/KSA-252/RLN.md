# Release Notes (RLN)

## Chatbox UI — KSA-252: Context Menu ("#" Trigger)

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | MINOR (new feature) |
| Release Date | 2026-06-17 |
| Jira Ticket | KSA-252 |
| Branch | KSA-252 |
| Author | DevOps Agent |

---

## 1. Summary

Added a Context Menu feature triggered by typing "#" in the chat input area. Users can now quickly reference files, folders, symbols, and other workspace context items which are resolved and injected into AI prompts on message submit.

---

## 2. New Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | "#" trigger | Typing "#" opens context menu overlay |
| 2 | Fuzzy search | Real-time filtering with CJK support |
| 3 | Context badges | Selected items shown as removable chips in input |
| 4 | Category providers | File, Folder, Symbol, Git context providers |
| 5 | Keyboard navigation | Full keyboard support (Arrow, Enter, Escape, Tab) |
| 6 | Lazy resolution | Context content resolved on submit, not on select |
| 7 | State machine | Predictable menu lifecycle via FSM |

---

## 3. Technical Changes

### 3.1 New Files

| File | Purpose |
|------|---------|
| `webview/context-menu/state-machine.ts` | FSM for menu lifecycle |
| `webview/context-menu/menu-renderer.ts` | DOM rendering of menu overlay |
| `webview/context-menu/fuzzy-filter.ts` | Fuzzy matching with CJK awareness |
| `webview/context-menu/badge-manager.ts` | Badge chip insertion/removal |
| `webview/context-menu/providers/*.ts` | Context data providers |
| `src/context/context-resolver.ts` | Extension host resolution logic |
| `src/context/context-types.ts` | Shared type definitions |

### 3.2 Modified Files

| File | Change |
|------|--------|
| `webview/chat-input.ts` | "#" keypress detection |
| `src/chat/message-handler.ts` | Badge resolution before AI prompt |

---

## 4. Testing

| Test Type | Cases | Result |
|-----------|-------|--------|
| Property-Based (PBT) | 12 | PASS |
| Unit Tests (UT) | 45 | PASS |
| Integration Tests (IT) | 15 | PASS |
| **Total** | **72** | **100% pass rate** |

---

## 5. Known Limitations

- E2E-UI tests require Playwright + VS Code webview (not in CI)
- Context resolution timeout fixed at 5s
- Maximum 10 badges per message

---

## 6. Upgrade Instructions

1. Update kiro-sdlc-agents extension to latest version
2. Restart VS Code / Kiro IDE
3. No configuration changes needed

---

## 7. Rollback

Revert to previous extension version. Context menu feature will be unavailable; core chat unaffected.
