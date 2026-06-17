# Software Test Cases (STC)

## FEC CR Builder — KSA-240: Chat Panel UI: Context Window Usage Icon + Conversation Tabs

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-240 |
| Title | Chat Panel UI: Context Window Usage Icon + Conversation Tabs |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-06-17 |
| Status | Final |
| Related STP | STP-v1-KSA-240.docx |

---

## 1. PBT — Property-Based Tests

| ID | Property | Generator | Assertions |
|----|----------|-----------|------------|
| PBT-01 | Token percentage always 0-100 | arbitrary integers (0..maxInt) for used/total | percentage = clamp(used/total*100, 0, 100) |
| PBT-02 | Color threshold monotonic | random percentages | green<50, yellow 50-74, orange 75-89, red>=90 |
| PBT-03 | Tab creation never exceeds max | random create/close sequences | tabs.length <= MAX_TABS |
| PBT-04 | Active tab always valid after close | random close operations | activeTab in tabs |
| PBT-05 | Tab IDs always unique | random create sequences | Set(ids).size === tabs.length |

---

## 2. UT — Unit Tests

| ID | Component | Test | Expected |
|----|-----------|------|----------|
| TC-01 | TokenCounter | Calculate 0/1000 | 0% displayed |
| TC-02 | TokenCounter | Calculate 500/1000 | 50% displayed |
| TC-03 | TokenCounter | Calculate 1000/1000 | 100% displayed |
| TC-04 | TokenCounter | Tooltip format | "500 / 1000 tokens (50%)" |
| TC-05 | TokenCounter | Tooltip with 0 total | "N/A" graceful |
| TC-06 | ThresholdCalc | 0-49% | green color class |
| TC-07 | ThresholdCalc | 50-74% | yellow color class |
| TC-08 | ThresholdCalc | 75-89% | orange color class |
| TC-09 | ThresholdCalc | 90-100% | red color class |
| TC-10 | ThresholdCalc | >100% (overflow) | red + warning icon |
| TC-11 | ConversationManager | Create first tab | tab created, marked active |
| TC-12 | ConversationManager | Create with custom name | name preserved |
| TC-13 | ConversationManager | Create at max limit | error/rejection |
| TC-14 | ConversationManager | Create assigns unique ID | UUID format |
| TC-15 | ConversationManager | Switch to existing tab | active changes, messages load |
| TC-16 | ConversationManager | Switch to same tab | no-op |
| TC-17 | ConversationManager | Switch preserves scroll | scroll position saved/restored |
| TC-18 | ConversationManager | Switch updates token counter | new tab token count shown |
| TC-19 | ConversationManager | Close non-active tab | tab removed, active unchanged |
| TC-20 | ConversationManager | Close active tab | next tab becomes active |
| TC-21 | ConversationManager | Close last tab | new empty tab created |
| TC-22 | ConversationManager | Close with unsaved | confirmation triggered |
| TC-23 | StatePersistence | Save tabs to storage | JSON serialized correctly |
| TC-24 | StatePersistence | Restore tabs from storage | tabs recreated with messages |
| TC-25 | StatePersistence | Restore with corrupted data | fallback to empty state |
| TC-26 | StatePersistence | Restore active tab | correct tab marked active |

---

## 3. IT — Integration Tests

| ID | Scenario | Setup | Steps | Expected |
|----|----------|-------|-------|----------|
| TC-27 | Token update message | Mock extension host | 1. Host sends tokenUpdate msg 2. Verify DOM updates | Icon percentage updates |
| TC-28 | New tab message | jsdom + mock host | 1. Host sends createTab 2. Verify tab bar renders | New tab appears in DOM |
| TC-29 | Tab switch roundtrip | jsdom + mock host | 1. Click tab 2. Verify postMessage sent 3. Host responds 4. Verify content swap | Content changes, messages load |
| TC-30 | State restore on init | jsdom + mock storage | 1. Seed storage 2. Init panel 3. Verify tabs rendered | Tabs and token state restored |

---

## 4. E2E-UI — Manual Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| E2E-01 | Token icon visible | Open chat panel | Token icon in header area |
| E2E-02 | Token updates during chat | Send messages | Icon updates after each response |
| E2E-03 | Create new tab | Click "+" button | New tab appears, empty conversation |
| E2E-04 | Switch tabs | Click different tab | Conversation content changes |
| E2E-05 | Close tab | Click "x" on tab | Tab removed, adjacent tab active |
| E2E-06 | Rename tab | Double-click tab title | Inline edit, save on blur |
| E2E-07 | Panel reload | Close/reopen panel | Tabs and token state preserved |

---

## 5. SIT — System Integration (Manual)

| ID | Scenario | Type |
|----|----------|------|
| SIT-01 | Visual regression — token icon styling | Visual |
| SIT-02 | Tab overflow with 10+ tabs | UX |
| SIT-03 | Accessibility — keyboard tab navigation | A11y |
| SIT-04 | Theme compatibility (dark/light/high-contrast) | Visual |
