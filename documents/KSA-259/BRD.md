# Business Requirements Document (BRD)

## Chatbox UI — KSA-259: Chat Panel: Interactive Options on Input Area when AI asks questions

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
| Architecture Pattern | Plugin (VS Code Extension) |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | TA Agent – Technical Analyst | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-25 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-259 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This document defines the business requirements for the **Interactive Options** feature on the Chat Panel Input Area. When the AI asks the user a question with predefined options (e.g., select a workflow, confirm an action, choose between alternatives), the Input Area SHALL display clickable option buttons above the textarea, allowing the user to respond with a single click.

This behavior mirrors the Kiro IDE native chat panel UX. The feature is part of the Chatbox UI VS Code extension (webview-based) and follows the Plugin architecture pattern. Options are delivered via postMessage from Extension Host and responses are sent back via postMessage.

### 1.2 Out of Scope

- AI response generation logic (determining when to present options)
- Multi-select options (only single-select supported)
- Rich media options (images, icons within buttons)
- Option button persistence across panel reloads
- Nested/hierarchical option menus
- Option timeout/expiry logic

### 1.3 Preliminary Requirement

- Chat Panel Foundation must be implemented (KSA-210 — Done)
- Spinner/Working Indicator must be implemented (KSA-255 — Done) for state coordination
- postMessage communication layer must be established
- Extension Host must be capable of emitting `chat:userInput` messages with options array

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Interactive Options feature provides quick-response buttons when AI asks a question:

1. AI generates a response that includes a question with predefined options
2. Extension Host sends `chat:userInput` message to webview with question text and options array
3. Input Area displays clickable option buttons above the textarea
4. User either clicks an option button OR types a custom response in textarea
5. Chat Panel sends `chat:userResponse` back to Extension Host with the selected/typed text
6. Option buttons disappear immediately after selection

![Business Flow](diagrams/business-flow.png)
*[Edit in draw.io](diagrams/business-flow.drawio)*

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | Display Option Buttons when AI asks a question | MUST HAVE | KSA-259 |
| 2 | Select Option by Click | MUST HAVE | KSA-259 |
| 3 | Type Custom Response instead of clicking option | MUST HAVE | KSA-259 |
| 4 | Keyboard Navigation between Options | SHOULD HAVE | KSA-259 |
| 5 | Dark Theme Consistent Styling | MUST HAVE | KSA-259 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** AI responds with a question that includes predefined options (e.g., "Which workflow do you want? [Spec-driven, Manual, Auto]")

**Step 2:** Extension Host parses the AI response and sends `chat:userInput { question, options[] }` to webview via postMessage

**Step 3:** Input Area renders option buttons above the textarea. Buttons wrap to multiple rows if they don't fit in one line.

**Step 4:** User interaction — one of two paths:
- **Path A (Click):** User clicks an option button → that option text is sent as response
- **Path B (Type):** User types a custom response in textarea and presses Enter → typed text is sent as response

**Step 5:** After selection (click or Enter), Chat Panel sends `chat:userResponse { response, fromOption }` to Extension Host

**Step 6:** Option buttons disappear immediately after any response is submitted

> **Note:** While options are displayed, the textarea remains fully editable. Options are a convenience, not a constraint.

---

#### STORY 1: Display Option Buttons when AI asks a question

> As a user, I want to see clickable option buttons above the textarea when AI asks me a question, so that I can quickly respond without typing.

**Requirement Details:**

1. When Extension Host sends `chat:userInput` with an options array, the Input Area SHALL display option buttons above the textarea
2. Each button SHALL display the option text clearly with adequate padding
3. The Input Area SHALL support displaying 2-5 option buttons simultaneously
4. Buttons SHALL wrap to next row if they don't fit in one line
5. Buttons appear with no perceptible delay (within 100ms of message receipt)

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Options Container | div | Yes | Flexbox container above textarea, wraps buttons | flex-wrap: wrap, gap: 6px |
| 2 | Option Button | button | Yes | Clickable button with option text | Padding: 4px 12px, border-radius: 4px |
| 3 | Question Label | span | No | Optional question text above buttons | Muted color, 11px font |

**Acceptance Criteria:**

1. WHEN AI sends a question with predefined options, THE Input_Area SHALL display clickable option buttons above the textarea
2. EACH option button SHALL display the option text clearly with adequate padding
6. THE Input_Area SHALL support displaying 2-5 option buttons simultaneously

---

#### STORY 2: Select Option by Click

> As a user, I want to click an option button to send that option as my response, so that I can respond quickly to AI questions.

**Requirement Details:**

1. When user clicks an option button, the Chat Panel SHALL send that option text as the user's response message
2. The response message SHALL include metadata indicating it came from an option click (`fromOption: true`)
3. After clicking, ALL option buttons SHALL disappear immediately (within 1 frame ~16ms)
4. The clicked option text SHALL appear in the chat history as a user message

**Acceptance Criteria:**

3. WHEN user clicks an option button, THE Chat_Panel SHALL send that option text as the user's response message
4. AFTER an option is selected, THE option buttons SHALL disappear immediately

---

#### STORY 3: Type Custom Response instead of clicking option

> As a user, I want to still type a custom response in the textarea even when options are displayed, so that I have full flexibility in my response.

**Requirement Details:**

1. While options are displayed, the textarea SHALL remain fully editable
2. User can type any text and press Enter to submit as their response
3. When a typed response is submitted, option buttons disappear immediately
4. The typed response SHALL include metadata `fromOption: false`
5. Options do NOT constrain user input — they are a convenience shortcut

**Acceptance Criteria:**

5. WHILE options are displayed, THE user SHALL still be able to type a custom response in the textarea instead

---

#### STORY 4: Keyboard Navigation between Options

> As a user, I want to navigate between option buttons using Tab and select with Enter, so that I can interact without a mouse.

**Requirement Details:**

1. User SHALL be able to Tab between option buttons
2. Focused option button SHALL have visible focus indicator (outline/ring)
3. Pressing Enter on a focused button SHALL select that option
4. Tab order: option buttons left-to-right, then textarea
5. Escape key SHALL dismiss options and return focus to textarea

**Acceptance Criteria:**

- WHEN user presses Tab, focus SHALL move between option buttons
- WHEN user presses Enter on a focused option, THAT option SHALL be selected

---

#### STORY 5: Dark Theme Consistent Styling

> As a user, I want the option buttons to be styled consistently with the Kiro IDE dark theme, so that the UI feels cohesive.

**Requirement Details:**

1. Option buttons SHALL use dark theme colors: dark background with subtle border
2. Hover state SHALL show purple/magenta accent highlight
3. Active/pressed state SHALL show darker background
4. Focus state SHALL show visible ring using theme accent color
5. All colors SHALL use VS Code CSS custom properties

**Acceptance Criteria:**

7. THE option buttons SHALL be styled consistently with Kiro IDE (dark theme, purple/magenta accent)

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Chat Panel Foundation | System | KSA-210 (Done) | Panel layout, Input Area, Send button, Stop button |
| Spinner/Working Indicator | System | KSA-255 (Done) | State coordination — options should not display during PROCESSING state |
| VS Code Webview API | Infrastructure | N/A | postMessage protocol for extension-webview communication |
| Extension Host AI Integration | System | N/A | Must emit chat:userInput when AI asks questions |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Product Owner | Development Team Lead | Approve requirements, UAT | Ticket creator |
| Developer | Frontend Developer | Implement options UI + state management | Assignee |
| QA Engineer | QA Team | Test all acceptance criteria | Ticket watcher |
| UX Designer | Design Team | Validate visual consistency with Kiro IDE | Reviewer |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Options overlap with spinner when both triggered | Medium | Low | State guard: options hidden during PROCESSING state |
| Long option text causes layout overflow | Medium | Medium | Truncate with ellipsis at max-width, tooltip for full text |
| Race condition: user types while option click in progress | Low | Low | Debounce and single-response guard |
| Theme variable unavailability | Low | Low | Fallback hardcoded dark theme colors |
| >5 options causes UI clutter | Medium | Low | Cap at 5 buttons max, truncate remaining |

### 5.2 Assumptions

- Extension Host reliably delivers `chat:userInput` messages with valid options array
- Options array always contains 2-5 string items
- The AI backend determines when to present options (not the webview)
- Options are single-select only (one click = one response)
- Options are transient — they don't persist after panel reload
- The spinner feature (KSA-255) manages its own state independently; options and spinner don't overlap

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Option display latency | Buttons must appear within 100ms of message receipt |
| Performance | Option disappear latency | Buttons must disappear within 1 frame (16ms) of selection |
| Accessibility | Keyboard navigation | Tab between buttons, Enter to select, Escape to dismiss |
| Accessibility | Screen reader | aria-label on each button, aria-live region for question announcement |
| Compatibility | VS Code versions | VS Code 1.85+ |
| Visual | Theme consistency | Use VS Code CSS custom properties, Kiro purple/magenta accent |
| Reliability | State guard | Options not shown during PROCESSING state (spinner active) |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-259 | Chat Panel: Interactive Options on Input Area when AI asks questions | To Do | Task | Main ticket |
| KSA-210 | Chat Panel Foundation | Done | Task | Dependency (provides Input Area) |
| KSA-255 | Spinner + Working Indicator | Done | Task | Dependency (state coordination) |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Input_Area | The textarea/input field at the bottom of the Chat Panel |
| Option Button | A clickable button displaying a predefined response option |
| postMessage | VS Code API for bidirectional webview ↔ extension host communication |
| chat:userInput | Message type from Extension Host containing question + options |
| chat:userResponse | Message type from Webview containing user's selected/typed response |
| fromOption | Boolean metadata indicating whether response came from button click (true) or typed text (false) |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| Chatbox UI Spec | .kiro/specs/chatbox-ui/requirements.md |
| Shared Protocol Types | src/shared/protocol.ts |
| KSA-255 BRD (reference) | documents/KSA-255/BRD.md |
| VS Code Webview API | https://code.visualstudio.com/api/extension-guides/webview |

### Use Case Diagram

![Use Case Diagram](diagrams/use-case.png)
*[Edit in draw.io](diagrams/use-case.drawio)*

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
