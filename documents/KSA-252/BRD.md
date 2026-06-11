# Business Requirements Document (BRD)

## Chatbox UI — KSA-252: Context Menu ("#" Trigger)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-252 |
| Title | Context Menu ("#" Trigger) |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-06-15 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-252.docx |
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
| 1.0 | 2026-06-15 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-252 and chatbox-ui spec Requirement 13 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This document defines the business requirements for the **Context Menu** feature in the Chatbox UI component. The Context Menu is triggered by typing "#" in the Input Area, allowing users to quickly attach context sources (Files, Spec, Git Diff, Terminal, Problems, Folder, Current File, Steering, MCP) to their messages without leaving the input field.

This feature is part of the Chatbox UI VS Code extension (webview-based) and follows the Plugin architecture pattern. It interacts with the VS Code Extension Host via postMessage protocol to resolve context data.

### 1.2 Out of Scope

- Slash Command Menu ("/" trigger) — covered in separate ticket (Requirement 14)
- Model Selector dropdown — separate requirement
- Context Usage Panel display — separate requirement
- Actual AI processing of attached context — backend responsibility
- VS Code marketplace publishing — deployment phase

### 1.3 Preliminary Requirement

- Chat Panel layout must be implemented (Requirement 1)
- Input Area must be functional (Requirement 6)
- VS Code Webview API communication layer (postMessage) must be established
- Extension Host must expose file system, git, terminal, and diagnostics APIs

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Context Menu provides an inline context-attachment workflow within the chat input:

1. User types "#" in the Input Area text field
2. Context Menu popup appears above the input field
3. User navigates/filters the 9 context categories
4. User selects a category — may open a secondary picker (Files, Spec, Folder, Steering, MCP)
5. User completes selection — context tag badge inserted into input
6. User can attach multiple context sources
7. User submits message with attached context tags

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | Context Menu Trigger and Display | MUST HAVE | KSA-252 |
| 2 | Context Menu Navigation and Filtering | MUST HAVE | KSA-252 |
| 3 | Files Context Selection | MUST HAVE | KSA-252 |
| 4 | Spec Context Selection | MUST HAVE | KSA-252 |
| 5 | Git Diff Context (Instant) | MUST HAVE | KSA-252 |
| 6 | Terminal Context (Instant) | MUST HAVE | KSA-252 |
| 7 | Problems Context (Instant) | MUST HAVE | KSA-252 |
| 8 | Folder Context Selection | MUST HAVE | KSA-252 |
| 9 | Current File Context (Instant) | MUST HAVE | KSA-252 |
| 10 | Steering Context Selection | MUST HAVE | KSA-252 |
| 11 | MCP Context Selection | MUST HAVE | KSA-252 |
| 12 | Context Tag Badge Management | MUST HAVE | KSA-252 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** User focuses on the Input Area text field and types "#"

**Step 2:** Context Menu popup appears within 100ms directly above the input field, displaying 9 context source categories

**Step 3:** User can either:
- Continue typing to filter items (fuzzy match)
- Use Arrow Up/Down to highlight items
- Click an item directly

**Step 4:** Based on selected category:
- **Instant categories** (Git Diff, Terminal, Problems, Current File): Tag badge inserted immediately
- **Picker categories** (Files, Spec, Folder, Steering, MCP): Secondary picker panel opens

**Step 5:** For picker categories, user completes selection in the secondary panel

**Step 6:** Context tag badge (non-editable inline chip) is inserted into the input field

**Step 7:** User can repeat the process to attach multiple context sources

**Step 8:** User submits message — all attached context tags are included as context payload

> **Note:** The Context Menu can be dismissed at any time by pressing Escape or clicking outside.

---

#### STORY 1: Context Menu Trigger and Display

> As a user, I want to quickly attach context sources to my message by typing "#", so that I can reference files, specs, terminal output, and other resources without leaving the input field.

**Requirement Details:**

1. The Context Menu is triggered by the "#" character typed in the Input Area
2. The popup appears directly above the input field
3. The menu displays 9 context source categories in a vertical list
4. Each item has a distinct icon (left) and label (right)
5. Response time must be within 100 milliseconds

**Context Menu Items (9 categories):**

| # | Label | Icon | Type |
|---|-------|------|------|
| 1 | Files | Folder icon | Picker |
| 2 | Spec | Document icon | Picker |
| 3 | Git Diff | + icon | Instant |
| 4 | Terminal | Terminal icon | Instant |
| 5 | Problems | Warning triangle icon | Instant |
| 6 | Folder | Folder icon | Picker |
| 7 | Current File | Document icon | Instant |
| 8 | Steering | Steering wheel icon | Picker |
| 9 | MCP | Gem/diamond icon | Picker (submenu) |

**Acceptance Criteria:**

1. WHEN the user types "#" in the Input_Area text field, THE Chat_Panel SHALL display a Context_Menu popup directly above the input field within 100 milliseconds
2. THE Context_Menu SHALL display a vertical list of 9 context source categories, each with a distinct icon (left) and label (right)

---

#### STORY 2: Context Menu Navigation and Filtering

> As a user, I want to navigate and filter context menu items efficiently using keyboard and text, so that I can quickly find the context source I need.

**Requirement Details:**

1. Real-time fuzzy filtering as user types after "#"
2. Full keyboard navigation support
3. Dismiss behavior on Escape or click-outside

**Acceptance Criteria:**

3. THE Context_Menu SHALL filter the displayed items in real-time as the user continues typing after "#" (fuzzy match against item labels)
4. THE Context_Menu SHALL support keyboard navigation: Arrow Up/Down to highlight items, Enter to select the highlighted item, Escape to dismiss
5. WHEN the user presses Escape or clicks outside the Context_Menu, THE Context_Menu SHALL close without inserting anything into the input

---

#### STORY 3: Files Context Selection

> As a user, I want to attach specific workspace files as context, so that the AI can reference their content when processing my message.

**Requirement Details:**

1. Secondary file picker panel shows workspace file tree
2. Fuzzy search within the file picker
3. Multi-file selection support (Ctrl/Cmd + click)
4. Tag badge format: "#File: {relative_path}"

**Acceptance Criteria:**

8. WHEN the user selects "Files", THE Context_Menu SHALL display a secondary file picker panel showing the workspace file tree
9. THE file picker SHALL support fuzzy search — the user can type a filename to filter the tree in real-time
10. WHEN the user selects a file from the picker, THE Chat_Panel SHALL insert a tag badge "#File: {relative_path}" and close the Context_Menu
11. THE file picker SHALL allow selecting multiple files by holding Ctrl/Cmd and clicking, inserting one tag badge per selected file

---

#### STORY 4: Spec Context Selection

> As a user, I want to attach specification documents as context, so that the AI can reference project requirements and design decisions.

**Requirement Details:**

1. Lists available specs from .kiro/specs/ directory
2. Shows spec folder names as items
3. Attaches full content of requirements.md, design.md, and tasks.md from selected spec

**Acceptance Criteria:**

12. WHEN the user selects "Spec", THE Context_Menu SHALL display a list of available specs from the .kiro/specs/ directory, showing spec folder names
13. WHEN the user selects a spec, THE Chat_Panel SHALL insert a tag badge "#Spec: {spec-name}" and close the Context_Menu
14. THE spec item SHALL attach the full content of requirements.md, design.md, and tasks.md from the selected spec folder as context

---

#### STORY 5: Git Diff Context (Instant)

> As a user, I want to attach current git changes as context with a single selection, so that the AI can see what I have modified.

**Requirement Details:**

1. No secondary picker needed — instant insert
2. Attaches unstaged + staged changes (git diff + git diff --staged)

**Acceptance Criteria:**

15. WHEN the user selects "Git Diff", THE Chat_Panel SHALL immediately insert a tag badge "#Git Diff" and close the Context_Menu (no secondary picker needed)
16. THE Git Diff context SHALL attach the current unstaged and staged changes (equivalent to git diff + git diff --staged) to the message context

---

#### STORY 6: Terminal Context (Instant)

> As a user, I want to attach recent terminal output as context, so that the AI can see command results and errors.

**Requirement Details:**

1. Instant insert — no picker
2. Attaches last 100 lines (or configurable) from active terminal

**Acceptance Criteria:**

17. WHEN the user selects "Terminal", THE Context_Menu SHALL immediately insert a tag badge "#Terminal" and close the Context_Menu
18. THE Terminal context SHALL attach the most recent terminal output (last 100 lines or configurable) from the active terminal instance

---

#### STORY 7: Problems Context (Instant)

> As a user, I want to attach current workspace diagnostics as context, so that the AI can help me fix errors and warnings.

**Requirement Details:**

1. Instant insert — no picker
2. Attaches errors, warnings, and diagnostics from active file/workspace

**Acceptance Criteria:**

19. WHEN the user selects "Problems", THE Chat_Panel SHALL immediately insert a tag badge "#Problems" and close the Context_Menu
20. THE Problems context SHALL attach the current list of errors, warnings, and diagnostics from the active file or workspace diagnostics panel

---

#### STORY 8: Folder Context Selection

> As a user, I want to attach a folder file listing as context, so that the AI understands the project structure.

**Requirement Details:**

1. Folder picker shows workspace directory tree (folders only)
2. Attaches recursive file listing of selected folder

**Acceptance Criteria:**

21. WHEN the user selects "Folder", THE Context_Menu SHALL display a folder picker showing the workspace directory tree (folders only)
22. WHEN the user selects a folder, THE Chat_Panel SHALL insert a tag badge "#Folder: {relative_path}" and close the Context_Menu
23. THE Folder context SHALL attach a recursive listing of all files within the selected folder as context (file names and optionally content summaries)

---

#### STORY 9: Current File Context (Instant)

> As a user, I want to attach the currently open file as context with one click, so that the AI can reference what I am working on.

**Requirement Details:**

1. Instant insert — no picker
2. Tag shows current filename
3. Attaches full file content

**Acceptance Criteria:**

24. WHEN the user selects "Current File", THE Chat_Panel SHALL immediately insert a tag badge "#Current File: {filename}" and close the Context_Menu
25. THE Current File context SHALL attach the full content of the file currently active/open in the editor

---

#### STORY 10: Steering Context Selection

> As a user, I want to attach steering files as context, so that I can apply specific rules and guidelines to my AI interaction.

**Requirement Details:**

1. Lists steering files from .kiro/steering/*.md
2. Shows filename (without path/extension) as label
3. Attaches full content of selected steering markdown file

**Acceptance Criteria:**

26. WHEN the user selects "Steering", THE Context_Menu SHALL display a list of available steering files from .kiro/steering/*.md
27. EACH steering file item SHALL display the filename (without path and extension) as its label
28. WHEN the user selects a steering file, THE Chat_Panel SHALL insert a tag badge "#Steering: {filename}" and close the Context_Menu
29. THE Steering context SHALL attach the full content of the selected steering markdown file to the message context

---

#### STORY 11: MCP Context Selection

> As a user, I want to attach MCP resources as context, so that I can include tool schemas, resource data, or prompt templates in my message.

**Requirement Details:**

1. MCP item shows secondary label "Model Context Protocol ->" indicating submenu
2. Opens secondary panel listing MCP resources/tools from configured servers
3. Attaches selected MCP resource content

**Acceptance Criteria:**

30. THE MCP item SHALL display a secondary label "Model Context Protocol ->" on the right side indicating it opens a submenu
31. WHEN the user selects "MCP", THE Context_Menu SHALL display a secondary panel listing available MCP resources/tools from configured MCP servers
32. WHEN the user selects an MCP resource, THE Chat_Panel SHALL insert a tag badge "#MCP: {resource_name}" and close the Context_Menu
33. THE MCP context SHALL attach the selected MCP resource content (tool schema, resource data, or prompt template) to the message context

---

#### STORY 12: Context Tag Badge Management

> As a user, I want to manage inserted context tags easily, so that I can add/remove context references before sending my message.

**Requirement Details:**

1. Tag badges are non-editable inline chips in the input field
2. Removable via Backspace (when cursor adjacent) or clicking (X) icon
3. Multiple tags can coexist in the same message

**Acceptance Criteria:**

6. AFTER the user selects an item and completes the selection flow, THE Chat_Panel SHALL insert a visible context tag badge (e.g., "#File: main.ts") into the input field, styled as a non-editable inline chip
7. THE context tag badge SHALL be removable by pressing Backspace when the cursor is adjacent to it, or by clicking an (X) icon on the badge

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Chat Panel Layout | System | KSA-248 (Req 1) | Panel must be rendered before Context Menu can appear |
| Input Area | System | KSA-250 (Req 6) | Text field must exist for "#" trigger to work |
| VS Code Webview API | Infrastructure | N/A | postMessage protocol for extension-webview communication |
| VS Code File System API | Infrastructure | N/A | Required for Files and Folder pickers |
| VS Code Git Extension API | Infrastructure | N/A | Required for Git Diff context resolution |
| VS Code Terminal API | Infrastructure | N/A | Required for Terminal context resolution |
| VS Code Diagnostics API | Infrastructure | N/A | Required for Problems context resolution |
| MCP Configuration | System | N/A | MCP servers must be configured in .kiro/settings/mcp.json |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Product Owner | Development Team Lead | Approve requirements, UAT | Ticket creator |
| Developer | Frontend Developer | Implement in TypeScript/VS Code Extension | Assignee |
| QA Engineer | QA Team | Test all 33 acceptance criteria | Ticket watcher |
| UX Designer | Design Team | Validate interaction patterns | Reviewer |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| VS Code API limitations for file picking in webview | High | Medium | Use postMessage to delegate file picking to extension host |
| Performance lag when loading large file trees | Medium | Medium | Implement lazy loading, virtual scrolling for file picker |
| MCP server unavailability | Medium | Low | Show "No MCP servers configured" empty state |
| Context window overflow from large attached files | High | Medium | Show file size warning, limit attachment size |
| Keyboard navigation conflicts with VS Code shortcuts | Medium | Medium | Use webview-scoped event handling, prevent propagation |

### 5.2 Assumptions

- VS Code Extension Host can provide file system, git, terminal, and diagnostic data via postMessage
- The webview has access to render popup menus (no iframe restrictions blocking overlays)
- MCP server configurations are available from .kiro/settings/mcp.json at runtime
- Steering files are accessible via the extension workspace file system API
- The input field supports inline non-editable chip/badge elements (contenteditable or custom widget)

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Context Menu popup display | Must appear within 100ms of "#" keystroke |
| Performance | Fuzzy filtering | Must update results within 50ms of each keystroke |
| Performance | File tree loading | Must show first 50 items within 200ms, lazy-load rest |
| Responsiveness | Touch targets | All interactive elements >= 44x44 CSS pixels on touch devices |
| Accessibility | Keyboard navigation | Full keyboard support (Arrow keys, Enter, Escape) |
| Accessibility | Screen reader | ARIA roles: listbox for menu, option for items, combobox for search |
| Accessibility | Focus management | Focus must return to input field after menu dismissal |
| Usability | Dismiss behavior | Escape or click-outside always closes menu without side effects |
| Compatibility | VS Code versions | Must work with VS Code 1.80+ (Webview API v2) |
| Security | File access | Only workspace files accessible — no system-level file browsing |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-252 | Context Menu ("#" Trigger) | To Do | Story | Main ticket |
| KSA-248 | Chat Panel Layout | To Do | Story | Dependency (Req 1) |
| KSA-250 | Input Area | To Do | Story | Dependency (Req 6) |
| KSA-253 | Slash Command Menu ("/" Trigger) | To Do | Story | Related (Req 14) |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Context_Menu | The popup menu triggered by typing "#" that lists context sources |
| Tag Badge | Non-editable inline chip inserted into input field representing attached context |
| Instant Category | Context source that requires no secondary picker (Git Diff, Terminal, Problems, Current File) |
| Picker Category | Context source that opens a secondary selection panel (Files, Spec, Folder, Steering, MCP) |
| postMessage | VS Code API for communication between webview and extension host |
| MCP | Model Context Protocol — standard for AI tool/resource integration |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| Chatbox UI Spec | .kiro/specs/chatbox-ui/requirements.md |
| Requirement 13 | Section "Context Menu ('#' Trigger)" in requirements.md |
| VS Code Webview API | https://code.visualstudio.com/api/extension-guides/webview |
| VS Code Extension API | https://code.visualstudio.com/api |

### Use Case Diagram

![Use Case Diagram](diagrams/use-case.png)

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
