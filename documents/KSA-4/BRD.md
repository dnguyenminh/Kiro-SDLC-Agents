# Business Requirements Document (BRD)

## Kiro SDLC Agents Extension — KSA-4: Indexer Selection — Choose ONE Language

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-4 |
| Title | Indexer Selection — Choose ONE Language |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-07-10 |
| Status | Draft |
| Parent Epic | KSA-1: Kiro SDLC Agents Extension |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-10 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-4 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This document defines the business requirements for the **Indexer Selection** feature of the Kiro SDLC Agents VS Code extension. This feature provides a QuickPick UI that allows users to choose exactly ONE indexer language when injecting SDLC resources into their workspace. The selected indexer script is the only one copied to the workspace; base configuration files are always included regardless of selection.

KSA-4 specifically covers:
- QuickPick UI showing 5 indexer language options (Python, Java, Node.js, PowerShell, Bash)
- Single-selection constraint (user picks exactly one)
- Filtered copy behavior: only the selected language script directory is copied
- Base config (`index-config.json`, `modules/`, `scripts/README.md`) always copied

### 1.2 Out of Scope

- Extension activation and command registration (covered by KSA-2: Extension Core)
- File copy mechanics and recursive directory operations (covered by KSA-3: Injector)
- Auto-detection of available runtimes to suggest a default (covered by KSA-5: Auto-detect Runtime)
- Individual indexer script implementations (covered by KSA-7 through KSA-10)
- Bundled resource packaging (covered by KSA-6: Bundled Resources)

### 1.3 Preliminary Requirement

- KSA-2 (Extension Core) must be implemented — provides command infrastructure
- KSA-3 (Injector) must be implemented — provides `injectAll()` and `injectSelective()` which call the indexer picker
- VS Code workspace must be open for the QuickPick to have context
- Extension must bundle all 5 indexer script directories in `resources/.analysis/code-intelligence/scripts/`

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Indexer Selection feature is triggered during the injection flow. When a user invokes "Inject All" or "Inject Selective" (with indexer component selected), the system presents a QuickPick dialog listing 5 indexer language options. The user selects exactly one. The system then copies only the base config plus the selected language's script directory to the workspace.

![Business Flow](diagrams/business-flow.png)

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer, I want to see a QuickPick with 5 indexer options so that I can choose the language that matches my project | MUST HAVE | KSA-4 |
| 2 | As a developer, I want to select exactly ONE indexer language so that only relevant scripts are copied to my workspace | MUST HAVE | KSA-4 |
| 3 | As a developer, I want the base config always copied regardless of my language choice so that the indexer infrastructure is complete | MUST HAVE | KSA-4 |
| 4 | As a developer, I want clear labels and descriptions for each option so that I can make an informed choice | SHOULD HAVE | KSA-4 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** User triggers injection (via "Inject All" or "Inject Selective" with indexer selected).

**Step 2:** System displays a QuickPick dialog with title "Choose ONE indexer language for this workspace".

**Step 3:** QuickPick shows 5 options, each with a label and description indicating language, version requirement, and key characteristic.

**Step 4:** User selects exactly one option (single-select mode — `canPickMany: false`).

**Step 5:** System copies base config files (`index-config.json`, `modules/`, `scripts/README.md`) to `.analysis/code-intelligence/`.

**Step 6:** System copies ONLY the selected language's script directory to `.analysis/code-intelligence/scripts/{language}/`.

**Step 7:** System reports success, indicating which indexer was installed.

> **Note:** If user dismisses the QuickPick (ESC or click outside), no indexer files are copied but core components (agents, steering, hooks, templates) are still injected if part of "Inject All".

---

#### STORY 1: QuickPick Shows 5 Indexer Options

> As a developer, I want to see a QuickPick with 5 indexer options so that I can choose the language that matches my project.

**Requirement Details:**

1. A VS Code QuickPick dialog is displayed with exactly 5 options
2. The QuickPick has a placeholder text: "Choose ONE indexer language for this workspace"
3. Options are presented in a fixed order: Python, Java, PowerShell, Bash, Node.js
4. Each option has a `label` (primary text) and `description` (secondary text)
5. The QuickPick is single-select (`canPickMany: false`)

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| label | string | Yes | Primary display text with language name and key trait | "Python Indexer (recommended — zero dependency)" |
| description | string | Yes | Secondary text with version requirement | "Python 3.7+ standard library only" |
| component | Component | Yes | Internal reference to the INDEXER_OPTIONS config entry | `{ id: "indexer-python", ... }` |

**QuickPick Options:**

| # | Label | Description | Component ID |
|---|-------|-------------|--------------|
| 1 | Python Indexer (recommended — zero dependency) | Python 3.7+ standard library only | indexer-python |
| 2 | Java Indexer | Java 17+ (for JVM projects) | indexer-java |
| 3 | PowerShell Indexer | PowerShell 5.1+ (Windows built-in) | indexer-powershell |
| 4 | Bash Indexer | Bash 4+ (Linux/Mac built-in) | indexer-bash |
| 5 | Node.js Indexer (most accurate) | Node.js 18+ (needs npm install) | indexer-nodejs |

**Acceptance Criteria:**

1. QuickPick shows exactly 5 indexer options
2. Each option displays both label and description
3. Options appear in the defined order (Python first, Node.js last)
4. QuickPick placeholder reads "Choose ONE indexer language for this workspace"
5. QuickPick is single-select (user cannot select multiple)

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Indexer Picker | QuickPick (single-select) | Yes | Shows 5 language options | canPickMany: false |
| 2 | Option Label | Text | Yes | Primary text — language name + trait | Bold in QuickPick |
| 3 | Option Description | Text | Yes | Secondary text — version requirement | Dimmed in QuickPick |
| 4 | Placeholder | Text | Yes | "Choose ONE indexer language for this workspace" | Shown when no filter typed |

---

#### STORY 2: User Selects ONE Language

> As a developer, I want to select exactly ONE indexer language so that only relevant scripts are copied to my workspace.

**Requirement Details:**

1. The QuickPick enforces single selection — only one item can be chosen
2. Upon selection, the QuickPick closes and returns the selected Component
3. The selected component's `sourcePath` determines which directory to copy
4. No other indexer language directories are copied

**Acceptance Criteria:**

1. User can select only ONE option (not multiple)
2. After selection, only the selected language's script directory is copied to workspace
3. No other language directories are present in `.analysis/code-intelligence/scripts/` after injection
4. If user previously had a different indexer, the old one remains (no deletion of existing files)

**Validation Rules:**

- Selection must map to a valid `INDEXER_OPTIONS` entry
- If selection is undefined/null (user cancelled), no indexer files are copied

**Error Handling:**

- User presses ESC: QuickPick returns undefined → no indexer copied, injection continues without indexer
- User clicks outside QuickPick: Same as ESC — no indexer copied

---

#### STORY 3: Base Config Always Copied

> As a developer, I want the base config always copied regardless of my language choice so that the indexer infrastructure is complete.

**Requirement Details:**

1. When any indexer language is selected, the `INDEXER_BASE` component is ALWAYS copied first
2. `INDEXER_BASE` includes: `index-config.json`, `modules/` directory, `scripts/README.md`
3. These files provide the configuration and output structure needed by any indexer language
4. Base config copy happens before the language-specific copy

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| INDEXER_BASE.sourcePath | string | Yes | Source in extension resources | ".analysis/code-intelligence" |
| INDEXER_BASE.targetPath | string | Yes | Target in workspace | ".analysis/code-intelligence" |
| INDEXER_BASE.filter | string[] | Yes | Items to copy from source | ["index-config.json", "modules", "scripts/README.md"] |

**Acceptance Criteria:**

1. `index-config.json` exists at `.analysis/code-intelligence/index-config.json` after injection
2. `modules/` directory exists at `.analysis/code-intelligence/modules/` after injection
3. `scripts/README.md` exists at `.analysis/code-intelligence/scripts/README.md` after injection
4. These files are present regardless of which language was selected
5. Base config is copied even if the language-specific copy fails

---

#### STORY 4: Clear Labels and Descriptions

> As a developer, I want clear labels and descriptions for each option so that I can make an informed choice.

**Requirement Details:**

1. Each label indicates the language name and a distinguishing characteristic
2. Python is marked as "recommended — zero dependency" (no external packages needed)
3. Node.js is marked as "most accurate" (uses TypeScript AST parsing)
4. PowerShell notes "Windows built-in" (available without installation on Windows)
5. Bash notes "Linux/Mac built-in" (available without installation on Unix)
6. Java notes "for JVM projects" (natural choice for Java/Kotlin codebases)
7. Descriptions show minimum version requirements

**Acceptance Criteria:**

1. Python label contains "recommended" indicator
2. Node.js label contains "most accurate" indicator
3. Each description includes minimum version requirement (e.g., "Python 3.7+")
4. Labels are concise (< 50 characters) and scannable
5. Descriptions provide enough info to make a decision without external documentation

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Extension Core | System | KSA-2 | Provides command registration that triggers injection flow |
| Injector Module | System | KSA-3 | Calls `pickIndexer()` during `injectAll()` and `injectSelective()` |
| VS Code QuickPick API | External | N/A | `vscode.window.showQuickPick()` for the selection UI |
| INDEXER_OPTIONS config | Data | KSA-4 | Configuration array defining the 5 indexer options |
| INDEXER_BASE config | Data | KSA-4 | Configuration defining base files always copied |
| Bundled Resources | System | KSA-6 | Extension must bundle all 5 indexer script directories |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Developer | Extension Users | Select indexer language during injection | Target audience |
| Extension Maintainer | Kiro SDLC Team | Implements and maintains the picker UI | KSA-4 assignee |
| Product Owner | Kiro SDLC Team | Defines indexer options and labels | Epic KSA-1 |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| User doesn't know which language to pick | Medium | Medium | Provide clear descriptions; mark Python as "recommended" default |
| User cancels picker accidentally | Low | Low | No destructive action on cancel — core components still injected |
| New indexer language added in future | Low | Medium | INDEXER_OPTIONS is a config array — easy to extend |

### 5.2 Assumptions

- VS Code `showQuickPick` API supports `canPickMany: false` for single-select mode
- Users understand the concept of "indexer language" (the language the indexer script is written in, not the project language)
- All 5 indexer script directories are bundled with the extension at build time
- The QuickPick is modal — user must select or cancel before continuing

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | QuickPick appears within 100ms | No async loading needed — options are static config |
| Usability | Clear visual hierarchy | Label is primary (bold), description is secondary (dimmed) |
| Usability | Keyboard navigable | User can arrow-key through options and Enter to select |
| Accessibility | Screen reader compatible | VS Code QuickPick natively supports screen readers |
| Extensibility | Easy to add new languages | Adding a new indexer = add entry to INDEXER_OPTIONS array |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-4 | Indexer Selection — Choose ONE Language | To Do | Task | Main ticket |
| KSA-1 | Kiro SDLC Agents Extension | In Progress | Epic | Parent epic |
| KSA-2 | Extension Core — Commands & Activation | Done | Task | Dependency (commands) |
| KSA-3 | Injector — Copy Resources to Workspace | Done | Task | Dependency (calls picker) |
| KSA-5 | Auto-detect Runtime & Run Indexer | To Do | Task | Related (suggests default) |
| KSA-6 | Bundled Resources | To Do | Task | Dependency (bundles scripts) |
| KSA-7 | Code Indexer — Python | To Do | Task | Related (indexer variant) |
| KSA-8 | Code Indexer — Java | To Do | Task | Related (indexer variant) |
| KSA-9 | Code Indexer — PowerShell | To Do | Task | Related (indexer variant) |
| KSA-10 | Code Indexer — Bash | To Do | Task | Related (indexer variant) |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| QuickPick | VS Code's built-in dropdown/list UI component for user selection |
| Indexer | Language-specific script that analyzes source code and generates code intelligence files |
| INDEXER_OPTIONS | Configuration array in `config.ts` defining the 5 available indexer choices |
| INDEXER_BASE | Configuration object defining base files (config, modules, README) always copied |
| canPickMany | VS Code QuickPick property — `false` = single-select, `true` = multi-select |
| Code Intelligence | Output of indexer: project structure, module analysis, KB payloads |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| VS Code QuickPick API | https://code.visualstudio.com/api/references/vscode-api#window.showQuickPick |
| Extension config | `kiro-sdlc-agents/src/config.ts` |
| Injector (pickIndexer) | `kiro-sdlc-agents/src/injector.ts` |
| Parent Epic BRD | `documents/KSA-2/BRD.md` (KSA-1 context) |

### Interaction Flow Diagram

![Use Case Diagram](diagrams/use-case.png)

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case Diagram | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
