# Functional Specification Document (FSD)

## Kiro SDLC Agents — KSA-13: Release v1.0.3 — SM agent project-level workflow + jira.conf management

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-13 |
| Title | Release v1.0.3 — SM agent project-level workflow + jira.conf management |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2026-05-10 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-13.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | BA Agent | Initial FSD — business sections |
| 1.0 | 2026-05-10 | TA Agent | Technical enrichment — API contracts, integration specs |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the SM agent's new project-level workflow and jira.conf management features introduced in Release v1.0.3. It provides sufficient detail for the SA agent to create a Technical Design Document (TDD) and for the DEV agent to implement the changes.

### 1.2 Scope

- Input parsing logic to distinguish ticket-level vs project-level commands
- jira.conf file management (create, read, update with user confirmation)
- Project-level ticket querying and status display
- SM agent prompt updates across 4 locations

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-13/BRD.md |
| SM Agent Prompt (source) | kiro-sdlc-agents/resources/.kiro/agents/scrum-master-agent.md |
| Sync Script | scripts/sync-from-source.ps1 |

---

## 2. System Context

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

### 2.2 Actors

| Actor | Type | Description |
|-------|------|-------------|
| Developer | Human | Invokes SM agent via Kiro IDE |
| SM Agent | System | Orchestrates SDLC pipeline, manages project context |
| Jira MCP Server | External System | Provides Jira ticket data via MCP protocol |
| File System | System | Stores jira.conf, STATUS.json, documents |

### 2.3 System Boundaries

The SM agent operates within the Kiro IDE extension context. It communicates with:
- Jira MCP Server (read tickets, transitions)
- Local file system (jira.conf, documents/, STATUS.json)
- Other SDLC agents (BA, TA, SA, QA, DEV, DevOps)

---

## 3. Functional Requirements

### 3.1 Use Case: UC-01 — Parse Input (Ticket vs Project Level)

| Field | Value |
|-------|-------|
| ID | UC-01 |
| Name | Parse Input |
| Actor | Developer |
| Precondition | SM agent is invoked with text input |
| Postcondition | Input classified as ticket-level or project-level |

#### Main Flow

| Step | Actor | Action |
|------|-------|--------|
| 1 | Developer | Provides input text to SM agent |
| 2 | SM Agent | Applies regex `^([A-Z][A-Z0-9_]+)-(\d+)(.*)$` to input |
| 3 | SM Agent | If matches → classify as ticket-level, extract ticket key + action |
| 4 | SM Agent | If no match → apply regex `^([A-Z][A-Z0-9_]+)\s+(.+)$` |
| 5 | SM Agent | If matches → classify as project-level, extract project key + action |
| 6 | SM Agent | Route to appropriate handler |

#### Alternative Flow

| Step | Condition | Action |
|------|-----------|--------|
| 4a | Input matches neither pattern | Report error: "Input không hợp lệ. Vui lòng cung cấp ticket key (VD: KSA-13) hoặc project key + action (VD: KSA workflow)" |

#### Exception Flow

| Step | Condition | Action |
|------|-----------|--------|
| 2a | Input is empty or null | Report: "Vui lòng cung cấp ticket key hoặc project key" |

#### Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-01 | Ticket pattern | `[A-Z][A-Z0-9_]+-\d+` (e.g., KSA-13, COLLEX-64) |
| BR-02 | Project pattern | `[A-Z][A-Z0-9_]+` followed by whitespace + action keyword |
| BR-03 | Action keywords | `workflow`, `quy trình`, `status`, `tạo tài liệu đầy đủ` |
| BR-04 | Case sensitivity | Project key must be uppercase |

---

### 3.2 Use Case: UC-02 — Manage jira.conf

| Field | Value |
|-------|-------|
| ID | UC-02 |
| Name | Manage jira.conf |
| Actor | SM Agent (triggered by project-level input) |
| Precondition | Input classified as project-level |
| Postcondition | jira.conf exists with correct project prefix |

#### Main Flow

| Step | Actor | Action |
|------|-------|--------|
| 1 | SM Agent | Check if `jira.conf` exists at workspace root |
| 2 | SM Agent | If exists → read file, extract JIRA_PROJECT_PREFIX value |
| 3 | SM Agent | Compare extracted prefix with input project key |
| 4 | SM Agent | If match → proceed to UC-03 (Query Project) |
| 5 | SM Agent | If no match → execute Alternative Flow (conflict resolution) |

#### Alternative Flow — File Does Not Exist

| Step | Condition | Action |
|------|-----------|--------|
| 1a | jira.conf not found | Create jira.conf with comment header + JIRA_PROJECT_PREFIX={input_key} |
| 1b | | Proceed to UC-03 |

#### Alternative Flow — Project Key Conflict

| Step | Condition | Action |
|------|-----------|--------|
| 5a | Keys differ | Display warning: "⚠️ jira.conf hiện tại có JIRA_PROJECT_PREFIX={old_key}. Bạn muốn đổi sang {new_key}?" |
| 5b | | Present options: 1) Switch, 2) Keep current |
| 5c | User selects 1 | Update jira.conf with new key, proceed to UC-03 |
| 5d | User selects 2 | Cancel current command, report cancellation |

#### Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-05 | File location | `{workspace_root}/jira.conf` |
| BR-06 | File format | Comment lines start with `#`, config line: `KEY=VALUE` |
| BR-07 | Single value | Only JIRA_PROJECT_PREFIX allowed, no other keys |
| BR-08 | No sensitive data | Must not contain URLs, tokens, passwords |
| BR-09 | Prefix validation | Value must match `[A-Z][A-Z0-9_]+` |

#### Data Specification

**jira.conf file format:**
```
# Jira Configuration
# Used by SM agent to identify project scope

JIRA_PROJECT_PREFIX={PROJECT_KEY}
```

---

### 3.3 Use Case: UC-03 — Query Project Tickets

| Field | Value |
|-------|-------|
| ID | UC-03 |
| Name | Query Project Tickets |
| Actor | SM Agent |
| Precondition | jira.conf valid, project key confirmed |
| Postcondition | Project overview displayed to user |

#### Main Flow

| Step | Actor | Action |
|------|-------|--------|
| 1 | SM Agent | Construct JQL: `project = "{KEY}" ORDER BY key ASC` |
| 2 | SM Agent | Call Jira MCP: `jira_search(jql, limit=50)` |
| 3 | SM Agent | For each ticket, check `documents/{TICKET}/STATUS.json` |
| 4 | SM Agent | If STATUS.json missing, scan for existing files (BRD.md, FSD.md, TDD.md) |
| 5 | SM Agent | Build overview table with columns: Ticket, Summary, Jira Status, Docs Status |
| 6 | SM Agent | Display table to user |
| 7 | SM Agent | If action = `workflow` → propose next actions with numbered options |
| 8 | SM Agent | If action = `status` → display table only, no proposals |

#### Alternative Flow — Jira Unavailable

| Step | Condition | Action |
|------|-----------|--------|
| 2a | Jira MCP returns error | Report: "⚠️ Không thể kết nối Jira. Hiển thị status từ local files." |
| 2b | | Scan `documents/` directory for all {KEY}-* folders |
| 2c | | Display local-only status (no Jira status column) |

#### Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-10 | Query limit | Maximum 50 tickets per query |
| BR-11 | Sort order | Tickets sorted by key ASC |
| BR-12 | Docs status logic | Complete = BRD+FSD+TDD exist; Partial = some exist; No docs = none exist |
| BR-13 | Status display | Use emoji indicators: ✅ Complete, 🔄 Partial, ❌ No docs |

#### 3.3.5 API Contract — Jira Search

**Request:**
```
Tool: jira_search
Parameters:
  jql: "project = \"{KEY}\" ORDER BY key ASC"
  limit: 50
  fields: "summary,status,issuetype,labels,priority"
```

**Response (expected structure):**
```json
{
  "issues": [
    {
      "key": "KSA-1",
      "fields": {
        "summary": "Epic: Kiro SDLC Agents Extension",
        "status": { "name": "In Progress" },
        "issuetype": { "name": "Epic" },
        "labels": ["release"],
        "priority": { "name": "High" }
      }
    }
  ],
  "total": 14,
  "maxResults": 50
}
```

---

### 3.4 Use Case: UC-04 — Display Project Overview

| Field | Value |
|-------|-------|
| ID | UC-04 |
| Name | Display Project Overview |
| Actor | SM Agent |
| Precondition | Ticket data retrieved (from Jira or local) |
| Postcondition | User sees formatted overview and options |

#### Main Flow

| Step | Actor | Action |
|------|-------|--------|
| 1 | SM Agent | Format overview header: "📊 Project {KEY} — Tổng quan" |
| 2 | SM Agent | Render table with ticket data |
| 3 | SM Agent | Calculate summary: total tickets, with docs, without docs |
| 4 | SM Agent | Display summary section |
| 5 | SM Agent | If action = `workflow` → display action options |
| 6 | Developer | Selects an option (1, 2, or 3) |
| 7 | SM Agent | Execute selected action |

#### UI Specification — Overview Output

```
📊 Project {KEY} — Tổng quan

| Ticket | Summary | Jira Status | Docs Status |
|--------|---------|-------------|-------------|
| KSA-1  | Epic... | In Progress | ✅ Complete |
| KSA-2  | Core... | To Do       | ❌ No docs  |

📋 Tóm tắt:
- Tổng: {N} tickets
- Có tài liệu: {M} tickets
- Chưa có tài liệu: {N-M} tickets

Bạn muốn làm gì?
1. Tạo tài liệu cho ticket cụ thể (chọn ticket)
2. Tạo tài liệu đầy đủ cho tất cả tickets (batch)
3. Chỉ xem status
```

---

### 3.5 Use Case: UC-05 — SM Prompt Synchronization

| Field | Value |
|-------|-------|
| ID | UC-05 |
| Name | SM Prompt Synchronization |
| Actor | Developer (manual trigger) |
| Precondition | SM prompt source file updated |
| Postcondition | All 4 locations have identical SM prompt |

#### Main Flow

| Step | Actor | Action |
|------|-------|--------|
| 1 | Developer | Updates SM prompt in source location |
| 2 | Developer | Runs `scripts/sync-from-source.ps1` |
| 3 | Script | Reads source SM prompt |
| 4 | Script | Copies to 3 other locations (agents, prompts, bundled resources) |
| 5 | Script | Reports sync status |

#### 4 SM Prompt Locations

| # | Location | Purpose |
|---|----------|---------|
| 1 | `.kiro/agents/sm-agent.md` | Active agent in workspace (source of truth) |
| 2 | `.kiro/agents/prompts/sm-agent.md` | Prompt library (synced) |
| 3 | `kiro-sdlc-agents/resources/.kiro/agents/sm-agent.md` | Bundled in VSIX |
| 4 | `kiro-sdlc-agents/resources/.kiro/agents/prompts/sm-agent.md` | Bundled prompt library |

---

## 4. State Diagram

### 4.1 jira.conf State Machine

![State Diagram](diagrams/state-jira-conf.png)

| State | Description | Transitions |
|-------|-------------|-------------|
| NOT_EXISTS | jira.conf file does not exist | → CREATED (on project-level input) |
| CREATED | File exists with valid prefix | → CONFLICT (on different project input) |
| CONFLICT | Input key differs from file key | → UPDATED (user confirms) / → CREATED (user cancels) |
| UPDATED | File updated with new prefix | → CREATED (stable state) |

---

## 5. Integration Requirements

### 5.1 Jira MCP Server Integration

| Aspect | Specification |
|--------|---------------|
| Protocol | MCP (Model Context Protocol) |
| Tool | `jira_search` |
| Authentication | Handled by MCP server configuration (external to SM agent) |
| Rate Limiting | N/A (single query per invocation) |
| Error Handling | Graceful fallback to local file scan |

### 5.2 File System Integration

| Operation | Path | Format |
|-----------|------|--------|
| Read/Write jira.conf | `{workspace_root}/jira.conf` | Plain text (KEY=VALUE) |
| Read STATUS.json | `documents/{TICKET}/STATUS.json` | JSON |
| Scan documents | `documents/{TICKET}/` | Directory listing |

---

## 6. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| Performance | Project query + display | < 5 seconds for ≤50 tickets |
| Reliability | Jira unavailable fallback | Local file scan within 2 seconds |
| Usability | Vietnamese language | All user-facing messages in Vietnamese |
| Compatibility | Existing commands | Ticket-level commands unchanged |
| Security | No secrets in jira.conf | Only project prefix stored |

---

## 7. Error Handling

| Error Code | Condition | User Message | Recovery |
|------------|-----------|--------------|----------|
| ERR-01 | Invalid input format | "Input không hợp lệ..." | Show usage examples |
| ERR-02 | Jira MCP unavailable | "⚠️ Không thể kết nối Jira..." | Fallback to local scan |
| ERR-03 | jira.conf parse error | "⚠️ jira.conf format không hợp lệ..." | Offer to recreate |
| ERR-04 | No tickets found | "Project {KEY} không có tickets nào" | Verify project key |
| ERR-05 | File write permission | "Không thể ghi jira.conf..." | Report error, suggest manual fix |

---

## 8. Open Issues

| # | Issue | Status | Owner |
|---|-------|--------|-------|
| 1 | Should SM support multiple project prefixes in jira.conf? | Deferred to v1.1 | PO |
| 2 | Should jira.conf be in .gitignore by default? | To discuss | Dev team |

---

## 9. Appendix

### 9.1 Sequence Diagram — Project-level Workflow

![Sequence Diagram](diagrams/sequence-project-workflow.png)

### 9.2 Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Project Workflow | [sequence-project-workflow.png](diagrams/sequence-project-workflow.png) | [sequence-project-workflow.drawio](diagrams/sequence-project-workflow.drawio) |
| 3 | State — jira.conf | [state-jira-conf.png](diagrams/state-jira-conf.png) | [state-jira-conf.drawio](diagrams/state-jira-conf.drawio) |
