# Technical Design Document (TDD)

## Kiro SDLC Extension — KSA-255: Chat Panel Spinner + Working Indicator

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-255 |
| Title | Chat Panel: Spinner + Working Indicator on Input Area during AI Processing |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-09 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-255.docx |
| Related FSD | FSD-v1-KSA-255.docx |
| Architecture Pattern | Plugin (VS Code Extension) |

---

## 1. Introduction

### 1.1 Purpose

This TDD defines the technical design for the Spinner + Working Indicator feature (KSA-255). It specifies class design, state machine implementation, CSS architecture, and integration points within the existing Chat Panel webview.

### 1.2 Scope

- SpinnerController state machine (2 states, 4 transitions)
- SpinnerView DOM rendering (spinner + text + show/hide)
- CSS animation with theme variable support
- postMessage protocol extension (ChatProcessingSignal)
- Integration with InputAreaIntegration

### 1.3 Design Principles

1. **Follow existing patterns** — mirror ContextMenuController/ContextMenuView separation (KSA-252)
2. **CSS-only animation** — no JS animation loops (BR-02)
3. **Idempotent transitions** — duplicate signals are no-ops (BR-08)
4. **Zero new dependencies** — uses only existing vitest + fast-check + jsdom

### 1.4 Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Language | TypeScript | 5.5+ |
| Test Runner | Vitest | 2.0+ |
| PBT Framework | fast-check | 3.23+ |
| DOM Testing | jsdom | 25.0+ |
| UI Runtime | VS Code Webview API | VS Code 1.85+ |
| Animation | CSS @keyframes | N/A |

---

## 2. System Architecture

### 2.1 Architecture Overview

![Architecture](diagrams/architecture.png)
*[Edit in draw.io](diagrams/architecture.drawio)*

The spinner feature follows the same Controller + View pattern established by KSA-252 (Context Menu):

`
Extension Host                         Webview (Chat Panel)
─────────────────                     ────────────────────────
                                      ┌─────────────────────────┐
 AI Backend ←→ Extension Host ──────→ │ InputAreaIntegration     │
              postMessage              │   ├─ SpinnerController   │
              chat:processing          │   │    (state machine)   │
                                      │   └─ SpinnerView         │
                                      │        (DOM rendering)   │
                                      └─────────────────────────┘
`

### 2.2 Component Responsibilities

| Component | Responsibility | Implements |
|-----------|---------------|------------|
| SpinnerController | State machine (READY↔PROCESSING), timeout management, accessibility announcements | UC-01 to UC-04, BR-01/04/05/08 |
| SpinnerView | DOM creation/destruction, CSS class toggling, textarea disable/enable | BR-02/06/09/10/11/12 |
| spinner.css | Animation keyframes, theme variables, reduced-motion fallback | BR-06/07/12 |
| types.ts | SpinnerState, SpinnerConfig interfaces | Data model |
| protocol.ts | ChatProcessingSignal type addition | FSD Section 3.4 |
| InputAreaIntegration | Wire spinner into existing message submit flow | UC-01 integration |

---

## 3. Module Structure

`
src/
├── shared/
│   └── protocol.ts              ← ADD ChatProcessingSignal type
├── webview/
│   ├── spinner/
│   │   ├── SpinnerController.ts ← State machine (READY↔PROCESSING)
│   │   ├── SpinnerView.ts       ← DOM rendering
│   │   ├── spinner.css          ← CSS animation + theme
│   │   └── types.ts             ← Interfaces + constants
│   ├── input/
│   │   └── InputAreaIntegration.ts ← MODIFY: wire spinner
│   └── __tests__/
│       ├── spinner.pbt.test.ts  ← Property-based tests
│       ├── spinner.unit.test.ts ← Unit tests
│       └── spinner.integration.test.ts ← Integration tests
`

---

## 4. Class/Module Design

### 4.1 types.ts — Interfaces & Constants

`	ypescript
/** Spinner processing states */
export type SpinnerState = 'READY' | 'PROCESSING';

/** Triggers that cause state transitions */
export type SpinnerTrigger = 'START' | 'STOP';

/** Reason for stopping */
export type StopReason = 'complete' | 'cancelled' | 'error' | 'timeout';

/** State transition definition */
export interface SpinnerTransition {
  from: SpinnerState;
  to: SpinnerState;
  trigger: SpinnerTrigger;
}

/** Runtime state managed by SpinnerController */
export interface SpinnerRuntimeState {
  isProcessing: boolean;
  startedAt: number | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

/** Configuration constants */
export const SPINNER_CONFIG = {
  TIMEOUT_MS: 60_000,
  MAX_SHOW_DELAY_MS: 100,
  MAX_STOP_DELAY_MS: 50,
  ANIMATION_DURATION_MS: 1000,
  SPINNER_SIZE_PX: 14,
  TEXT_SIZE_PX: 11,
} as const;

/** State transitions table */
export const SPINNER_TRANSITIONS: SpinnerTransition[] = [
  { from: 'READY', to: 'PROCESSING', trigger: 'START' },
  { from: 'PROCESSING', to: 'READY', trigger: 'STOP' },
];
`

### 4.2 SpinnerController.ts — State Machine

**Pattern:** Mirrors ContextMenuController (KSA-252) — explicit transition table, getState() for testability, announce() for accessibility.

`	ypescript
export class SpinnerController {
  private state: SpinnerState = 'READY';
  private runtimeState: SpinnerRuntimeState;
  private view: SpinnerView;
  private announcer: HTMLElement | null = null;
  private onTimeout?: () => void;

  constructor(view: SpinnerView, onTimeout?: () => void);

  // Public API
  getState(): SpinnerState;
  startProcessing(): void;     // READY → PROCESSING (idempotent)
  stopProcessing(reason?: StopReason): void;  // PROCESSING → READY (idempotent)
  dispose(): void;

  // Private
  private transition(trigger: SpinnerTrigger): boolean;
  private startTimeout(): void;
  private clearTimeout(): void;
  private setupAnnouncer(): void;
  private announce(message: string): void;
}
`

**Key behaviors:**
- startProcessing(): Guard isProcessing === true → return (BR-08). Otherwise transition, show view, start 60s timeout.
- stopProcessing(reason): Guard isProcessing === false → return (BR-08). Otherwise transition, hide view, clear timeout, announce reason.
- Timeout callback invokes stopProcessing('timeout') + calls onTimeout hook.

### 4.3 SpinnerView.ts — DOM Rendering

**Pattern:** Mirrors ContextMenuView (KSA-252) — constructor takes container, render/destroy methods.

`	ypescript
export class SpinnerView {
  private container: HTMLElement;
  private spinnerEl: HTMLElement | null = null;
  private textarea: HTMLTextAreaElement | HTMLElement;
  private originalPlaceholder: string;

  constructor(container: HTMLElement, textarea: HTMLTextAreaElement | HTMLElement);

  show(): void;   // Create spinner DOM, disable textarea
  hide(): void;   // Remove spinner DOM, enable textarea, restore placeholder
  isVisible(): boolean;
  getElement(): HTMLElement | null;
}
`

**DOM structure created by show():**
`html
<div class="spinner-container visible">
  <div class="spinner-icon"></div>
  <span class="spinner-text">working</span>
</div>
`

### 4.4 ChatProcessingSignal — Protocol Addition

`	ypescript
// Addition to src/shared/protocol.ts
export interface ChatProcessingSignal {
  type: 'chat:processing';
  state: 'start' | 'stop';
  reason?: 'complete' | 'cancelled' | 'error' | 'timeout';
}
`

### 4.5 InputAreaIntegration — Modification

Add spinner wiring to existing class:
- Import SpinnerController + SpinnerView
- Create instances in constructor
- Add window.addEventListener('message', ...) for chat:processing signals
- Add handleStopClick() method that calls spinnerController.stopProcessing('cancelled')

---

## 5. State Machine Design

### 5.1 States & Transitions

| From | To | Trigger | Guard | Side Effects |
|------|----|---------|-------|-------------|
| READY | PROCESSING | START | !isProcessing | view.show(), startTimeout(), announce("AI is processing") |
| PROCESSING | READY | STOP | isProcessing | view.hide(), clearTimeout(), announce(reason message) |

### 5.2 Invariants (for PBT)

1. **Only 2 states exist** — state is always 'READY' or 'PROCESSING'
2. **Idempotent transitions** — START when PROCESSING = no-op; STOP when READY = no-op
3. **Timeout guaranteed** — if in PROCESSING for 60s, auto-transitions to READY
4. **No invalid states** — undefined trigger+state combinations are rejected

---

## 6. CSS Design

### 6.1 spinner.css

`css
.spinner-container {
  display: none;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
}

.spinner-container.visible {
  display: flex;
}

.spinner-icon {
  width: 14px;
  height: 14px;
  border: 2px solid var(--vscode-descriptionForeground, #717171);
  border-top-color: var(--vscode-progressBar-background, #0078d4);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  flex-shrink: 0;
}

.spinner-text {
  font-size: 11px;
  color: var(--vscode-descriptionForeground, #717171);
  user-select: none;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .spinner-icon {
    animation: none;
    border: none;
    width: 8px;
    height: 8px;
    background-color: var(--vscode-progressBar-background, #0078d4);
    border-radius: 50%;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
`

### 6.2 Design Rationale

- **GPU-accelerated**: Uses 	ransform: rotate() only (BR-12)
- **No layout shift**: .spinner-container uses display: none/flex within existing Input Area flow (BR-09)
- **Theme variables**: All colors from VS Code CSS variables with fallbacks (BR-06)
- **Reduced motion**: Static dot fallback (BR-07)

---

## 7. Integration Design

### 7.1 Message Flow (Submit → Spinner → Complete)

1. User presses Enter → InputAreaIntegration sends chat:message via postMessage
2. Extension Host receives message, sends chat:processing { state: "start" } back
3. InputAreaIntegration message listener calls spinnerController.startProcessing()
4. AI streams tokens... Extension Host sends chat:stream-end
5. Extension Host sends chat:processing { state: "stop", reason: "complete" }
6. InputAreaIntegration calls spinnerController.stopProcessing("complete")

### 7.2 Stop Button Flow

1. User clicks Stop → InputAreaIntegration calls spinnerController.stopProcessing("cancelled") (optimistic)
2. InputAreaIntegration sends chat:cancel to Extension Host
3. Any late-arriving chat:processing { state: "stop" } is ignored (idempotent)

---

## 8. Security Design

Not applicable — UI-only feature within VS Code webview sandbox. No new authentication, authorization, or data exposure. Existing CSP remains unchanged.

---

## 9. Performance & Scalability

| Metric | Target | Mechanism |
|--------|--------|-----------|
| Spinner appear latency | ≤100ms (BR-01) | Synchronous DOM operation on message receipt |
| Stop reset latency | ≤50ms (BR-04) | Optimistic local reset, no backend wait |
| Animation FPS | 60fps | CSS-only animation, GPU compositing |
| CPU usage | ~0% | No JS animation loops, CSS handles rendering |
| Memory | <1KB | 3 DOM elements, 1 timer reference |

---

## 10. Error Handling

| Scenario | Handling | Implements |
|----------|----------|------------|
| Stop signal never arrives | 60s timeout auto-reset | UC-04, BR-05 |
| Duplicate start signals | Idempotent (no-op) | BR-08 |
| Duplicate stop signals | Idempotent (no-op) | BR-08 |
| Extension Host crash | Timeout handles cleanup | FSD EF-02 |
| postMessage failure | Optimistic UI (spinner shows locally regardless) | FSD EF-01 |

---

## 11. Implementation Checklist

| # | File | Action | LOC | Priority |
|---|------|--------|-----|----------|
| 1 | src/webview/spinner/types.ts | CREATE | ~25 | P0 |
| 2 | src/webview/spinner/SpinnerView.ts | CREATE | ~45 | P0 |
| 3 | src/webview/spinner/SpinnerController.ts | CREATE | ~70 | P0 |
| 4 | src/webview/spinner/spinner.css | CREATE | ~55 | P0 |
| 5 | src/shared/protocol.ts | MODIFY — add ChatProcessingSignal | +8 | P0 |
| 6 | src/webview/input/InputAreaIntegration.ts | MODIFY — wire spinner | +30 | P0 |
| 7 | src/webview/__tests__/spinner.pbt.test.ts | CREATE | ~80 | P1 |
| 8 | src/webview/__tests__/spinner.unit.test.ts | CREATE | ~120 | P1 |
| 9 | src/webview/__tests__/spinner.integration.test.ts | CREATE | ~100 | P1 |

---

## 12. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |

---

## Traceability Matrix

| FSD Requirement | TDD Section | Implementation File |
|----------------|-------------|---------------------|
| UC-01 (Display Spinner) | 4.2 SpinnerController.startProcessing() | SpinnerController.ts |
| UC-02 (Hide on Complete) | 4.2 SpinnerController.stopProcessing() | SpinnerController.ts |
| UC-03 (Hide on Stop) | 4.5 InputAreaIntegration.handleStopClick() | InputAreaIntegration.ts |
| UC-04 (Timeout) | 4.2 startTimeout() | SpinnerController.ts |
| BR-01 (100ms appear) | Section 9 Performance | Sync DOM operation |
| BR-02 (CSS-only) | Section 6 CSS Design | spinner.css |
| BR-05 (60s timeout) | 4.2 SPINNER_CONFIG.TIMEOUT_MS | types.ts |
| BR-06 (CSS variables) | 6.1 spinner.css | spinner.css |
| BR-07 (reduced motion) | 6.1 @media query | spinner.css |
| BR-08 (idempotent) | 5.1 Guards | SpinnerController.ts |
| BR-09 (no layout shift) | 6.2 display:none/flex | spinner.css |
| BR-10 (14px size) | 6.1 .spinner-icon | spinner.css |
| BR-11 (11px text) | 6.1 .spinner-text | spinner.css |
| BR-12 (GPU transform) | 6.1 @keyframes spin | spinner.css |
