# Technical Design Document (TDD)

## FEC CR Builder - KSA-254: Chat Panel: Slash Command Menu (Agents + Steering Rules)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-254 |
| Title | Chat Panel: Slash Command Menu |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-14 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-254.docx |
| Related BRD | BRD-v1-KSA-254.docx |

---

## 1. Architecture Overview

### 1.1 Design Philosophy

The Slash Command Menu reuses the popup infrastructure from KSA-252 (Hash Context Picker). It adds a second popup element with two-section rendering and different selection behaviors (prefix insertion for agents, chip attachment for steering).

### 1.2 Key Architectural Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| AD-01 | Separate popup element (#slash-command-popup) | Avoids state conflicts with # picker |
| AD-02 | Reuse CSS classes from KSA-252 | Visual consistency, less code |
| AD-03 | Agents hardcoded, steering dynamic | Agents fixed; steering from extension |
| AD-04 | Agent selection = text prefix (not chip) | User can edit/remove prefix |
| AD-05 | Steering selection = context chip | Same mechanism as #steering |
| AD-06 | Separate state object (slashPopup) | Independent lifecycle |

### 1.3 Architecture Diagram

![Architecture](diagrams/architecture.png)

### 1.4 Component Diagram

![Component](diagrams/component.png)

---

## 2. Component Design

### 2.1 State Variables

```javascript
var SLASH_AGENTS = [
  { id: "qa", icon: "\ud83e\uddea", label: "QA Agent", agentName: "qa-agent", description: "Quality assurance and testing" },
  { id: "sa", icon: "\ud83c\udfd7", label: "SA Agent", agentName: "sa-agent", description: "Solution architecture" },
  { id: "sm", icon: "\ud83d\udccb", label: "SM Agent", agentName: "sm-agent", description: "Pipeline orchestration" },
  { id: "ta", icon: "\ud83d\udd27", label: "TA Agent", agentName: "ta-agent", description: "Technical analysis" },
  { id: "ui", icon: "\ud83c\udfa8", label: "UI Agent", agentName: "ui-agent", description: "UI/UX design" },
  { id: "security", icon: "\ud83d\udd12", label: "Security Agent", agentName: "security-agent", description: "Security review" }
];

var slashSteeringRules = []; // From chat:steeringLoaded

var slashPopup = {
  visible: false,
  triggerIndex: -1,
  filterText: "",
  highlightedIndex: 0,
  selectableItems: [],
  element: null
};
```

### 2.2 Trigger Detection

```javascript
function isValidSlashTrigger(text, slashPos) {
  if (pickerPopup.visible) return false;
  if (slashPos === 0) return true;
  var charBefore = text[slashPos - 1];
  return charBefore === " " || charBefore === "\t" || charBefore === "\n";
}
```

### 2.3 Filter Engine (Two Sections)

```javascript
function filterSlashItems(filterText) {
  if (!filterText) return { agents: SLASH_AGENTS.slice(), steering: slashSteeringRules.slice() };
  var lower = filterText.toLowerCase();
  return {
    agents: SLASH_AGENTS.filter(function(a) {
      return a.label.toLowerCase().indexOf(lower) !== -1 || a.agentName.indexOf(lower) !== -1;
    }),
    steering: slashSteeringRules.filter(function(r) {
      return r.name.toLowerCase().indexOf(lower) !== -1;
    })
  };
}
```

### 2.4 Selection Handlers

**Agent selection** inserts `/agent-name ` prefix:
```javascript
function selectSlashAgent(agent) {
  var before = inputEl.value.substring(0, slashPopup.triggerIndex);
  var after = inputEl.value.substring(inputEl.selectionStart);
  var prefix = "/" + agent.agentName + " ";
  inputEl.value = before + prefix + after;
  inputEl.selectionStart = inputEl.selectionEnd = slashPopup.triggerIndex + prefix.length;
  hideSlashPopup();
}
```

**Steering selection** adds context chip:
```javascript
function selectSlashSteering(rule) {
  var before = inputEl.value.substring(0, slashPopup.triggerIndex);
  var after = inputEl.value.substring(inputEl.selectionStart);
  inputEl.value = before + after;
  inputEl.selectionStart = inputEl.selectionEnd = slashPopup.triggerIndex;
  hideSlashPopup();
  addContextChip({ type: "steering", label: rule.name, path: ".kiro/steering/" + rule.file });
}
```

---

## 3. API Design

### 3.1 Agent Routing (Extension Host)

Add to message handler - parse `/agent-name` prefix:

```typescript
private parseAgentPrefix(text: string): { agent?: string; message: string } {
  const match = text.match(/^\/([a-z]+-agent)\s+([\s\S]*)$/);
  if (match) return { agent: match[1], message: match[2] };
  return { message: text };
}
```

### 3.2 Existing Messages Used

- `chat:steeringLoaded` - provides steering rules list (no changes)
- `chat:userMessage` - includes context items with steering paths (no changes)

---

## 4. Implementation Checklist

### 4.1 Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | resources/webview-assets/chat/index.html | Add #slash-command-popup div |
| 2 | resources/webview-assets/chat/chat.css | Add .picker-item-desc style |
| 3 | resources/webview-assets/chat/chat.js | Add slash popup module |
| 4 | src/chat-panel/message-handler.ts | Add agent prefix parsing |

### 4.2 Implementation Order

| Step | Task | Dependency |
|------|------|------------|
| 1 | Add slash-command-popup HTML | None |
| 2 | Add picker-item-desc CSS | None |
| 3 | Add slash state + agents data | KSA-252 done |
| 4 | Add / trigger detection in input handler | Step 3 |
| 5 | Add two-section rendering | Step 3 |
| 6 | Add keyboard navigation | Step 3 |
| 7 | Add agent selection (prefix) | Step 5 |
| 8 | Add steering selection (chip) | Step 5 |
| 9 | Hook steeringLoaded message | Step 3 |
| 10 | Add agent routing in extension | None |

---

## 5. Security Design

| Concern | Mitigation |
|---------|-----------|
| Agent name injection | Only hardcoded names accepted |
| Path traversal | Restricted to .kiro/steering/ |
| XSS | escapeHtml() for all text |
| CSP | No external resources |

---

## 6. Error Handling

| Error | Handling |
|-------|----------|
| No steering rules | Placeholder in section |
| Invalid agent prefix | Treat as normal message |
| Popup element missing | Return early |

---

## 7. Performance

| Operation | Target | Expected |
|-----------|--------|----------|
| Popup render | < 50ms | ~3ms |
| Filter | < 16ms | ~1ms |
| Navigation | < 16ms | ~0.5ms |

---

## 8. Accessibility

- role="listbox" on popup
- role="option" on items
- Section headers: role="presentation" (skipped)
- Full keyboard: ArrowUp/Down/Enter/Escape

---

## Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
