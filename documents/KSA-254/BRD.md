# Business Requirements Document (BRD)

## FEC CR Builder — KSA-254: Chat Panel: Slash Command Menu (Agents + Steering Rules)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-254 |
| Title | Chat Panel: Slash Command Menu (Agents + Steering Rules) |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-252.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-14 | BA Agent | Initiate document from Jira ticket KSA-254 |

---

## 1. Introduction

### 1.1 Scope

This CR implements a **Slash Command Menu** (triggered by `/` character) in the Chat Panel input. When the user types `/` in the chat input textarea, a popup menu appears with two sections:

1. **Agents** — List of available SDLC agents (qa-agent, sa-agent, sm-agent, ta-agent, ui-agent, security-agent)
2. **Steering Rules** — List of active `.kiro/steering/*.md` files

This replicates the Kiro IDE's `/` trigger pattern for slash commands. Selecting an agent prefixes the message with `/agent-name`, and selecting a steering rule attaches it as context.

### 1.2 Out of Scope

- Agent invocation logic (handled by existing agent system)
- Creating/editing steering files
- Agent configuration or parameter settings
- Multi-agent orchestration from single command

### 1.3 Preliminary Requirements

| Prerequisite | Status | Ticket |
|--------------|--------|--------|
| Chat Panel base implementation | Done | KSA-210 |
| Conversation Tabs + Context Window Usage | Done | KSA-240 |
| Chat Panel input toolbar | Done | KSA-230 |
| Hash Context Picker Menu (shared popup infrastructure) | Required | KSA-252 |

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Slash Command Menu provides a quick way for developers to target specific agents or attach steering rules to their messages. When `/` is typed at a trigger position, a two-section popup appears. The top section lists available agents; the bottom section lists steering rules loaded from `.kiro/steering/` directory.

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer, I want to type `/` in the chat input to trigger a slash command popup so that I can quickly select an agent or steering rule | MUST HAVE | KSA-254 |
| 2 | As a developer, I want to see available agents in the popup so that I can direct my message to a specific agent | MUST HAVE | KSA-254 |
| 3 | As a developer, I want to see available steering rules in the popup so that I can attach a rule as context | MUST HAVE | KSA-254 |
| 4 | As a developer, I want to filter the popup items by typing after `/` so that I can quickly find the agent or rule I need | MUST HAVE | KSA-254 |
| 5 | As a developer, I want keyboard navigation (Arrow Up/Down/Enter/Escape) in the popup so that I can select without using the mouse | MUST HAVE | KSA-254 |
| 6 | As a developer, I want selecting an agent to prefix my message with the agent name so that the system routes to the correct agent | MUST HAVE | KSA-254 |
| 7 | As a developer, I want selecting a steering rule to attach it as context so that the agent uses that rule during processing | SHOULD HAVE | KSA-254 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** User focuses the chat input textarea.

**Step 2:** User types `/` character at a trigger position (beginning of input or after whitespace).

**Step 3:** System detects `/` trigger and displays the Slash Command popup above the input area.

**Step 4:** Popup shows two sections: "Agents" (top) and "Steering" (bottom), separated by a section header.

**Step 5:** User optionally types characters after `/` to filter both sections simultaneously.

**Step 6:** User selects an item via Enter key or mouse click.

**Step 7a (Agent selected):** System removes `/filter_text`, inserts `/agent-name ` prefix into the textarea. User continues typing their message after the prefix.

**Step 7b (Steering selected):** System removes `/filter_text`, attaches the steering rule as a context item (chip). The rule file content will be included when message is sent.

**Step 8:** Popup closes. User sends the message normally.

> **Note:** If user presses Escape or clicks outside, the popup dismisses and `/` remains as literal text.

---

#### STORY 1: Slash Character Trigger Detection

> As a developer, I want to type `/` in the chat input to trigger a slash command popup so that I can quickly select an agent or steering rule.

**Requirement Details:**

1. Monitor `input` events on the chat textarea (same infrastructure as `#` trigger from KSA-252)
2. Detect when `/` is typed at a trigger position:
   - At the very beginning of the input (position 0)
   - After a whitespace character (space, newline, tab)
   - NOT triggered when `/` appears mid-word (e.g., `http://` should NOT trigger)
   - NOT triggered when already inside a `#` trigger context
3. When triggered, display the slash command popup immediately
4. Only one popup active at a time (dismiss `#` popup if active)

**Acceptance Criteria:**

1. GIVEN the chat input is empty, WHEN user types `/`, THEN the slash command popup appears
2. GIVEN the chat input has text "please ", WHEN user types `/` after the space, THEN the popup appears
3. GIVEN the chat input has text "http:", WHEN user types `/` (forming "http:/"), THEN the popup does NOT appear
4. GIVEN the `#` popup is visible, WHEN user somehow triggers `/`, THEN `#` popup closes first
5. GIVEN the popup is visible, WHEN user presses Escape, THEN popup closes and `/` remains in input

---

#### STORY 2: Agents Section Display

> As a developer, I want to see available agents in the popup so that I can direct my message to a specific agent.

**Requirement Details:**

1. Display an "Agents" section header at the top of the popup
2. List the following agents:

| # | Agent Name | Icon | Display Label | Description |
|---|-----------|------|---------------|-------------|
| 1 | qa-agent | 🧪 | QA Agent | Quality assurance and testing |
| 2 | sa-agent | 🏗️ | SA Agent | Solution architecture and design |
| 3 | sm-agent | 📋 | SM Agent | Scrum master and pipeline orchestration |
| 4 | ta-agent | 🔧 | TA Agent | Technical analysis and enrichment |
| 5 | ui-agent | 🎨 | UI Agent | UI/UX design and wireframes |
| 6 | security-agent | 🔒 | Security Agent | Security review and compliance |

3. Each agent item shows: icon + display label + description (muted text)
4. Agent list is static (hardcoded in webview, updated via extension message if needed)

**Acceptance Criteria:**

1. GIVEN the `/` popup is triggered, THEN an "Agents" section with 6 agents is visible
2. GIVEN the agents section, THEN each agent shows icon, label, and description
3. GIVEN the agents list, THEN agents are in alphabetical order by agent name

---

#### STORY 3: Steering Rules Section Display

> As a developer, I want to see available steering rules in the popup so that I can attach a rule as context.

**Requirement Details:**

1. Display a "Steering Rules" section below the Agents section
2. List steering rules from `.kiro/steering/*.md` files
3. Rules are loaded dynamically — extension host sends `chat:steeringLoaded` message with list of available rules
4. Each rule item shows: 🧭 icon + rule name (derived from filename, e.g., `drawio.md` -> "drawio")
5. If no steering rules are loaded, show "No steering rules found" placeholder

**Acceptance Criteria:**

1. GIVEN steering rules have been loaded via `chat:steeringLoaded`, WHEN `/` popup appears, THEN "Steering Rules" section shows all loaded rules
2. GIVEN a steering rule "drawio.md", THEN it displays as "🧭 drawio"
3. GIVEN no steering rules loaded, THEN section shows "No steering rules" message

---

#### STORY 4: Type-Ahead Filtering

> As a developer, I want to filter the popup items by typing after `/` so that I can quickly find the agent or rule I need.

**Requirement Details:**

1. As user types characters after `/`, filter visible items across BOTH sections (case-insensitive, substring match)
2. Filter applies to: agent display label, agent name, steering rule name
3. Examples:
   - `/qa` -> shows: QA Agent
   - `/s` -> shows: SA Agent, SM Agent, Security Agent + all steering rules starting with "s"
   - `/draw` -> shows: drawio (steering rule)
   - `/agent` -> shows all agents (all contain "agent")
4. Empty sections (all items filtered out) hide the section header
5. If no items match in either section, show "No matching commands" placeholder

**Acceptance Criteria:**

1. GIVEN the popup is visible, WHEN user types "qa", THEN only "QA Agent" is visible
2. GIVEN the popup is visible, WHEN user types "draw", THEN only steering rule "drawio" is visible
3. GIVEN filter "xyz" (no matches), THEN "No matching commands" message shown
4. GIVEN a section has all items filtered out, THEN its header is hidden

---

#### STORY 5: Keyboard Navigation

> As a developer, I want keyboard navigation in the popup so that I can select without using the mouse.

**Requirement Details:**

1. Same keyboard behavior as `#` popup (KSA-252):
   - `ArrowDown`: Next item (wrap at bottom). Crosses section boundaries.
   - `ArrowUp`: Previous item (wrap at top). Crosses section boundaries.
   - `Enter` / `Tab`: Select highlighted item
   - `Escape`: Dismiss popup
2. Section headers are skipped during navigation (not selectable)
3. First visible item is highlighted by default

**Acceptance Criteria:**

1. GIVEN popup with Agent items and Steering items, WHEN user presses ArrowDown past last agent, THEN first steering item is highlighted
2. GIVEN first item highlighted, WHEN user presses ArrowUp, THEN last item (bottom of Steering section) is highlighted
3. GIVEN navigation, THEN section headers are never highlighted/selectable

---

#### STORY 6: Agent Selection Behavior

> As a developer, I want selecting an agent to prefix my message with the agent name so that the system routes to the correct agent.

**Requirement Details:**

1. When an agent item is selected:
   - Remove the `/filter_text` from the textarea
   - Insert `/agent-name ` (with trailing space) at the cursor position
   - Example: selecting "QA Agent" inserts `/qa-agent ` in the textarea
2. The cursor moves to after the trailing space (ready for user to type message)
3. The prefix is plain text in the textarea (not a chip — user can edit/delete it)
4. When message is sent with `/agent-name` prefix, the extension host routes to that agent

**Acceptance Criteria:**

1. GIVEN user selects "SA Agent" from popup, THEN textarea contains `/sa-agent ` with cursor at end
2. GIVEN textarea has `/sa-agent please review`, WHEN message is sent, THEN extension routes to sa-agent
3. GIVEN the prefix is in textarea, THEN user can backspace to remove/edit it

---

#### STORY 7: Steering Rule Selection Behavior

> As a developer, I want selecting a steering rule to attach it as context so that the agent uses that rule during processing.

**Requirement Details:**

1. When a steering rule is selected:
   - Remove the `/filter_text` from the textarea
   - Attach the steering rule as a context item (same mechanism as `#` context attachment)
   - A chip appears in the context chips area: "🧭 rule-name"
   - The rule file path is included in the `context` array when the message is sent
2. The context item type is `"steering"` with the file path in `path` field
3. Multiple steering rules can be attached simultaneously

**Acceptance Criteria:**

1. GIVEN user selects "drawio" steering rule, THEN a chip "🧭 drawio" appears in context chips
2. GIVEN a steering chip is attached, WHEN message is sent, THEN context includes `{ type: "steering", label: "drawio", path: ".kiro/steering/drawio.md" }`
3. GIVEN multiple steering rules selected, THEN multiple chips are visible

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Chat Panel Base | System | KSA-210 (Done) | Chat panel webview infrastructure |
| Hash Context Picker | System | KSA-252 | Shared popup infrastructure (trigger detection, keyboard nav, positioning) |
| Context Chips | System | KSA-230 (Done) | Context chip rendering for steering attachment |
| Steering Loaded Message | System | KSA-210 | `chat:steeringLoaded` message already exists in protocol |
| Message Protocol | System | KSA-210 | `chat:pickContext` with type "steering" |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Developer | Extension Dev Team | Implement slash command popup and agent routing |
| Product Owner | Product Team | Accept UI pattern matches Kiro IDE |
| QA | QA Team | Verify agent routing, filtering, keyboard navigation |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Collision between `#` and `/` popup triggers when both typed quickly | Medium | Low | Mutex — only one popup active at a time |
| Steering rules list may be empty if no `.kiro/steering/` files | Low | Medium | Show placeholder "No steering rules" gracefully |
| Agent routing logic not yet implemented in extension host | High | Medium | Must implement message handler that reads `/agent-name` prefix |
| Dynamic agent list may change (new agents added) | Low | Low | Support dynamic list via extension message, fallback to hardcoded |

### 5.2 Assumptions

- The `chat:steeringLoaded` message is already implemented and sends rule list on panel init
- Agent routing can be determined by parsing `/agent-name` prefix from message text
- The popup component infrastructure from KSA-252 is reusable for `/` trigger
- All 6 agents listed are available and registered in the system
- Steering rule files are read-only from the webview perspective (no editing)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Popup appears within 50ms of `/` keystroke | Same performance target as `#` popup |
| Performance | Filter response < 16ms | Instant visual feedback on keystroke |
| Accessibility | Keyboard-only operation | ArrowUp/Down/Enter/Escape navigation |
| Accessibility | ARIA attributes | `role="listbox"`, section headers as `role="group"` |
| UX Consistency | Match Kiro IDE `/` command pattern | Two-section layout, same visual style |
| Compatibility | Works in VS Code Webview CSP | No external resources |
| Code Reuse | Share popup infrastructure with KSA-252 | Same component, different data source |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-254 | Chat Panel: Slash Command Menu | To Do | Story | Main ticket |
| KSA-252 | Chat Panel: Hash Context Picker Menu | To Do | Story | Prerequisite (shared popup infra) |
| KSA-210 | Chat Panel base implementation | Done | Story | Prerequisite |
| KSA-240 | Context Window + Tabs | Done | Story | Prerequisite |
| KSA-230 | Chat Panel input toolbar + context chips | Done | Story | Prerequisite |

---

## 8. Appendix

### UI Mockup Description

```
+-------------------------------------------+
| SDLC Pipeline              * connected    |
+-------------------------------------------+
|                                           |
|  [Chat messages area]                     |
|                                           |
+-------------------------------------------+
| +---------------------------------------+ |
| | / Slash Commands                      | |
| | +-----------------------------------+ | |
| | | AGENTS                            | | |
| | | 🧪 QA Agent     Testing & QA      | | |
| | | 🏗️ SA Agent     Architecture      | | |
| | | 📋 SM Agent     Pipeline mgmt     | | |
| | | 🔧 TA Agent     Tech analysis     | | |
| | | 🎨 UI Agent     UI/UX design      | | |
| | | 🔒 Security     Security review   | | |
| | |-----------------------------------|  | |
| | | STEERING RULES                    | | |
| | | 🧭 drawio                         | | |
| | | 🧭 sm-core                        | | |
| | | 🧭 phase-1-requirements           | | |
| | | 🧭 concise-responses              | | |
| | +-----------------------------------+ | |
| +---------------------------------------+ |
| +---------------------------------------+ |
| | [🧭 drawio]                    chips  | |
| | /sa-agent review architecture   [^]   | |
| | [#] [📎]          [Auto v] [AP] [^]   | |
| +---------------------------------------+ |
+-------------------------------------------+
```

### Message Protocol Extensions

**New context type for steering:**
```typescript
// In ContextItem interface
export interface ContextItem {
  type: "file" | "folder" | "problems" | "gitDiff" | "terminal" | "spec" | "currentFile" | "steering" | "mcp";
  label: string;
  path?: string;
}
```

**Agent routing in userMessage:**
```typescript
// Extension host parses message text for /agent-name prefix
// e.g., "/sa-agent review this architecture" -> routes to sa-agent with message "review this architecture"
```

### Glossary

| Term | Definition |
|------|------------|
| Slash Command | Action triggered by typing `/` prefix in chat input |
| Agent Routing | Directing a message to a specific agent based on `/agent-name` prefix |
| Steering Rule | Configuration file in `.kiro/steering/` that guides agent behavior |
| Section Header | Non-selectable divider label separating popup sections |
| Trigger Position | Valid position for `/` activation (start of input or after whitespace) |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
