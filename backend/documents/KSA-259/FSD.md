# Functional Specification Document (FSD)

## Kiro SDLC Extension — KSA-259: Chat Panel: Interactive Options on Input Area when AI asks questions

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-259 |
| Title | Chat Panel: Interactive Options on Input Area when AI asks questions |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-07-25 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-259.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-25 | BA Agent | Initiate document from BRD |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Interactive Options feature on the Chat Panel Input Area. It defines use cases, state transitions, postMessage protocol additions, CSS specifications, keyboard navigation, and pseudocode for implementation.

### 1.2 Scope

- Rendering clickable option buttons above the textarea when AI asks a question
- Click-to-select option behavior
- Custom text response while options are visible
- Keyboard navigation (Tab, Enter, Escape)
- postMessage protocol for `chat:userInput` and `chat:userResponse`
- State coordination with Spinner (KSA-255) — options hidden during PROCESSING state
- Dark theme styling with Kiro purple/magenta accent

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| Options Container | Flex-wrap div above textarea that holds option buttons |
| Option Button | A clickable `<button>` element representing one predefined response |
| chat:userInput | postMessage type from Extension Host carrying question + options[] |
| chat:userResponse | postMessage type from Webview carrying user's selected response |
| fromOption | Boolean flag indicating whether response was clicked (true) or typed (false) |
| IDLE | State where no options are displayed |
| OPTIONS_VISIBLE | State where option buttons are rendered and interactive |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-259/BRD.md |
| Shared Protocol Types | src/shared/protocol.ts |
| KSA-255 FSD (spinner state reference) | documents/KSA-255/FSD.md |
| Chat Panel Foundation | KSA-210 (Done) |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)
*[Edit in draw.io](diagrams/system-context.drawio)*

The Interactive Options feature operates within the VS Code Extension architecture:

- **User** — views options, clicks buttons, types responses, navigates via keyboard
- **Webview (Chat Panel)** — renders option buttons, manages OPTIONS_VISIBLE state, sends responses
- **Extension Host** — emits `chat:userInput` when AI asks questions, receives `chat:userResponse`
- **AI Backend** — determines when to present options (opaque to webview)

### 2.2 System Architecture

The feature adds an OptionsController to the existing Chat Panel webview:

1. **OptionsController** — manages options state (IDLE ↔ OPTIONS_VISIBLE), renders/removes buttons
2. **OptionsView** — renders option buttons as flex-wrap button list above textarea
3. **postMessage Protocol Extension** — new message types `chat:userInput` and `chat:userResponse`
4. **Keyboard Handler** — Tab navigation between buttons, Enter to select, Escape to dismiss

---

## 3. Functional Requirements

### 3.1 Feature: Interactive Options Display

**Source:** BRD Stories 1, 2, 3, 4

#### 3.1.1 Description

When the Extension Host sends a `chat:userInput` message containing a question and options array, the Chat Panel displays clickable buttons above the textarea. The user can respond by clicking a button or typing a custom response. After any response, the buttons disappear.

#### 3.1.2 Use Case: UC-01 — Display Options on AI Question

**Use Case ID:** UC-01
**Actor:** Extension Host (trigger), User (observer)
**Preconditions:** Chat Panel is open, Input Area is in IDLE state (no options shown, not in PROCESSING state)
**Postconditions:** Option buttons are visible above textarea

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Extension Host sends `chat:userInput { question, options[] }` | AI question with options received |
| 2 | | Webview OptionsController receives message | State guard: only if IDLE and not PROCESSING |
| 3 | | OptionsController transitions IDLE → OPTIONS_VISIBLE | State change |
| 4 | | OptionsView renders buttons above textarea | Buttons appear within 100ms |
| 5 | | Aria-live announces question text | Screen reader feedback |
| 6 | User sees option buttons | | Options ready for interaction |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Options received during PROCESSING state (spinner active) | Options queued, displayed after PROCESSING ends |
| AF-02 | Options received while previous options still visible | Replace previous options with new ones |
| AF-03 | Empty options array received | Ignore message, no state change |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Options array has >5 items | Display first 5, truncate rest |
| EF-02 | Options array has <2 items | Display single option (still valid UX) |

---

#### 3.1.3 Use Case: UC-02 — Select Option by Click

**Use Case ID:** UC-02
**Actor:** User
**Preconditions:** Option buttons are visible (OPTIONS_VISIBLE state)
**Postconditions:** Response sent, buttons hidden, state returns to IDLE

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User clicks an option button | | Click event on button element |
| 2 | | OptionsController captures clicked text | Extract button textContent |
| 3 | | Webview sends `chat:userResponse { response: text, source: 'option-click' }` | Response sent to Extension Host |
| 4 | | OptionsController transitions OPTIONS_VISIBLE → IDLE | State reset |
| 5 | | OptionsView removes all buttons from DOM | Buttons disappear immediately |
| 6 | | Clicked text appears in chat as user message bubble | Visual confirmation |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | User double-clicks quickly | Only first click processed (guard: state already transitioning) |

---

#### 3.1.4 Use Case: UC-03 — Type Custom Response

**Use Case ID:** UC-03
**Actor:** User
**Preconditions:** Option buttons are visible, textarea is editable
**Postconditions:** Response sent, buttons hidden, state returns to IDLE

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User types text in textarea | | Textarea remains fully functional |
| 2 | User presses Enter (or clicks Send) | | Submit action triggered |
| 3 | | Webview sends `chat:userResponse { response: text, source: 'text-input' }` | Typed text sent |
| 4 | | OptionsController transitions OPTIONS_VISIBLE → IDLE | State reset |
| 5 | | OptionsView removes all buttons from DOM | Buttons disappear |
| 6 | | Typed text appears as user message bubble | Visual confirmation |

---

#### 3.1.5 Use Case: UC-04 — Keyboard Navigation

**Use Case ID:** UC-04
**Actor:** User
**Preconditions:** Option buttons are visible
**Postconditions:** User selects option or dismisses via keyboard

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User presses Tab | | Focus moves to first/next option button |
| 2 | | Button receives visible focus ring | Focus indicator shown |
| 3 | User presses Enter on focused button | | Selection triggered |
| 4 | | Same as UC-02 Main Flow steps 2-6 | Option selected |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | User presses Escape | Options dismissed, focus returns to textarea, state → IDLE |
| AF-02 | User presses Shift+Tab from first button | Focus moves to textarea |
| AF-03 | User presses Tab from last button | Focus wraps to textarea |

---

### 3.2 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | Options MUST appear within 100ms of chat:userInput message receipt | BRD AC-1 |
| BR-02 | Each button MUST display full option text with adequate padding (4px 12px) | BRD AC-2 |
| BR-03 | Clicking option MUST send response and hide buttons immediately | BRD AC-3, AC-4 |
| BR-04 | After selection, buttons MUST disappear within 1 frame (16ms) | BRD AC-4 |
| BR-05 | Textarea MUST remain editable while options are visible | BRD AC-5 |
| BR-06 | Support 2-5 option buttons simultaneously | BRD AC-6 |
| BR-07 | Buttons MUST use Kiro dark theme with purple/magenta accent | BRD AC-7 |
| BR-08 | Options MUST NOT display during PROCESSING state (spinner active) | State coordination |
| BR-09 | Buttons MUST wrap to next row if they overflow container width | BRD Additional Context |
| BR-10 | Tab navigates between buttons, Enter selects, Escape dismisses | BRD Additional Context |
| BR-11 | State transitions MUST be idempotent | Defensive programming |

---

### 3.3 UI Specifications

**Screen: Chat Panel — Input Area (Options Visible)**

| No. | Element | Type | CSS Class | Behavior | Validation |
|-----|---------|------|-----------|----------|------------|
| 1 | Options Container | div | .options-container | Visible when OPTIONS_VISIBLE, flex-wrap | gap: 6px, padding: 8px |
| 2 | Option Button | button | .option-btn | Click → select, focus ring on Tab | padding: 4px 12px, border-radius: 4px |
| 3 | Textarea | textarea | .chat-input | Remains editable while options shown | No change from normal state |
| 4 | SR Announcement | div | .sr-only | aria-live="polite" announces question | Visually hidden |

**CSS Variables Used:**

| Variable | Purpose | Fallback |
|----------|---------|----------|
| --vscode-button-secondaryBackground | Button background | #3a3d41 |
| --vscode-button-secondaryForeground | Button text color | #cccccc |
| --vscode-button-secondaryHoverBackground | Button hover state | #45494e |
| --vscode-focusBorder | Focus ring color (purple/magenta) | #007fd4 |
| --vscode-descriptionForeground | Question label text | #717171 |

**CSS Specification:**

```css
.options-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 8px 4px;
  border-bottom: 1px solid var(--vscode-widget-border, #303031);
}

.option-btn {
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid var(--vscode-button-border, #454545);
  background: var(--vscode-button-secondaryBackground, #3a3d41);
  color: var(--vscode-button-secondaryForeground, #cccccc);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.option-btn:hover {
  background: var(--vscode-button-secondaryHoverBackground, #45494e);
  border-color: var(--vscode-focusBorder, #007fd4);
}

.option-btn:focus-visible {
  outline: 2px solid var(--vscode-focusBorder, #007fd4);
  outline-offset: 1px;
}

.option-btn:active {
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #ffffff);
}
```

---

### 3.4 postMessage Protocol

**New Message Types:**

| Message Type | Payload | Direction | Description |
|-------------|---------|-----------|-------------|
| chat:options | { options: string[], question?: string } | Host → Webview | AI asks question with options |
| chat:response | { text: string, source: 'option-click' \| 'text-input' } | Webview → Host | User response |

**TypeScript Interfaces (from src/shared/protocol.ts):**

```typescript
// Extension Host → Webview
export interface ChatOptionsSignal {
  type: 'chat:options';
  options: string[];
  question?: string;
}

// Webview → Extension Host
export interface ChatResponseMessage {
  type: 'chat:response';
  text: string;
  source: 'option-click' | 'text-input';
}
```

---

## 4. Data Model

### 4.1 State Machine

![State — Options](diagrams/state-options.png)
*[Edit in draw.io](diagrams/state-options.drawio)*

**States:**

| State | Description | UI Appearance |
|-------|-------------|---------------|
| IDLE | No options displayed | Normal textarea, no buttons |
| OPTIONS_VISIBLE | Option buttons rendered above textarea | Buttons visible, textarea editable |

**Transitions:**

| From | To | Trigger | Guard | Action |
|------|-----|---------|-------|--------|
| IDLE | OPTIONS_VISIBLE | chat:options received | not PROCESSING | Render buttons, announce question |
| OPTIONS_VISIBLE | IDLE | Option button clicked | — | Send response, remove buttons |
| OPTIONS_VISIBLE | IDLE | Custom text submitted (Enter) | text.length > 0 | Send response, remove buttons |
| OPTIONS_VISIBLE | IDLE | Escape key pressed | — | Remove buttons, focus textarea |
| OPTIONS_VISIBLE | IDLE | New message submitted (unrelated) | — | Remove buttons (stale options) |
| OPTIONS_VISIBLE | IDLE | PROCESSING state starts | — | Hide buttons (spinner takes priority) |

### 4.2 TypeScript Interfaces

```typescript
export interface OptionsState {
  isVisible: boolean;
  options: string[];
  question: string | null;
}

export const INITIAL_OPTIONS_STATE: OptionsState = {
  isVisible: false,
  options: [],
  question: null,
};
```

---

## 5. Integration Specifications

### 5.1 External System: VS Code Extension Host

| Attribute | Value |
|-----------|-------|
| Purpose | Emits AI questions with options, receives user responses |
| Direction | Bidirectional (postMessage) |
| Data Format | JSON |
| Frequency | Event-driven (when AI asks questions) |

**Data Exchange:**

| Webview Data | Extension Host Data | Direction | Business Rule |
|-------------|-------------------|-----------|---------------|
| — | chat:options { options[], question? } | Host → Webview | BR-01: render within 100ms |
| chat:response { text, source } | — | Webview → Host | BR-03: send on click/enter |

### 5.2 Integration with Spinner (KSA-255)

| Attribute | Value |
|-----------|-------|
| Purpose | State coordination — options hidden during PROCESSING |
| Pattern | Observer — OptionsController listens to SpinnerController state changes |
| Rule | BR-08: If PROCESSING starts while OPTIONS_VISIBLE, hide options |

---

## 6. Processing Logic

### 6.1 Process: Show Options

**Trigger:** `chat:options` message received
**Input:** ChatOptionsSignal { options[], question? }
**Output:** Option buttons rendered

**Pseudocode:**

```typescript
function showOptions(signal: ChatOptionsSignal): void {
  // Guard: ignore if spinner is active (BR-08)
  if (spinnerState.isProcessing) {
    pendingOptions = signal; // queue for later
    return;
  }
  // Guard: ignore empty options
  if (!signal.options || signal.options.length === 0) return;

  // Cap at 5 options (BR-06)
  const options = signal.options.slice(0, 5);

  // Update state
  state.isVisible = true;
  state.options = options;
  state.question = signal.question ?? null;

  // Render buttons
  renderOptionButtons(options);

  // Accessibility
  if (signal.question) {
    announce(signal.question);
  }
}
```

### 6.2 Process: Select Option

**Trigger:** Button click or Enter on focused button
**Input:** Clicked option text
**Output:** Response sent, buttons removed

**Pseudocode:**

```typescript
function selectOption(text: string): void {
  // Guard: not visible → no-op
  if (!state.isVisible) return;

  // Send response to Extension Host
  vscode.postMessage({
    type: 'chat:response',
    text: text,
    source: 'option-click'
  });

  // Clear options
  hideOptions();
}
```

### 6.3 Process: Submit Custom Text

**Trigger:** Enter key in textarea while options visible
**Input:** Textarea value
**Output:** Response sent, buttons removed

**Pseudocode:**

```typescript
function submitCustomResponse(text: string): void {
  // Send response
  vscode.postMessage({
    type: 'chat:response',
    text: text,
    source: 'text-input'
  });

  // Clear options if visible
  if (state.isVisible) {
    hideOptions();
  }
}
```

### 6.4 Process: Hide Options

**Trigger:** Selection, escape, or state coordination
**Output:** Buttons removed from DOM

**Pseudocode:**

```typescript
function hideOptions(): void {
  state.isVisible = false;
  state.options = [];
  state.question = null;

  // Remove buttons from DOM
  optionsContainer.innerHTML = '';
  optionsContainer.classList.remove('visible');

  // Return focus to textarea
  textarea.focus();
}
```

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

Not applicable — UI-only feature within the VS Code extension webview sandbox.

### 7.2 Input Sanitization

| Input | Sanitization | Reason |
|-------|-------------|--------|
| Option text from Extension Host | Escape HTML entities before rendering as textContent | Prevent XSS if option text contains HTML |
| User typed text | Standard textarea input (browser-sanitized) | No additional sanitization needed |

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Options appear quickly | ≤100ms from message receipt to buttons visible |
| Performance | Options disappear instantly | ≤16ms (1 frame) from selection to removal |
| Accessibility | Keyboard navigation | Tab, Enter, Escape fully functional |
| Accessibility | Screen reader | aria-live announces question, buttons have aria-label |
| Compatibility | VS Code versions | VS Code 1.85+ |
| Visual | Theme consistency | All colors use VS Code CSS custom properties |

---

## 9. Error Handling (User-Facing)

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| Options received with invalid data | Warning | — (silent) | Ignore message, no buttons shown |
| Button click fails to send response | Warning | "Failed to send response" | Retry once, then show error in message area |
| Options overlap with spinner | Info | — (silent) | Options queued until spinner ends |

---

## 10. Testing Considerations

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | Options display on message | chat:options with 3 options | 3 buttons visible | High |
| TC-02 | Click option sends response | Click button "Option A" | chat:response { text: "Option A", source: "option-click" } | High |
| TC-03 | Buttons disappear after click | Click any button | No buttons in DOM | High |
| TC-04 | Custom text still works | Type + Enter while options visible | chat:response { text, source: "text-input" }, buttons gone | High |
| TC-05 | Keyboard Tab navigation | Press Tab repeatedly | Focus moves between buttons | Medium |
| TC-06 | Keyboard Enter selects | Tab to button, press Enter | Same as click | Medium |
| TC-07 | Keyboard Escape dismisses | Press Escape | Buttons removed, textarea focused | Medium |
| TC-08 | Max 5 buttons | chat:options with 7 items | Only 5 buttons rendered | Medium |
| TC-09 | Options hidden during spinner | Spinner active, then chat:options | No buttons until spinner ends | High |
| TC-10 | Dark theme styling | Standard dark theme | Buttons use CSS variables | Low |
| TC-11 | Button wrap on narrow panel | 5 long options, narrow panel | Buttons wrap to multiple rows | Medium |

---

## 11. Appendix

### Sequence Diagram — Option Selection Flow

![Sequence — Options](diagrams/sequence-options.png)
*[Edit in draw.io](diagrams/sequence-options.drawio)*

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | State — Options | [state-options.png](diagrams/state-options.png) | [state-options.drawio](diagrams/state-options.drawio) |
| 3 | Sequence — Options | [sequence-options.png](diagrams/sequence-options.png) | [sequence-options.drawio](diagrams/sequence-options.drawio) |
