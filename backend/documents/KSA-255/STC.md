# Software Test Cases (STC)

## Kiro SDLC Extension — KSA-255: Chat Panel Spinner + Working Indicator

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-255 |
| Title | Chat Panel: Spinner + Working Indicator |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2026-06-17 |
| Status | Final |
| Related STP | STP-v1-KSA-255.docx |

---

## 1. PBT — Property-Based Tests

| ID | Property | Generator | Assertions |
|----|----------|-----------|------------|
| PBT-01 | Idempotent transitions | Random sequence of start/stop signals | State matches last unique signal |
| PBT-02 | State machine always in valid state | Random signal sequences (100+) | state is always 'idle' or 'processing' |
| PBT-03 | View sync with controller | Random transitions | DOM visibility matches controller state |
| PBT-04 | No DOM leaks | Random show/hide cycles (1000+) | Only 0 or 1 spinner element in DOM |

---

## 2. UT — Unit Tests

| ID | Component | Test | Expected |
|----|-----------|------|----------|
| TC-01 | SpinnerController | Receive start signal from idle | State → processing |
| TC-02 | SpinnerController | Receive start signal when already processing | No-op (idempotent) |
| TC-03 | SpinnerController | Receive stop signal from processing | State → idle |
| TC-04 | SpinnerController | Receive stop signal when already idle | No-op (idempotent) |
| TC-05 | InputIntegration | Processing starts | Input textarea disabled, placeholder changes |
| TC-06 | InputIntegration | Processing ends | Input textarea enabled, placeholder restored |
| TC-07 | SpinnerView | Show spinner | DOM element created with animation class |
| TC-08 | SpinnerView | CSS animation class | Uses @keyframes, no requestAnimationFrame |
| TC-09 | SpinnerController | Rapid start/stop/start | Final state = processing |
| TC-10 | SpinnerView | Dark theme | Uses var(--vscode-*) CSS variables |
| TC-11 | SpinnerView | Light theme | Spinner visible against light background |
| TC-12 | SpinnerView | ARIA live region | aria-live="polite" on spinner container |
| TC-13 | SpinnerView | Screen reader text | "AI is processing..." announced |
| TC-14 | SpinnerView | Hide spinner | DOM element removed or display:none |
| TC-15 | SpinnerView | Dispose cleanup | All event listeners removed |

---

## 3. IT — Integration Tests

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| TC-16 | postMessage triggers spinner | 1. Dispatch chat:processing(true) 2. Verify spinner visible | Spinner shown, input disabled |
| TC-17 | postMessage hides spinner | 1. Show spinner 2. Dispatch chat:processing(false) | Spinner hidden, input enabled |
| TC-18 | Full chat flow | 1. User sends msg 2. processing(true) 3. Response streams 4. processing(false) | Spinner shows during, hides after |
| TC-19 | Abort cancels spinner | 1. processing(true) 2. User clicks Stop 3. Verify | Spinner hidden, input re-enabled |

---

## 4. E2E-UI — Manual Tests

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| E2E-01 | Spinner visible during AI response | Send message, observe input area | Spinner appears with "Working..." text |
| E2E-02 | Spinner disappears after response | Wait for response to complete | Spinner gone, input re-enabled |
| E2E-03 | Animation smooth | Observe spinner rotation | 60fps, no jank |
| E2E-04 | Cancel stops spinner | Click Stop during processing | Immediate spinner removal |
| E2E-05 | Theme switch | Change theme during processing | Spinner colors update |

---

## 5. SIT — Manual

| ID | Scenario | Type |
|----|----------|------|
| SIT-01 | Spinner visual in dark theme | Visual |
| SIT-02 | Spinner visual in light theme | Visual |
| SIT-03 | Spinner visual in high-contrast | Visual |
| SIT-04 | Animation performance (no frame drops) | Performance |
| SIT-05 | Screen reader announces processing state | A11y |
