# Functional Specification Document (FSD)

## FEC CR Builder — KSA-254: Chat Panel: Slash Command Menu (Agents + Steering Rules)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-254 |
| Title | Chat Panel: Slash Command Menu (Agents + Steering Rules) |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-254.docx |
| Related FSD | FSD-v1-KSA-252.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-14 | BA Agent | Initial draft — Use Cases, Business Rules, Data Specs |
| 1.0 | 2026-06-14 | TA Agent | Enriched — API Contracts, Integration Specs, Technical Review |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Slash Command Menu for the Chat Panel webview. It defines use cases, interaction flows, data contracts, and integration details for implementing the inline `/` trigger popup that allows developers to select agents or attach steering rules to their chat messages.

### 1.2 Scope

- Inline `/` character trigger detection in the chat textarea
- Two-section popup display: Agents (top) + Steering Rules (bottom)
- Type-ahead filtering across both sections
- Keyboard navigation (ArrowUp/Down/Enter/Escape) crossing section boundaries
- Agent selection: inserts `/agent-name ` prefix in textarea
- Steering selection: attaches rule as context chip
- Reuses popup infrastructure from KSA-252

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| Slash Command | Action triggered by `/` prefix in chat input |
| Agent Routing | Directing a message to a specific agent based on `/agent-name` prefix |
| Steering Rule | Configuration file in `.kiro/steering/` that guides agent behavior |
| Section Header | Non-selectable divider label separating popup sections |
| Trigger Position | Valid position for `/` activation (start of input or after whitespace) |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-254.docx |
| KSA-252 FSD | FSD-v1-KSA-252.docx |
| Message Protocol | src/chat-panel/message-protocol.ts |
| Chat Panel Provider | src/chat-panel/chat-panel-provider.ts |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The Slash Command Menu operates within the Chat Panel webview alongside the Hash Context Picker (KSA-252). Both share similar popup patterns but have different data sources and selection behaviors.

**Actors:**
- **Developer** — Types `/` in chat input, selects agents or steering rules
- **Extension Host** — Provides steering rules list, routes messages to selected agent
- **.kiro/steering/ files** — Source of available steering rules

### 2.2 System Architecture

The implementation extends the Chat Panel's existing architecture:

1. **Webview Layer** (`chat.js`) — Slash popup rendering, event handling
2. **Message Protocol** (`message-protocol.ts`) — Agent routing, steering loaded
3. **Extension Host** (`chat-panel-provider.ts`) — Reads steering files, routes to agents

---

## 3. Functional Requirements

### 3.1 Feature: Slash Trigger Detection

**Source:** BRD Story 1

#### 3.1.1 Use Case

**Use Case ID:** UC-01
**Actor:** Developer
**Preconditions:** Chat Panel visible, input textarea focused
**Postconditions:** Slash Command popup visible OR `/` remains as literal text

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Types `/` in textarea | | User presses `/` key |
| 2 | | Detects character at cursor position | Check if position is valid trigger |
| 3 | | Validates trigger position | Position 0 OR preceded by whitespace |
| 4 | | Displays slash popup | Two-section popup above textarea |
| 5 | | Sets initial state | First agent item highlighted |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | `/` typed mid-word (e.g., "http://") | No popup shown, `/` literal |
| AF-02 | `#` popup already visible | Close `#` popup first, then show `/` popup |
| AF-03 | Already inside a `#` trigger context | No popup — `/` is filter char for `#` |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Textarea disabled (streaming) | Ignore keystroke, no popup |
| EF-02 | No agents and no steering rules loaded | Show "No commands available" |

#### 3.1.2 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | `/` only triggers popup at position 0 or after whitespace | BRD Story 1 |
| BR-02 | Only one popup active at a time (dismiss `#` popup if active) | BRD Story 1 |
| BR-03 | Popup must appear within 50ms of trigger keystroke | BRD NFR |
| BR-04 | `/` NOT triggered when `#` popup is already showing (it becomes filter) | Edge case |
| BR-05 | `/` NOT triggered mid-word (e.g., "http://") | BRD Story 1 |

---

### 3.2 Feature: Two-Section Popup Display

**Source:** BRD Story 2 + Story 3

#### 3.2.1 Use Case

**Use Case ID:** UC-02
**Actor:** Developer
**Preconditions:** Slash trigger detected (UC-01 completed)
**Postconditions:** Popup visible with Agents section + Steering section

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Renders popup container | Position above textarea |
| 2 | | Renders "AGENTS" section header | Non-selectable divider |
| 3 | | Populates agent items | 6 agents in alphabetical order |
| 4 | | Renders "STEERING RULES" section header | Non-selectable divider |
| 5 | | Populates steering items | From `chat:steeringLoaded` data |
| 6 | | Highlights first agent item | Visual indicator |

#### 3.2.2 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-06 | Agents section always first, Steering section second | BRD Story 2 |
| BR-07 | 6 agents: qa-agent, sa-agent, sm-agent, ta-agent, ui-agent, security-agent | BRD Story 2 |
| BR-08 | Section headers are NOT selectable (skipped during keyboard nav) | BRD Story 5 |
| BR-09 | Steering rules loaded dynamically from `chat:steeringLoaded` message | BRD Story 3 |
| BR-10 | If no steering rules, show "No steering rules" placeholder | BRD Story 3 |
| BR-11 | First selectable item (first agent) highlighted by default | BRD Story 5 |

#### 3.2.3 Data Specifications

**Agent Data (static):**

| # | id | icon | label | agentName | description |
|---|-----|------|-------|-----------|-------------|
| 1 | qa | 🧪 | QA Agent | qa-agent | Quality assurance and testing |
| 2 | sa | 🏗️ | SA Agent | sa-agent | Solution architecture and design |
| 3 | sm | 📋 | SM Agent | sm-agent | Scrum master and pipeline orchestration |
| 4 | ta | 🔧 | TA Agent | ta-agent | Technical analysis and enrichment |
| 5 | ui | 🎨 | UI Agent | ui-agent | UI/UX design and wireframes |
| 6 | security | 🔒 | Security Agent | security-agent | Security review and compliance |

**Steering Rule Data (dynamic):**

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| name | string | filename minus `.md` | Display name |
| file | string | relative path | Path to `.kiro/steering/{name}.md` |
| icon | string | always "🧭" | Static icon |

---

### 3.3 Feature: Type-Ahead Filtering

**Source:** BRD Story 4

#### 3.3.1 Use Case

**Use Case ID:** UC-03
**Actor:** Developer
**Preconditions:** Slash popup is visible
**Postconditions:** Popup shows filtered results across both sections

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Types characters after `/` | | E.g., types "qa" making input "/qa" |
| 2 | | Extracts filter text | Text between `/` trigger and cursor |
| 3 | | Filters agents | Case-insensitive match on label + agentName |
| 4 | | Filters steering rules | Case-insensitive match on name |
| 5 | | Updates both sections | Only matching items visible |
| 6 | | Hides empty section headers | If all items filtered out |
| 7 | | Re-highlights first visible item | Reset to top |

#### 3.3.2 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-12 | Filter matches against: agent label, agent name, steering name | BRD Story 4 |
| BR-13 | Case-insensitive substring match | BRD Story 4 |
| BR-14 | Empty sections hide their header | BRD Story 4 |
| BR-15 | No matches shows "No matching commands" | BRD Story 4 |
| BR-16 | First visible item always highlighted after filter change | BRD Story 5 |
| BR-17 | Backspace past `/` position closes popup | Same as KSA-252 |

#### 3.3.3 Filter Examples

| Filter | Agents Visible | Steering Visible |
|--------|---------------|------------------|
| "" (empty) | All 6 | All rules |
| "qa" | QA Agent | — |
| "s" | SA Agent, SM Agent, Security Agent | sm-core, shared-* |
| "draw" | — | drawio |
| "agent" | All 6 (all contain "agent") | — |
| "xyz" | — | — → "No matching commands" |

---

### 3.4 Feature: Keyboard Navigation

**Source:** BRD Story 5

#### 3.4.1 Use Case

**Use Case ID:** UC-04
**Actor:** Developer
**Preconditions:** Slash popup visible with items
**Postconditions:** Item selected OR popup dismissed

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Presses ArrowDown | | Navigate to next selectable item |
| 2 | | Moves highlight, skipping headers | Cross section boundary if needed |
| 3 | Presses Enter | | Confirm selection |
| 4 | | Executes selection action | Agent or steering behavior |

#### 3.4.2 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-18 | ArrowDown: next selectable item, wrap at bottom to first | BRD Story 5 |
| BR-19 | ArrowUp: previous selectable item, wrap at top to last | BRD Story 5 |
| BR-20 | Section headers are SKIPPED during navigation | BRD Story 5 |
| BR-21 | Enter/Tab: select highlighted item | BRD Story 5 |
| BR-22 | Escape: dismiss popup | BRD Story 5 |
| BR-23 | Mouse click on item: select that item | Implicit |

---

### 3.5 Feature: Agent Selection Behavior

**Source:** BRD Story 6

#### 3.5.1 Use Case

**Use Case ID:** UC-05
**Actor:** Developer
**Preconditions:** An agent item is selected from the popup
**Postconditions:** `/agent-name ` prefix inserted in textarea

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Selects agent (Enter/click) | | E.g., selects "SA Agent" |
| 2 | | Removes `/filter_text` from textarea | Replace trigger+filter with empty |
| 3 | | Inserts `/sa-agent ` at trigger position | With trailing space |
| 4 | | Moves cursor after trailing space | Ready to type message |
| 5 | | Closes popup | |

#### 3.5.2 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-24 | Agent selection inserts `/agent-name ` (with trailing space) | BRD Story 6 |
| BR-25 | Prefix is plain text in textarea (not a chip) | BRD Story 6 |
| BR-26 | User can edit/backspace the prefix | BRD Story 6 |
| BR-27 | Extension host parses `/agent-name` prefix to route message | BRD Story 6 |

---

### 3.6 Feature: Steering Rule Selection Behavior

**Source:** BRD Story 7

#### 3.6.1 Use Case

**Use Case ID:** UC-06
**Actor:** Developer
**Preconditions:** A steering rule is selected from the popup
**Postconditions:** Steering rule attached as context chip

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Selects steering rule (Enter/click) | | E.g., selects "drawio" |
| 2 | | Removes `/filter_text` from textarea | Replace trigger+filter with empty |
| 3 | | Closes popup | |
| 4 | | Adds context chip | "🧭 drawio" chip in chips area |
| 5 | | Adds to contextItems array | `{ type: "steering", label: "drawio", path: ".kiro/steering/drawio.md" }` |

#### 3.6.2 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-28 | Steering selection adds context chip (same as `#` context) | BRD Story 7 |
| BR-29 | Chip shows "🧭 {rule-name}" | BRD Story 7 |
| BR-30 | Multiple steering rules can be attached | BRD Story 7 |
| BR-31 | Context item sent with message: `{ type: "steering", path: ".kiro/steering/{name}.md" }` | BRD Story 7 |

---

## 4. Data Model

### 4.1 Entities

#### Entity: SlashAgent (static)

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Y | Short agent identifier |
| icon | string | Y | Emoji icon |
| label | string | Y | Display name |
| agentName | string | Y | Full agent name for routing |
| description | string | Y | Brief description |

#### Entity: SlashSteeringRule (dynamic)

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Y | Rule name (filename without .md) |
| file | string | Y | Relative path to rule file |
| icon | string | Y | Always "🧭" |

#### Entity: SlashPopupState (runtime)

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| visible | boolean | Y | Whether popup is shown |
| triggerIndex | number | Y | Position of `/` in textarea |
| filterText | string | Y | Current filter input |
| highlightedIndex | number | Y | Index in flatItems (agents + steering, excluding headers) |
| flatItems | SlashItem[] | Y | Combined selectable items |
| agents | SlashAgent[] | Y | Static agent list |
| steeringRules | SlashSteeringRule[] | Y | Dynamic from extension |

---

## 5. Integration Specifications

### 5.1 Steering Rules Loading

**Message:** `chat:steeringLoaded` (Extension → Webview, already exists)

```typescript
{ type: "chat:steeringLoaded"; rules: Array<{ name: string; file: string }> }
```

This message is sent on panel initialization and provides the list of available steering rules. The slash popup uses this data for its Steering section.

### 5.2 Agent Routing (on message send)

When user sends a message with `/agent-name` prefix:
1. Extension host extracts agent name from message text
2. Routes message to the specified agent
3. Strips prefix from the message content sent to the agent

**Parsing Logic:**
```typescript
const agentMatch = text.match(/^\/([a-z]+-agent)\s+(.*)$/s);
if (agentMatch) {
  const targetAgent = agentMatch[1]; // e.g., "sa-agent"
  const actualMessage = agentMatch[2]; // rest of message
  // Route to targetAgent with actualMessage
}
```

### 5.3 Context Chip Integration (existing)

Steering selection uses the existing `addContextChip()` function:
```javascript
addContextChip({ type: "steering", label: rule.name, path: ".kiro/steering/" + rule.file });
```

---

## 6. Processing Logic

### 6.1 Slash Trigger Detection

```javascript
function isValidSlashTrigger(text, slashPos) {
  // Don't trigger if # popup is already visible
  if (pickerPopup.visible) return false;
  if (slashPos === 0) return true;
  var charBefore = text[slashPos - 1];
  return charBefore === " " || charBefore === "\t" || charBefore === "\n";
}
```

### 6.2 Two-Section Filter

```javascript
function filterSlashItems(filterText) {
  var lower = filterText.toLowerCase();
  var filteredAgents = SLASH_AGENTS.filter(function(a) {
    return a.label.toLowerCase().indexOf(lower) !== -1 ||
           a.agentName.toLowerCase().indexOf(lower) !== -1;
  });
  var filteredSteering = slashSteeringRules.filter(function(r) {
    return r.name.toLowerCase().indexOf(lower) !== -1;
  });
  return { agents: filteredAgents, steering: filteredSteering };
}
```

### 6.3 Agent Selection

```javascript
function selectSlashAgent(agent) {
  // Remove /filterText from textarea
  var text = inputEl.value;
  var before = text.substring(0, slashPopup.triggerIndex);
  var after = text.substring(inputEl.selectionStart);
  // Insert /agent-name + space
  inputEl.value = before + "/" + agent.agentName + " " + after;
  var newPos = slashPopup.triggerIndex + agent.agentName.length + 2; // "/" + name + " "
  inputEl.selectionStart = inputEl.selectionEnd = newPos;
  hideSlashPopup();
}
```

### 6.4 Steering Selection

```javascript
function selectSlashSteering(rule) {
  // Remove /filterText from textarea
  var text = inputEl.value;
  var before = text.substring(0, slashPopup.triggerIndex);
  var after = text.substring(inputEl.selectionStart);
  inputEl.value = before + after;
  inputEl.selectionStart = inputEl.selectionEnd = slashPopup.triggerIndex;
  hideSlashPopup();
  // Add as context chip
  addContextChip({ type: "steering", label: rule.name, path: ".kiro/steering/" + rule.file });
}
```

---

## 7. State Diagram

![State Diagram](diagrams/state-slash-lifecycle.png)

**States:**
- **Idle** — No slash popup visible
- **Popup Visible** — Slash command popup showing
- **Filtering** — User typing filter text
- **Agent Selected** — Prefix inserted, back to idle
- **Steering Selected** — Chip added, back to idle

**Transitions:**
- Idle → Popup Visible: `/` typed at valid position
- Popup Visible → Filtering: Character typed after `/`
- Filtering → Popup Visible: Backspace removes all filter
- Popup Visible → Agent Selected: Enter on agent item
- Popup Visible → Steering Selected: Enter on steering item
- Popup Visible → Idle: Escape/click outside
- Filtering → Idle: Backspace past `/` trigger

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Popup appears within 50ms | Same as KSA-252 |
| Performance | Filter < 16ms | Array filter on ~20 items |
| Accessibility | Keyboard-only operation | ArrowUp/Down/Enter/Escape |
| Accessibility | ARIA attributes | role="listbox", aria-activedescendant |
| UX Consistency | Match KSA-252 popup pattern | Same CSS, same keyboard behavior |
| Compatibility | VS Code Webview CSP | No external resources |
| Code Reuse | Share CSS with KSA-252 picker | .picker-popup, .picker-item classes |

---

## 9. Error Handling

| Scenario | Severity | Expected Behavior |
|----------|----------|-------------------|
| No steering rules loaded | Info | Section shows "No steering rules" |
| No agents match filter | Info | Agents section hidden |
| No items match at all | Info | "No matching commands" placeholder |
| Extension host routing fails | Warning | Error toast via chat:error message |

---

## 10. Sequence Diagrams

### 10.1 Agent Selection Flow

![Sequence — Agent Selection](diagrams/sequence-agent-selection.png)

```
Developer -> Textarea: types "/sa"
Textarea -> SlashController: onInput event
SlashController -> SlashController: isValidSlashTrigger("/", 0) = true
SlashController -> SlashPopup: show(agents, steeringRules)
SlashController -> SlashPopup: applyFilter("sa")
SlashPopup -> SlashPopup: render filtered (SA Agent matches)
Developer -> SlashPopup: presses Enter
SlashPopup -> SlashController: onSelect(agent: "sa-agent")
SlashController -> Textarea: insert "/sa-agent " at trigger position
```

### 10.2 Steering Selection Flow

![Sequence — Steering Selection](diagrams/sequence-steering-selection.png)

```
Developer -> Textarea: types "/draw"
SlashController -> SlashPopup: applyFilter("draw")
SlashPopup -> SlashPopup: render (drawio matches in Steering section)
Developer -> SlashPopup: presses Enter
SlashPopup -> SlashController: onSelect(steering: "drawio")
SlashController -> Textarea: remove "/draw"
SlashController -> ChipsContainer: addContextChip({type:"steering", label:"drawio", path:".kiro/steering/drawio.md"})
```

---

## 11. API Contract (Functional View)

### 11.1 Agent Routing (Message Parse)

**When message is sent with `/agent-name` prefix:**

| Field | Description |
|-------|-------------|
| Input | `"/sa-agent review this architecture"` |
| Parsed agent | `"sa-agent"` |
| Actual message | `"review this architecture"` |
| Routing | Message forwarded to sa-agent |

### 11.2 chat:steeringLoaded (existing message, no changes)

```typescript
{ type: "chat:steeringLoaded"; rules: Array<{ name: string; file: string }> }
```

---

## 12. Appendix

### 12.1 Relationship with KSA-252

| Aspect | KSA-252 (`#`) | KSA-254 (`/`) |
|--------|---------------|---------------|
| Trigger char | `#` | `/` |
| Data source | Static 9 categories | Static agents + dynamic steering |
| Sections | Single flat list | Two sections with headers |
| Selection result | Send `pickContext` → chip | Insert prefix OR add chip |
| Filter scope | Category labels | Agent names/labels + rule names |
| CSS classes | `.picker-popup`, `.picker-item` | Reuses same classes + `.picker-section-header` |
| Popup element | `#context-picker-popup` | `#slash-command-popup` (new) |

### 12.2 Shared CSS

Both popups reuse the same CSS classes added in KSA-252:
- `.picker-popup` — popup container
- `.picker-item` — selectable item
- `.picker-item.highlighted` — active selection
- `.picker-item-icon` — icon column
- `.picker-item-label` — label column
- `.picker-empty` — no-results placeholder
- `.picker-section-header` — section divider (new, used by `/`)

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Agent Selection | [sequence-agent-selection.png](diagrams/sequence-agent-selection.png) | [sequence-agent-selection.drawio](diagrams/sequence-agent-selection.drawio) |
| 3 | Sequence — Steering Selection | [sequence-steering-selection.png](diagrams/sequence-steering-selection.png) | [sequence-steering-selection.drawio](diagrams/sequence-steering-selection.drawio) |
| 4 | State — Slash Lifecycle | [state-slash-lifecycle.png](diagrams/state-slash-lifecycle.png) | [state-slash-lifecycle.drawio](diagrams/state-slash-lifecycle.drawio) |
