# Functional Specification Document (FSD)

## FEC CR Builder — KSA-240: Chat Panel UI: Context Window Usage Icon + Conversation Tabs

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-240 |
| Title | Chat Panel UI: Context Window Usage Icon + Conversation Tabs |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-06-07 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-240.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-07 | BA Agent | Initiate document from BRD KSA-240 |
| 1.0 | 2026-06-07 | TA Agent | Enriched with API contracts, technical specs |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Chat Panel UI enhancements: Context Window Usage Icon and Conversation Tabs feature for the FEC CR Builder VS Code extension.

### 1.2 Scope

- Context Window Usage Icon: real-time visual token usage indicator
- Conversation Tabs: multi-thread chat management within single panel
- Tech stack: TypeScript, VS Code Webview API, HTML/CSS/JS

### 1.3 Definitions and Acronyms

| Term | Definition |
|------|------------|
| Context Window | Maximum tokens an LLM can process per conversation |
| Token | Unit of text (~4 chars English) used by LLMs |
| Webview | VS Code API for rendering custom HTML/CSS/JS in panels |
| Tab | Independent conversation thread with own context |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-240.docx |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The Chat Panel Webview communicates with the VS Code Extension Host via message passing. The Extension Host manages LLM interactions, token counting, and conversation state.

### 2.2 System Architecture

```
[VS Code Editor]
    |
    v
[Extension Host (TypeScript)]
    |-- ChatPanelProvider (WebviewViewProvider)
    |-- ConversationManager (tab state, messages)
    |-- TokenCounter (context window tracking)
    |
    v (postMessage / onDidReceiveMessage)
[Webview (HTML/CSS/JS)]
    |-- TabBar component
    |-- ContextUsageIcon component
    |-- MessageList component
    |-- InputArea component
```

---

## 3. Functional Requirements

### 3.1 Feature: Context Window Usage Icon

**Source:** BRD Story 1, Story 4

#### 3.1.1 Use Case UC-01: View Context Usage

| Field | Value |
|-------|-------|
| Use Case ID | UC-01 |
| Name | View Context Window Usage |
| Actor | Developer |
| Precondition | Chat Panel is open with active conversation |
| Trigger | Panel renders or context changes |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | - | System renders context usage icon in panel header |
| 2 | - | System calculates token count for active tab |
| 3 | - | System renders arc/circle progress with color based on usage% |
| 4 | Developer | Hovers over icon |
| 5 | - | System shows tooltip: "{current} / {max} tokens ({pct}%)" |

**Alternative Flows:**

| Flow | Condition | Steps |
|------|-----------|-------|
| AF-01 | Usage crosses 60% | Icon color changes from green to yellow |
| AF-02 | Usage crosses 80% | Icon color changes to red, pulse animation |
| AF-03 | Usage crosses 95% | Non-intrusive notification appears |
| AF-04 | Usage reaches 100% | Input area shows warning + "New Tab" button |

**Exception Flows:**

| Flow | Condition | Steps |
|------|-----------|-------|
| EF-01 | Token counter unavailable | Show "?" icon with tooltip "Unable to calculate" |
| EF-02 | maxTokens is 0/undefined | Show disabled icon state |

**Postcondition:** User is informed of current context window utilization.

---

#### 3.1.2 Business Rules

| Rule ID | Rule | Condition | Action |
|---------|------|-----------|--------|
| BR-01 | Green zone | usage < 60% | Icon fill color = green (#4CAF50) |
| BR-02 | Warning zone | 60% <= usage < 80% | Icon fill color = yellow (#FFC107) |
| BR-03 | Critical zone | usage >= 80% | Icon fill color = red (#F44336) |
| BR-04 | Pulse trigger | usage crosses 80% (once per direction) | CSS pulse animation for 2s |
| BR-05 | Notification | usage >= 95% | Show dismissible notification toast |
| BR-06 | Full context | usage >= 100% | Inline warning in input area |
| BR-07 | Update frequency | Any message sent/received | Recalculate within 500ms |

---

### 3.2 Feature: Conversation Tabs

**Source:** BRD Story 2, Story 3

#### 3.2.1 Use Case UC-02: Create New Conversation Tab

| Field | Value |
|-------|-------|
| Use Case ID | UC-02 |
| Name | Create New Conversation Tab |
| Actor | Developer |
| Precondition | Chat Panel open, < 10 tabs exist |
| Trigger | User clicks "+" button on tab bar |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Developer | Clicks "+" button |
| 2 | - | System creates new ConversationTab with unique ID |
| 3 | - | System names tab "Chat {N}" (next sequential number) |
| 4 | - | System switches to new tab (makes active) |
| 5 | - | System resets context usage icon to 0% for new tab |
| 6 | - | System renders empty message area |

**Alternative Flows:**

| Flow | Condition | Steps |
|------|-----------|-------|
| AF-01 | 10 tabs already open | "+" button disabled with tooltip "Maximum 10 tabs" |

**Postcondition:** New empty conversation tab is active with fresh context.

---

#### 3.2.2 Use Case UC-03: Switch Between Tabs

| Field | Value |
|-------|-------|
| Use Case ID | UC-03 |
| Name | Switch Conversation Tab |
| Actor | Developer |
| Precondition | Multiple tabs exist |
| Trigger | User clicks on inactive tab |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Developer | Clicks target tab label |
| 2 | - | System saves current tab state (scroll position, draft) |
| 3 | - | System marks clicked tab as active |
| 4 | - | System loads target tab messages |
| 5 | - | System updates context usage icon with target tab token count |
| 6 | - | System restores scroll position |

**Postcondition:** Target tab is active, UI reflects its context state.

---

#### 3.2.3 Use Case UC-04: Close Tab

| Field | Value |
|-------|-------|
| Use Case ID | UC-04 |
| Name | Close Conversation Tab |
| Actor | Developer |
| Precondition | More than 1 tab exists |
| Trigger | User clicks "x" on tab |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Developer | Clicks "x" on target tab |
| 2 | - | System checks if tab has messages |
| 3 | - | If has messages: show confirmation dialog |
| 4 | Developer | Confirms close |
| 5 | - | System removes tab and its data |
| 6 | - | System activates adjacent tab (prefer left, fallback right) |

**Alternative Flows:**

| Flow | Condition | Steps |
|------|-----------|-------|
| AF-01 | Tab has no messages | Skip confirmation, close immediately |
| AF-02 | Only 1 tab remains | "x" button not shown |
| AF-03 | User cancels confirmation | Tab remains open, no action |

---

#### 3.2.4 Use Case UC-05: Rename Tab

| Field | Value |
|-------|-------|
| Use Case ID | UC-05 |
| Name | Rename Conversation Tab |
| Actor | Developer |
| Precondition | Tab exists |
| Trigger | User double-clicks tab label |

**Main Flow:**

| Step | Actor | System |
|------|-------|--------|
| 1 | Developer | Double-clicks tab label |
| 2 | - | System enters edit mode (label becomes input field) |
| 3 | Developer | Types new name |
| 4 | Developer | Presses Enter or clicks away |
| 5 | - | System validates name (non-empty, max 30 chars) |
| 6 | - | System updates tab label |

**Exception Flows:**

| Flow | Condition | Steps |
|------|-----------|-------|
| EF-01 | Empty name submitted | Revert to previous name |
| EF-02 | Name exceeds 30 chars | Truncate at 30 characters |

---

### 3.3 Data Specifications

#### 3.3.1 ConversationTab Interface

```typescript
interface ConversationTab {
  id: string;           // UUID v4
  name: string;         // Display name, max 30 chars
  messages: Message[];  // Conversation messages
  tokenCount: number;   // Current tokens used
  maxTokens: number;    // Provider's max context window
  isActive: boolean;    // Currently selected tab
  createdAt: string;    // ISO 8601 datetime
  scrollPosition: number; // Saved scroll offset
  draftMessage: string; // Unsent message draft
}

interface Message {
  id: string;           // UUID v4
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;    // ISO 8601
  tokenCount: number;   // Tokens in this message
}
```

#### 3.3.2 State Diagram

![Tab Lifecycle State](diagrams/state-tab-lifecycle.png)

---

### 3.4 API Contracts (Extension Host <-> Webview)

#### Messages from Webview to Extension Host:

```typescript
// Create new tab
{ type: 'createTab' }

// Switch active tab
{ type: 'switchTab', payload: { tabId: string } }

// Close tab
{ type: 'closeTab', payload: { tabId: string } }

// Rename tab
{ type: 'renameTab', payload: { tabId: string, newName: string } }

// Send chat message
{ type: 'sendMessage', payload: { tabId: string, content: string } }
```

#### Messages from Extension Host to Webview:

```typescript
// Tab created confirmation
{ type: 'tabCreated', payload: { tab: ConversationTab } }

// Tab list updated (after any tab operation)
{ type: 'tabsUpdated', payload: { tabs: ConversationTab[], activeTabId: string } }

// Context usage update
{ type: 'contextUpdate', payload: { tabId: string, tokenCount: number, maxTokens: number } }

// New message received (AI response)
{ type: 'messageReceived', payload: { tabId: string, message: Message } }

// Error
{ type: 'error', payload: { code: string, message: string } }
```

---

### 3.5 UI Specifications

#### 3.5.1 Layout Structure

```
+------------------------------------------+
| [Context Icon] Chat Panel Title      [+] |  <- Header
+------------------------------------------+
| [Chat 1] [Chat 2] [Chat 3*]         [+] |  <- Tab Bar
+------------------------------------------+
|                                          |
|  Message 1 (user)                        |
|  Message 2 (assistant)                   |  <- Message Area
|  ...                                     |
|                                          |
+------------------------------------------+
| [Type a message...]              [Send]  |  <- Input Area
+------------------------------------------+
```

#### 3.5.2 Context Usage Icon Specs

| Property | Value |
|----------|-------|
| Size | 20x20px |
| Type | SVG circular arc |
| Stroke width | 3px |
| Background arc | var(--vscode-badge-background) |
| Progress arc | Dynamic color (BR-01 to BR-03) |
| Position | Left side of panel header |
| Tooltip delay | 300ms hover |

#### 3.5.3 Tab Bar Specs

| Property | Value |
|----------|-------|
| Height | 32px |
| Tab min-width | 80px |
| Tab max-width | 150px |
| Active tab | Bottom border 2px var(--vscode-focusBorder) |
| Inactive tab | No bottom border |
| Close button | 14x14px, visible on hover |
| "+" button | Fixed at right end of tab bar |
| Overflow | Horizontal scroll with arrows |

---

### 3.6 Error Handling

| Error Code | Condition | User Message | Recovery |
|------------|-----------|--------------|----------|
| ERR_MAX_TABS | Creating 11th tab | "Maximum 10 conversations reached" | None, button disabled |
| ERR_TOKEN_SERVICE | Token counter fails | Icon shows "?" | Retry on next message |
| ERR_TAB_SAVE | State save fails | Silent (log only) | Auto-retry |
| ERR_RENAME | Invalid tab name | Revert to previous name | User retries |

---

## 4. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| Performance | Icon update latency | < 500ms |
| Performance | Tab switch render | < 200ms |
| Performance | Memory per tab | < 5MB |
| Accessibility | Keyboard navigation | Ctrl+Tab, Ctrl+W, Ctrl+N |
| Accessibility | Screen reader | ARIA labels on all interactive elements |
| Compatibility | VS Code | >= 1.80 |
| Compatibility | Themes | Light, Dark, High Contrast |
| Responsiveness | Min panel width | 300px |

---

## 5. Sequence Diagrams

### 5.1 Send Message and Update Context

![Sequence: Send Message](diagrams/sequence-send-message.png)

### 5.2 Create and Switch Tab

![Sequence: Tab Operations](diagrams/sequence-tab-operations.png)

---

## 6. Open Issues

| # | Issue | Status | Decision Needed By |
|---|-------|--------|-------------------|
| 1 | Should tabs persist across VS Code restloads? | Deferred | PO |
| 2 | Should context count include system prompt? | TBD | Tech Lead |
| 3 | Drag-drop tab reordering priority | SHOULD HAVE (v2) | PO |

---

## 7. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Tab Lifecycle State | [state-tab-lifecycle.png](diagrams/state-tab-lifecycle.png) | [state-tab-lifecycle.drawio](diagrams/state-tab-lifecycle.drawio) |
| 3 | Sequence: Send Message | [sequence-send-message.png](diagrams/sequence-send-message.png) | [sequence-send-message.drawio](diagrams/sequence-send-message.drawio) |
| 4 | Sequence: Tab Operations | [sequence-tab-operations.png](diagrams/sequence-tab-operations.png) | [sequence-tab-operations.drawio](diagrams/sequence-tab-operations.drawio) |
