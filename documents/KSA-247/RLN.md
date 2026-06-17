# Release Notes (RLN)

## Kiro SDLC Agents — KSA-247: Chat Panel: Restore collapsible tool call UI blocks with icons

---

## Release Information

| Field | Value |
|-------|-------|
| Release Version | PATCH (bugfix/regression) |
| Release Date | 2026-06-10 |
| Jira Ticket | KSA-247 |
| Branch | KSA-247 |
| Author | DevOps Agent |

---

## 1. Summary

Fixed a regression where collapsible tool call UI blocks in the Chat Panel were wiped when streaming responses arrived. Tool blocks now persist across streaming, panel reload, and expansion interactions. Added category icons and accessibility improvements.

---

## 2. Bug Fixes

| # | Fix | Description |
|---|-----|-------------|
| 1 | Streaming protection | Tool blocks no longer wiped by `chat:streamChunk` events |
| 2 | State persistence | Full tool call data saved/restored on panel reload |
| 3 | Interrupted status | Tools running when panel closes show "interrupted" badge |

---

## 3. Improvements

| # | Improvement | Description |
|---|-------------|-------------|
| 1 | Category icons | Each tool call block shows icon based on tool category |
| 2 | Expanded categorizeTool() | More tool categories recognized with proper icons |
| 3 | Keyboard navigation | Tab + Enter/Space to toggle collapse |
| 4 | ARIA attributes | `aria-expanded`, `tabindex`, screen reader support |
| 5 | Focus management | Visible focus outline on keyboard navigation |

---

## 4. Technical Changes

### 4.1 Modified Files

| File | Change |
|------|--------|
| `webview/chat-panel.js` | Streaming protection logic |
| `webview/tool-blocks.js` | categorizeTool() expansion, icon rendering |
| `webview/styles/tool-blocks.css` | Collapsible styling, accessibility |
| `src/chat/state-manager.ts` | Tool call data persistence |

---

## 5. Testing

| Test Type | Result |
|-----------|--------|
| Unit tests | PASS |
| Extension tests | PASS |
| Visual regression | PASS |
| Accessibility audit | PASS |

---

## 6. Known Limitations

- Tool call result syntax highlighting not included (future enhancement)
- Icons limited to predefined category map (unknown tools get generic icon)

---

## 7. Upgrade Instructions

1. Update kiro-sdlc-agents extension to latest version
2. Restart VS Code / Kiro IDE
3. No configuration changes needed

---

## 8. Rollback

Revert to previous extension version. Tool block wipe regression will return.
