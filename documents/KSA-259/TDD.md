# Technical Design Document (TDD)

## Kiro SDLC Extension - KSA-259: Chat Panel Interactive Options

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-259 |
| Title | Chat Panel: Interactive Options on Input Area when AI asks questions |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-07-25 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-259.docx |
| Related FSD | FSD-v1-KSA-259.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-25 | SA Agent | Initiate document from BRD and FSD |

---

## 1. Introduction

### 1.1 Purpose

This TDD specifies how to implement the Interactive Options feature for the Chat Panel. It covers component architecture, TypeScript class design, state management, keyboard handling, and integration with SpinnerController (KSA-255).

### 1.2 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.x |
| UI | Vanilla DOM (VS Code Webview) | N/A |
| Build | esbuild | latest |
| Host API | VS Code Webview API | 1.85+ |
| Testing | Vitest + jsdom | latest |

### 1.3 Design Principles

- Single Responsibility: OptionsController manages only options state
- Observer Pattern: subscribe to SpinnerController state changes
- Defensive: idempotent transitions, guard clauses
- Minimal DOM: batch operations, event delegation

### 1.4 Constraints

- VS Code webview sandbox (postMessage only)
- CSS must use VS Code theme variables
- Bundle impact < 5KB gzipped

---

## 2. System Architecture

### 2.1 Architecture Overview

![Architecture Diagram](diagrams/architecture.png)
*[Edit in draw.io](diagrams/architecture.drawio)*

The feature adds OptionsController to the webview layer:

- Webview / ChatPanel / InputArea / OptionsContainer (NEW)
- Controllers / OptionsController (NEW) + SpinnerController (existing)
- MessageRouter dispatches chat:options to OptionsController

### 2.2 Component Diagram

![Component Diagram](diagrams/component.png)
*[Edit in draw.io](diagrams/component.drawio)*

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| OptionsController | State management, event coordination | TypeScript |
| OptionsView | DOM rendering of buttons | DOM API |
| KeyboardHandler | Tab/Enter/Escape | addEventListener |
| MessageRouter | Routes postMessage | switch on type |

### 2.3 Communication Patterns

| From | To | Protocol | Pattern |
|------|----|----------|---------|
| Extension Host | Webview | postMessage | Async event |
| Webview | Extension Host | postMessage | Async event |
| SpinnerController | OptionsController | Callback | Observer |
| OptionsController | OptionsView | Direct call | Sync |

---

## 3. API Design

### 3.1 Message: chat:options (Inbound)

`	ypescript
interface ChatOptionsSignal {
  type: 'chat:options';
  options: string[];    // 1-5 items
  question?: string;
}
`

Validation: options must be array with 1-5 non-empty strings (max 100 chars each).

### 3.2 Message: chat:response (Outbound)

`	ypescript
interface ChatResponseMessage {
  type: 'chat:response';
  text: string;
  source: 'option-click' | 'text-input';
}
`

---

## 4. Class / Module Design

### 4.1 Package Structure

`
src/webview/options/
  OptionsController.ts
  OptionsView.ts
  options.css
  options.test.ts
src/shared/protocol.ts (existing - already has interfaces)
`

### 4.2 OptionsController

`	ypescript
export class OptionsController {
  private state: OptionsState;
  private view: OptionsView;
  private spinnerController: SpinnerController;

  constructor(container: HTMLElement, spinnerCtrl: SpinnerController);
  handleOptionsSignal(signal: ChatOptionsSignal): void;
  selectOption(text: string): void;
  handleCustomSubmit(text: string): void;
  dismiss(): void;
  getState(): OptionsState;
}
`

### 4.3 OptionsView

`	ypescript
export class OptionsView {
  constructor(container: HTMLElement);
  render(options: string[], question?: string): void;
  hide(): void;
  onSelect(cb: (text: string) => void): void;
}
`

### 4.4 Design Patterns

| Pattern | Where | Rationale |
|---------|-------|-----------|
| Observer | Spinner -> Options | Loose coupling |
| MVC | Controller + View | Testability |
| Event Delegation | Container click handler | Performance (1 listener) |
| Guard Clause | All transitions | Idempotent |

---

## 5. Integration Design

### 5.1 SpinnerController Integration

OptionsController registers callback on SpinnerController:
- When isProcessing=true -> auto-dismiss options
- When isProcessing=false -> show pending options (if queued)

### 5.2 MessageRouter Integration

Add case in message-router.ts switch:
`	ypescript
case 'chat:options':
  optionsController.handleOptionsSignal(msg);
  break;
`

---

## 6. Security Design

- Use textContent (not innerHTML) for option text rendering -> prevents XSS
- No CSP changes needed
- No external network calls

---

## 7. Performance

| Operation | Target |
|-----------|--------|
| Render 5 buttons | < 50ms |
| Hide buttons | < 16ms (1 frame) |
| Memory | ~6 DOM nodes max |

Use DocumentFragment for batch creation, event delegation, classList for styling.

---

## 8. Implementation Checklist

| # | Task | File | Est. |
|---|------|------|------|
| 1 | Create OptionsController | src/webview/options/OptionsController.ts | 1h |
| 2 | Create OptionsView | src/webview/options/OptionsView.ts | 1h |
| 3 | Create options.css | src/webview/options/options.css | 30m |
| 4 | Register in MessageRouter | src/webview/message-router.ts | 15m |
| 5 | Wire SpinnerController observer | OptionsController.ts | 15m |
| 6 | Keyboard handling | OptionsController.ts | 45m |
| 7 | Unit tests | options.test.ts | 1h |
| 8 | Integration test | tests/integration/ | 30m |
| **Total** | | | **~5h** |

---

## 9. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
