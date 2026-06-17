# Business Requirements Document (BRD)

## FEC CR Builder — KSA-240: Chat Panel UI: Context Window Usage Icon + Conversation Tabs

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-240 |
| Title | Chat Panel UI: Context Window Usage Icon + Conversation Tabs |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-07 |
| Status | Draft |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-07 | BA Agent | Initiate document from Jira ticket KSA-240 |

---

## 1. Introduction

### 1.1 Scope

This CR enhances the existing Chat Panel in the FEC CR Builder VS Code extension with two key features:

1. **Context Window Usage Icon** - a visual indicator displaying token usage (current count vs maximum capacity)
2. **Conversation Tabs** - enabling multiple independent chat threads within the same panel

### 1.2 Out of Scope

- Backend LLM integration changes
- Chat message rendering improvements beyond tab management
- History persistence across VS Code sessions
- Export/share conversation functionality

### 1.3 Preliminary Requirements

- VS Code Webview API access from existing extension infrastructure
- Token counting service must expose current/max values
- Existing Chat Panel must be functional and rendered via Webview

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Chat Panel is a VS Code Webview-based panel used by developers to interact with AI assistants. This enhancement adds visibility into context utilization and multi-conversation management.

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer, I want to see how much context window is used so that I can manage my prompts effectively | MUST HAVE | KSA-240 |
| 2 | As a developer, I want multiple conversation tabs so that I can work on different topics simultaneously | MUST HAVE | KSA-240 |
| 3 | As a developer, I want to create/close conversation tabs so that I can organize my work | MUST HAVE | KSA-240 |
| 4 | As a developer, I want visual feedback when context is nearly full so that I can take action before hitting limits | SHOULD HAVE | KSA-240 |

---

### 2.3 Details of User Stories

#### STORY 1: Context Window Usage Icon

> As a developer, I want to see how much context window is used so that I can manage my prompts effectively.

**Requirement Details:**

1. Display a circular/arc progress icon in the Chat Panel header showing current token count vs maximum token capacity
2. The icon must update in real-time as messages are sent/received
3. Show numerical tooltip on hover: "{current_tokens} / {max_tokens} tokens ({percentage}%)"
4. Icon changes color based on usage thresholds: Green (0-60%), Yellow (60-80%), Red (80-100%)

**Acceptance Criteria:**

1. Context usage icon is visible in Chat Panel header at all times
2. Icon displays accurate token count matching actual context window usage
3. Hover tooltip shows exact numbers: current/max/percentage
4. Color changes at correct thresholds (60%, 80%)
5. Icon updates within 500ms of any context change
6. Icon renders correctly in both light and dark VS Code themes

---

#### STORY 2: Conversation Tabs

> As a developer, I want multiple conversation tabs so that I can work on different topics simultaneously.

**Requirement Details:**

1. Tab bar displayed below the Chat Panel header (above message area)
2. Each tab represents an independent conversation with its own message history and context
3. Default: one tab created on panel open (named "Chat 1")
4. "+" button to create new tab (auto-named "Chat 2", "Chat 3", etc.)
5. Each tab maintains its own independent context window (separate token count)
6. Context usage icon reflects the currently active tab usage

**Data Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tabId | string (UUID) | Yes | Unique identifier for each tab |
| tabName | string | Yes | Display name of the tab |
| messages | Message[] | Yes | Array of messages in this conversation |
| tokenCount | number | Yes | Current token usage for this tab |
| maxTokens | number | Yes | Maximum tokens available |
| isActive | boolean | Yes | Whether this tab is currently selected |
| createdAt | ISO datetime | Yes | When the tab was created |

**Acceptance Criteria:**

1. Tab bar is visible with at least one tab always present
2. Clicking "+" creates a new empty conversation tab
3. Clicking a tab switches to that conversation (messages, context)
4. Each tab has its own independent context window usage
5. Context usage icon updates when switching tabs
6. Maximum 10 tabs can be open simultaneously
7. Tab can be renamed by double-clicking the tab label

---

#### STORY 3: Tab Management (Create/Close/Rename)

> As a developer, I want to create/close conversation tabs so that I can organize my work.

**Requirement Details:**

1. Close button ("x") on each tab (except when only 1 tab remains)
2. Close confirmation if tab has messages
3. Double-click tab label to rename
4. Tab order can be rearranged by drag-and-drop (SHOULD HAVE)

**Acceptance Criteria:**

1. "x" button appears on hover for tabs with >1 tab open
2. Closing a tab with messages shows confirmation dialog
3. Cannot close the last remaining tab
4. Double-click on tab name enters edit mode
5. Tab names limited to 30 characters

---

#### STORY 4: Context Usage Warning States

> As a developer, I want visual feedback when context is nearly full so that I can take action before hitting limits.

**Requirement Details:**

1. At 80% usage, icon pulses briefly to draw attention
2. At 95%, a non-intrusive notification appears suggesting a new conversation
3. At 100%, input area shows warning with "New Tab" action button

**Acceptance Criteria:**

1. Pulse animation triggers once when crossing 80% threshold
2. Notification appears at 95% (dismissible, once per crossing)
3. At 100%, typing area shows inline warning with "New Tab" button
4. Warning states reset when user creates a new tab

---

## 3. Dependencies

| Dependency | Type | Description |
|------------|------|-------------|
| VS Code Webview API | System | Extension must have webview panel registration |
| Token counting service | System | Must expose current/max token counts |
| CSS/Theme Variables | System | Must support VS Code theme CSS variables |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Reporter | Duc Nguyen Minh | Requirements definition |
| Developer | TBD | Implementation |
| QA | TBD | Testing and verification |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Token counting inaccuracy | Medium | Low | Use tiktoken or provider tokenizer |
| Memory usage with many tabs | Medium | Low | Limit max tabs to 10, lazy-load |
| Theme compatibility issues | Low | Medium | Use CSS variables, test popular themes |

### 5.2 Assumptions

- Token counting service already exists and provides real-time values
- VS Code Webview supports required DOM manipulation for tabs
- Users typically need 2-5 simultaneous conversations
- Context window max is configurable per LLM provider

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Icon update latency | < 500ms after context change |
| Performance | Tab switch time | < 200ms to render new tab messages |
| Performance | Memory per tab | < 5MB per conversation tab |
| Usability | Accessibility | Keyboard-navigable (Ctrl+Tab, Ctrl+W) |
| Usability | Responsiveness | Works in panel widths 300px-800px |
| Compatibility | VS Code versions | Support VS Code 1.80+ |
| Compatibility | Themes | Light, Dark, High Contrast |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-240 | Chat Panel UI: Context Window Usage Icon + Conversation Tabs | In Progress | Task | Main ticket |

---

## 8. Appendix

### Use Case Diagram

![Use Case Diagram](diagrams/use-case.png)

### Glossary

| Term | Definition |
|------|------------|
| Context Window | The maximum number of tokens an LLM can process in a single conversation |
| Token | A unit of text (roughly 4 characters in English) used by LLMs |
| Webview | VS Code API for rendering custom HTML/CSS/JS content in panels |
| Tab | An independent conversation thread with its own context and history |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
