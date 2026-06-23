# Functional Specification Document (FSD)

## Kiro SDLC Extension — KSA-255: Chat Panel: Spinner + Working Indicator on Input Area during AI Processing

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-255 |
| Title | Chat Panel: Spinner + Working Indicator on Input Area during AI Processing |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-09 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-255.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-09 | BA Agent | Initiate document from BRD |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the Spinner + Working Indicator feature on the Chat Panel Input Area. It defines use cases, state machine transitions, postMessage protocol additions, CSS specifications, and pseudocode that developers will implement within the VS Code Extension webview.

### 1.2 Scope

- Spinner CSS animation rendering within the Input Area
- "Working" text label alongside the spinner
- Input textarea disabled/enabled state management
- postMessage protocol extension for processing state signals
- Stop button integration for immediate state reset
- 60-second timeout fallback
- Accessibility: aria-live announcements and prefers-reduced-motion support

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| Input Area | The textarea element in the Chat Panel where users type messages |
| Spinner | A CSS-animated rotating circle element indicating AI processing |
| Working Indicator | Combined spinner animation + "working" text label |
| postMessage | VS Code Webview API method for bidirectional extension host ↔ webview communication |
| Webview | VS Code embedded web content panel rendering the Chat Panel UI |
| Extension Host | The Node.js process running VS Code extension business logic |
| Processing State | Boolean state (isProcessing) tracking whether AI is currently processing a request |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-255/BRD.md |
| Shared Protocol Types | src/shared/protocol.ts |
| Context Menu Controller (state machine reference) | src/webview/context-menu/ContextMenuController.ts |
| Chat Panel Foundation | KSA-210 (Done) |
| Tool Call UI Blocks | KSA-247 (Done) |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)
*[Edit in draw.io](diagrams/system-context.drawio)*

The spinner feature operates within the VS Code Extension architecture:

- **User** — types messages, clicks Send/Stop buttons, observes visual feedback
- **Webview (Chat Panel)** — renders spinner/working indicator, manages UI state, handles CSS animations
- **Extension Host** — sends processing state signals (chat:processing), forwards messages to AI backend, receives streaming tokens
- **AI Backend** — processes user messages, streams response tokens back to extension host

### 2.2 System Architecture

The feature adds a state management layer to the existing Chat Panel webview:

1. **SpinnerController** — manages processing state transitions (READY ↔ PROCESSING)
2. **SpinnerView** — renders/hides spinner + working text CSS elements
3. **postMessage Protocol Extension** — new message type chat:processing from extension host to webview
4. **Timeout Manager** — enforces 60-second maximum spinner display

---

## 3. Functional Requirements

### 3.1 Feature: Processing State Indicator

**Source:** BRD Stories 1, 2, 3, 4

#### 3.1.1 Description

When a user submits a message, the extension host sends a chat:processing signal with state: "start" to the webview. The webview transitions to PROCESSING state: showing a spinner animation, displaying "working" text, and disabling the input textarea. When AI response completes or the user clicks Stop, the state resets to READY.

#### 3.1.2 Use Case: UC-01 — Display Spinner on Message Submission

**Use Case ID:** UC-01
**Actor:** User
**Preconditions:** Chat Panel is open, Input Area is in READY state, user has typed a message
**Postconditions:** Input Area is in PROCESSING state with spinner visible

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User presses Enter or clicks Send | | User submits the message |
| 2 | | Webview sends message to Extension Host via postMessage | Message forwarded to backend |
| 3 | | Extension Host sends chat:processing with state: "start" to Webview | Processing signal received |
| 4 | | Webview calls SpinnerController.startProcessing() | State transition: READY → PROCESSING |
| 5 | | Webview renders spinner + "working" text in Input Area | Visual indicator appears within 100ms |
| 6 | | Webview sets textarea disabled = true | Input disabled |
| 7 | | Webview announces "AI is processing" via aria-live region | Screen reader feedback |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | User submits empty message | System ignores submission, no state change |
| AF-02 | User is already in PROCESSING state | System ignores duplicate submission (idempotent) |
| AF-03 | prefers-reduced-motion is active | Show static dot instead of rotating spinner |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | postMessage communication fails | Spinner appears locally anyway (optimistic UI), timeout handles cleanup |
| EF-02 | Extension Host crashes during processing | 60s timeout triggers, spinner auto-hides, error shown in message area |

---

#### 3.1.3 Use Case: UC-02 — Hide Spinner on AI Completion

**Use Case ID:** UC-02
**Actor:** System (AI Backend)
**Preconditions:** Input Area is in PROCESSING state, AI is streaming tokens
**Postconditions:** Input Area returns to READY state

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | AI Backend sends final token / done signal to Extension Host | Response complete |
| 2 | | Extension Host sends chat:processing with state: "stop" to Webview | Completion signal received |
| 3 | | Webview calls SpinnerController.stopProcessing() | State transition: PROCESSING → READY |
| 4 | | Webview hides spinner + "working" text | Visual indicator removed |
| 5 | | Webview sets textarea disabled = false | Input re-enabled |
| 6 | | Webview restores original placeholder text | "Type a message..." placeholder returns |
| 7 | | Webview announces "AI response complete" via aria-live | Screen reader feedback |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Already in READY state when stop signal arrives | System ignores (idempotent) |
| AF-02 | Multiple stop signals received rapidly | Only first triggers transition, rest ignored |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Stop signal never arrives (network/backend failure) | 60s timeout triggers auto-reset to READY state |
| EF-02 | Stream interrupted mid-response | Extension Host detects disconnect, sends stop signal, partial response remains visible |

---

#### 3.1.4 Use Case: UC-03 — Hide Spinner on Stop Button Click

**Use Case ID:** UC-03
**Actor:** User
**Preconditions:** Input Area is in PROCESSING state, Stop button is visible
**Postconditions:** Input Area returns to READY state, cancellation signal sent to backend

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | User clicks Stop button | | User cancels AI processing |
| 2 | | Webview immediately calls SpinnerController.stopProcessing() | Optimistic UI reset (within 50ms) |
| 3 | | Webview hides spinner + "working" text | Visual indicator removed |
| 4 | | Webview sets textarea disabled = false | Input re-enabled |
| 5 | | Webview sends cancellation signal to Extension Host via postMessage | Backend notified |
| 6 | | Extension Host cancels AI request | Backend stops processing |
| 7 | | Partial AI response (if any) remains visible in message area | No content lost |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Stop clicked when already in READY state | System ignores (no-op) |
| AF-02 | Stop clicked multiple times rapidly | Idempotent — first click resets, subsequent ignored |
| AF-03 | Stop clicked while stop signal already in flight | No duplicate signals sent |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Cancellation signal fails to reach Extension Host | UI still resets (optimistic), any late-arriving tokens silently discarded |

---

#### 3.1.5 Use Case: UC-04 — Timeout Auto-Reset

**Use Case ID:** UC-04
**Actor:** System (Timer)
**Preconditions:** Input Area has been in PROCESSING state for 60 seconds
**Postconditions:** Input Area returns to READY state with timeout notification

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Timer reaches 60,000ms since PROCESSING state started | Timeout fires |
| 2 | | Webview calls SpinnerController.stopProcessing("timeout") | State transition: PROCESSING → READY |
| 3 | | Webview hides spinner + "working" text | Visual indicator removed |
| 4 | | Webview sets textarea disabled = false | Input re-enabled |
| 5 | | Webview displays timeout notification in message area | "Request timed out" message shown |
| 6 | | Webview announces "Request timed out" via aria-live | Screen reader feedback |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01 | Normal completion arrives just before timeout | Timer cancelled, normal flow takes precedence |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01 | Timer itself fails (unlikely in browser) | No additional fallback — user can always click Stop |

---

### 3.2 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | Spinner MUST appear within 100ms of message submission | BRD Story 1, AC-1 |
| BR-02 | Spinner MUST use CSS-only animation (no JS animation loops) | BRD Story 1, AC-2 |
| BR-03 | Input textarea MUST be disabled during PROCESSING state | BRD Story 1 |
| BR-04 | Stop button click MUST reset UI within 50ms (optimistic, no backend wait) | BRD Story 3, AC-1 |
| BR-05 | Spinner MUST auto-hide after 60 seconds maximum | BRD Story 2, Error Handling |
| BR-06 | All colors MUST use VS Code CSS variables (no hardcoded hex) | BRD Story 4, AC-3 |
| BR-07 | Animation MUST respect prefers-reduced-motion (static dot fallback) | BRD NFR Accessibility |
| BR-08 | State transitions MUST be idempotent (duplicate signals = no-op) | BRD Story 3, Validation Rules |
| BR-09 | Spinner MUST NOT cause layout shift in Chat Panel | BRD Story 1, Validation Rules |
| BR-10 | Spinner size MUST be 12-14px diameter | BRD Story 4, AC-4 |
| BR-11 | "working" text font size MUST be 11px | User requirement |
| BR-12 | Animation uses GPU-accelerated CSS transform: rotate() | BRD Story 4, Validation Rules |

---

### 3.3 UI Specifications

**Screen: Chat Panel — Input Area (Processing State)**

| No. | Element | Type | CSS Class | Behavior | Validation |
|-----|---------|------|-----------|----------|------------|
| 1 | Spinner Container | <div> | .spinner-container | Visible when isProcessing=true, hidden otherwise | Must not cause layout shift |
| 2 | Spinner Circle | <div> | .spinner-icon | Rotates 360° continuously via CSS @keyframes | 12-14px, border-based circle |
| 3 | Working Text | <span> | .spinner-text | Shows "working" text next to spinner | 11px, muted color |
| 4 | Input Textarea | <textarea> | .chat-input | disabled=true during PROCESSING | Placeholder hidden when spinner visible |
| 5 | SR Announcement | <div> | .sr-only | aria-live="polite" announces state changes | Hidden visually, accessible to screen readers |

**CSS Variables Used:**

| Variable | Purpose | Fallback |
|----------|---------|----------|
| --vscode-descriptionForeground | Spinner border color + working text color | #717171 |
| --vscode-progressBar-background | Spinner active arc color | #0078d4 |
| --vscode-input-background | Input background when disabled | #1e1e1e |
| --vscode-input-foreground | Input text color | #cccccc |

**CSS Animation Specification:**

`css
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.spinner-icon {
  width: 14px;
  height: 14px;
  border: 2px solid var(--vscode-descriptionForeground);
  border-top-color: var(--vscode-progressBar-background);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .spinner-icon {
    animation: none;
    border: none;
    width: 8px;
    height: 8px;
    background-color: var(--vscode-progressBar-background);
    border-radius: 50%;
  }
}
`

---

### 3.4 postMessage Protocol Extension

**New Message Types (Extension Host → Webview):**

| Message Type | Payload | Direction | Description |
|-------------|---------|-----------|-------------|
| chat:processing | { state: "start" \| "stop", reason?: string } | Host → Webview | Signals processing state change |

**Integration with Existing Protocol:**

The existing streaming protocol already handles:
- chat:message — user message sent to AI
- chat:stream-token — individual tokens from AI response
- chat:stream-end — final token / response complete
- chat:cancel — user clicks Stop

**New signal mapping:**

| Existing Event | New Action |
|---------------|-----------|
| After chat:message sent | Extension Host emits chat:processing { state: "start" } |
| On chat:stream-end received | Extension Host emits chat:processing { state: "stop" } |
| On chat:cancel sent by user | Webview immediately resets locally (no wait for host confirmation) |
| On error/disconnect | Extension Host emits chat:processing { state: "stop", reason: "error" } |

**TypeScript Interface Addition to src/shared/protocol.ts:**

`	ypescript
// Processing state signal (Extension Host → Webview)
export interface ChatProcessingSignal {
  type: 'chat:processing';
  state: 'start' | 'stop';
  reason?: 'complete' | 'cancelled' | 'error' | 'timeout';
}
`

---

## 4. Data Model

### 4.1 State Machine

![State — Spinner](diagrams/state-spinner.png)
*[Edit in draw.io](diagrams/state-spinner.drawio)*

**States:**

| State | Description | UI Appearance |
|-------|-------------|---------------|
| READY | Default idle state — user can type | Textarea enabled, placeholder visible, no spinner |
| PROCESSING | AI is working on response | Textarea disabled, spinner rotating, "working" text visible |

**Transitions:**

| From | To | Trigger | Guard | Action |
|------|-----|---------|-------|--------|
| READY | PROCESSING | chat:processing { state: "start" } | isProcessing === false | Show spinner, disable input, start timeout |
| PROCESSING | READY | chat:processing { state: "stop" } | isProcessing === true | Hide spinner, enable input, clear timeout |
| PROCESSING | READY | Stop button clicked | isProcessing === true | Hide spinner, enable input, clear timeout, send cancel |
| PROCESSING | READY | Timeout (60s elapsed) | isProcessing === true | Hide spinner, enable input, show timeout message |

### 4.2 TypeScript Interfaces

`	ypescript
/** Spinner state managed in webview */
export interface SpinnerState {
  /** Whether AI is currently processing */
  isProcessing: boolean;
  /** Timestamp when processing started (for timeout calculation) */
  startedAt: number | null;
  /** Timeout timer ID */
  timeoutId: ReturnType<typeof setTimeout> | null;
}

/** Initial state */
export const INITIAL_SPINNER_STATE: SpinnerState = {
  isProcessing: false,
  startedAt: null,
  timeoutId: null,
};

/** Configuration constants */
export const SPINNER_CONFIG = {
  /** Maximum time spinner can display (ms) */
  TIMEOUT_MS: 60_000,
  /** Maximum acceptable delay for spinner to appear (ms) */
  MAX_SHOW_DELAY_MS: 100,
  /** Maximum acceptable delay for stop button reset (ms) */
  MAX_STOP_DELAY_MS: 50,
  /** Animation duration per rotation (ms) */
  ANIMATION_DURATION_MS: 1000,
  /** Spinner diameter (px) */
  SPINNER_SIZE_PX: 14,
  /** Working text font size (px) */
  TEXT_SIZE_PX: 11,
} as const;
`

---

## 5. Integration Specifications

### 5.1 External System: VS Code Extension Host

| Attribute | Value |
|-----------|-------|
| Purpose | Coordinates AI request lifecycle and signals processing state to webview |
| Direction | Bidirectional (postMessage) |
| Data Format | JSON (serialized via VS Code webview API) |
| Frequency | Real-time (event-driven) |

**Data Exchange:**

| Webview Data | Extension Host Data | Direction | Business Rule |
|-------------|-------------------|-----------|---------------|
| User message text | chat:message payload | Webview → Host | Triggers processing start |
| — | chat:processing { state } | Host → Webview | BR-01: within 100ms |
| Cancel signal | chat:cancel | Webview → Host | BR-04: optimistic reset |
| — | chat:stream-end | Host → Webview | Triggers processing stop |

### 5.2 External System: AI Backend (LLM)

| Attribute | Value |
|-----------|-------|
| Purpose | Processes user messages and streams response tokens |
| Direction | Inbound (tokens flow from AI to Extension Host) |
| Data Format | Token stream (proprietary protocol via Extension Host) |
| Frequency | Streaming (real-time during response generation) |

**Note:** The webview does NOT communicate directly with the AI Backend. All communication is mediated by the Extension Host. The spinner feature only needs the chat:processing signal from the Extension Host.

---

## 6. Processing Logic

### 6.1 Process: Start Processing

**Trigger:** chat:processing { state: "start" } message received from Extension Host
**Input:** ChatProcessingSignal
**Output:** UI state change (spinner visible, input disabled)

**Pseudocode:**

`	ypescript
function startProcessing(): void {
  // Guard: already processing → no-op (BR-08)
  if (state.isProcessing) return;

  // Transition state
  state.isProcessing = true;
  state.startedAt = Date.now();

  // Start timeout timer (BR-05)
  state.timeoutId = setTimeout(() => {
    stopProcessing('timeout');
    showTimeoutMessage();
  }, SPINNER_CONFIG.TIMEOUT_MS);

  // Update UI
  spinnerContainer.classList.add('visible');
  textarea.disabled = true;
  textarea.placeholder = '';

  // Accessibility (BRD NFR)
  announce('AI is processing your request');
}
`

### 6.2 Process: Stop Processing

**Trigger:** chat:processing { state: "stop" } OR Stop button click OR Timeout
**Input:** reason: 'complete' | 'cancelled' | 'error' | 'timeout'
**Output:** UI state change (spinner hidden, input enabled)

**Pseudocode:**

`	ypescript
function stopProcessing(reason: string = 'complete'): void {
  // Guard: not processing → no-op (BR-08)
  if (!state.isProcessing) return;

  // Clear timeout
  if (state.timeoutId) {
    clearTimeout(state.timeoutId);
    state.timeoutId = null;
  }

  // Transition state
  state.isProcessing = false;
  state.startedAt = null;

  // Update UI
  spinnerContainer.classList.remove('visible');
  textarea.disabled = false;
  textarea.placeholder = 'Type a message...';
  textarea.focus();

  // Accessibility
  const message = reason === 'timeout'
    ? 'Request timed out'
    : reason === 'error'
    ? 'An error occurred'
    : 'AI response complete';
  announce(message);
}
`

### 6.3 Process: Handle Stop Button Click

**Trigger:** User clicks Stop button
**Input:** Click event
**Output:** Immediate UI reset + cancellation signal to Extension Host

**Pseudocode:**

`	ypescript
function handleStopClick(): void {
  // Optimistic UI reset (BR-04: within 50ms)
  stopProcessing('cancelled');

  // Send cancellation to Extension Host
  vscode.postMessage({ type: 'chat:cancel' });
}
`

### 6.4 Process: Message Listener Setup

**Trigger:** Webview initialization
**Input:** N/A
**Output:** Event listener registered

**Pseudocode:**

`	ypescript
function setupMessageListener(): void {
  window.addEventListener('message', (event) => {
    const message = event.data;

    if (message.type === 'chat:processing') {
      if (message.state === 'start') {
        startProcessing();
      } else if (message.state === 'stop') {
        stopProcessing(message.reason ?? 'complete');
      }
    }
  });
}
`

---

## 7. Security Requirements

### 7.1 Authentication & Authorization

Not applicable — the spinner is a UI-only feature within the VS Code extension webview. No authentication or authorization is required beyond VS Code's built-in extension security model.

### 7.2 Data Sensitivity Classification

| Data Type | Classification | Business Requirement |
|-----------|---------------|---------------------|
| isProcessing boolean | Public | No sensitive data involved |
| User message content | Internal | Already handled by existing Chat Panel security — not modified by this feature |

### 7.3 Content Security Policy

The spinner uses only CSS animations. No inline scripts, external resources, or eval() are required. The existing webview CSP remains unchanged.

---

## 8. Non-Functional Requirements

| Category | Business Requirement | Acceptance Criteria |
|----------|---------------------|---------------------|
| Performance | Spinner appears quickly after submission | ≤100ms from submission event to spinner visible (BR-01) |
| Performance | Stop resets instantly | ≤50ms from Stop click to UI reset (BR-04) |
| Performance | Smooth animation | 60fps CSS animation, no frame drops |
| Performance | Minimal CPU | GPU-accelerated transform: rotate() only (BR-12) |
| Accessibility | Screen reader support | aria-live announces "AI is processing" / "AI response complete" |
| Accessibility | Reduced motion | prefers-reduced-motion shows static dot (BR-07) |
| Reliability | No infinite spinner | 60s timeout auto-reset (BR-05) |
| Compatibility | VS Code versions | VS Code 1.85+ |
| Maintainability | CSS-only rendering | No JS animation frames for visual rendering |
| Testability | State inspectable | SpinnerController exposes getState() for testing |

---

## 9. Error Handling (User-Facing)

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Expected Behavior |
|----------|----------|-------------|-------------------|
| AI response never arrives | Warning | "Request timed out. Please try again." | Spinner auto-hides after 60s, input re-enabled |
| Network disconnection during processing | Warning | "Connection lost. Please check your network." | Extension Host detects, sends stop signal with reason "error" |
| Message submission fails | Warning | "Failed to send message. Please try again." | Spinner hides immediately, error shown in message area |
| Extension Host crash | Critical | "Extension error. Please reload window." | 60s timeout triggers, user can manually reload |
| Multiple rapid submissions | Info | — (silent) | Idempotent: duplicate start signals ignored (BR-08) |

### 9.2 Notification Requirements

| Event | Who is Notified | Channel | Timing |
|-------|----------------|---------|--------|
| Timeout reached | User | In-app message in Chat Panel message area | Immediate (at 60s) |
| Network error | User | In-app message in Chat Panel message area | When Extension Host detects |
| Processing started | Screen reader user | aria-live region | Immediate |
| Processing complete | Screen reader user | aria-live region | Immediate |

---

## 10. Testing Considerations

### 10.1 Test Scenarios

| ID | Scenario | Input | Expected Output | Priority |
|----|----------|-------|-----------------|----------|
| TC-01 | Spinner shows on submit | Send message | Spinner visible within 100ms, input disabled | High |
| TC-02 | Spinner hides on completion | AI response completes | Spinner hidden, input enabled, placeholder restored | High |
| TC-03 | Spinner hides on Stop click | Click Stop during processing | Spinner hidden within 50ms, input enabled | High |
| TC-04 | Timeout fires at 60s | Wait 60s without response | Spinner hidden, timeout message shown | High |
| TC-05 | Idempotent start | Send two start signals | Only one spinner shown, no error | Medium |
| TC-06 | Idempotent stop | Send stop when already READY | No error, no UI change | Medium |
| TC-07 | Reduced motion | Enable prefers-reduced-motion | Static dot shown instead of rotating spinner | Medium |
| TC-08 | Dark theme styling | Standard dark theme | Spinner uses CSS variables, visible against dark bg | Medium |
| TC-09 | Light theme styling | Light theme | Spinner uses CSS variables, visible against light bg | Low |
| TC-10 | Screen reader announces | Submit message | "AI is processing" announced | Medium |
| TC-11 | Screen reader on complete | AI completes | "AI response complete" announced | Medium |
| TC-12 | No layout shift | Toggle spinner on/off | No CLS (Cumulative Layout Shift) | Medium |
| TC-13 | Rapid submit-stop cycle | Submit then immediately Stop | Clean state, no race condition | High |
| TC-14 | Stop during streaming | AI streaming tokens, click Stop | Spinner hides, partial response visible | High |

---

## 11. Appendix

### Sequence Diagram — Message Submit Flow

![Sequence — Submit](diagrams/sequence-submit.png)
*[Edit in draw.io](diagrams/sequence-submit.drawio)*

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | State — Spinner | [state-spinner.png](diagrams/state-spinner.png) | [state-spinner.drawio](diagrams/state-spinner.drawio) |
| 3 | Sequence — Submit | [sequence-submit.png](diagrams/sequence-submit.png) | [sequence-submit.drawio](diagrams/sequence-submit.drawio) |

### Change Log from BRD

- BRD specified "12-16px" spinner size → FSD narrows to 14px for consistency
- BRD mentioned "rotating or pulsing" → FSD selects rotating spinner (simpler, more standard)
- Added explicit postMessage protocol type chat:processing not in BRD (implementation detail)
- Added SpinnerController state machine pattern (modeled after existing ContextMenuController)
- Added explicit pseudocode for all state transitions
