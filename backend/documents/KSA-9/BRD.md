# Business Requirements Document (BRD)

## Kiro SDLC Agents — KSA-9: Code Indexer — PowerShell version

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-9 |
| Title | Code Indexer — PowerShell version |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2026-05-10 |
| Status | Draft |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | BA Agent – Business Analyst | Create document |
| Peer Reviewer | Duc Nguyen – Reporter | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-9 and linked tickets |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

Develop a PowerShell-based code indexer that scans workspace source files and generates an index for code intelligence features. The indexer must be compatible with PowerShell 5.1+ and run on Windows without requiring any additional software installation (zero-install, using Windows built-in tools only).

**Note:** Per comment from Duc Nguyen Minh (2026-05-20), this functionality has been absorbed into the MCP server IndexingEngine. The standalone PowerShell indexer is no longer needed as a separate component.

### 1.2 Out of Scope

- Cross-platform support (Linux/macOS) — Windows only
- GUI interface — CLI/script only
- Real-time file watching — batch indexing only
- Integration with external IDEs beyond the Kiro SDLC Agents ecosystem

### 1.3 Preliminary Requirement

- Windows OS with PowerShell 5.1+ (built-in on Windows 10/11)
- Access to workspace source code files
- Part of Epic KSA-1: Kiro SDLC Agents — VS Code/Kiro Extension

---

## 2. Business Requirements

### 2.1 High Level Process Map

The code indexer follows a simple batch processing flow:

1. User/system triggers the indexer script
2. Script scans the workspace directory recursively
3. Source files are parsed to extract code symbols (functions, classes, interfaces)
4. An index database/file is generated
5. Index is made available for code intelligence queries

```mermaid
flowchart LR
    A[Trigger Indexer] --> B[Scan Workspace]
    B --> C[Parse Source Files]
    C --> D[Extract Symbols]
    D --> E[Generate Index]
    E --> F[Index Available for Queries]
```

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer, I want a PowerShell code indexer that works on Windows without additional installs so that I can index my codebase using built-in tools | MUST HAVE | KSA-9 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Developer opens a workspace in Kiro/VS Code

**Step 2:** The code indexer PowerShell script is invoked (manually or automatically)

**Step 3:** The script recursively scans the workspace for supported source files

**Step 4:** Each file is parsed to extract code symbols (functions, classes, methods, interfaces)

**Step 5:** Extracted symbols are stored in an index structure (file-based database)

**Step 6:** The index is available for code intelligence features (search, navigation, context)

> **Note:** This standalone indexer has been superseded by the MCP server IndexingEngine which provides the same functionality integrated directly into the MCP code intelligence server.

---

#### STORY 1: PowerShell Code Indexer

> As a developer, I want a PowerShell code indexer that works on Windows without additional installs so that I can index my codebase using built-in tools.

**Requirement Details:**

1. The indexer must be implemented as a PowerShell script compatible with PowerShell 5.1+
2. Must work on Windows without requiring any additional software installation (zero-install)
3. Must scan workspace directories recursively for source code files
4. Must extract code symbols (functions, classes, methods, interfaces) from supported languages
5. Must generate a searchable index for code intelligence features

**Acceptance Criteria:**

1. PowerShell 5.1+ compatible — script runs without errors on Windows PowerShell 5.1
2. Windows built-in, zero install — no external modules, tools, or dependencies required
3. Tested and working — produces correct index output for a sample workspace

**Validation Rules:**

- Script must validate PowerShell version >= 5.1 at startup
- Script must handle missing/inaccessible directories gracefully
- Script must skip binary files and unsupported file types

**Error Handling:**

- Directory not found: Log warning and skip
- File access denied: Log warning and continue with next file
- Parse error: Log warning with file path and continue indexing

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| Epic KSA-1 | System | KSA-1 | Parent epic — Kiro SDLC Agents VS Code/Kiro Extension |
| PowerShell 5.1+ | Infrastructure | N/A | Windows built-in scripting engine |
| MCP Server IndexingEngine | System | N/A | Successor system that absorbed this functionality |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Reporter | Duc Nguyen | Requirements definition | Ticket reporter |
| Commenter | Duc Nguyen Minh | Technical decision (absorbed into MCP) | Ticket comment |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Functionality superseded by MCP IndexingEngine | High | Confirmed | This task is already resolved — indexing is handled by MCP server |
| PowerShell performance limitations for large codebases | Medium | Medium | Limit scan depth, implement incremental indexing |

### 5.2 Assumptions

- Windows PowerShell 5.1 is available on all target machines
- Workspace sizes are manageable for batch indexing (< 100K files)
- The MCP server IndexingEngine provides equivalent or better functionality

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Reasonable indexing time | Should complete indexing within acceptable time for typical workspaces |
| Compatibility | PowerShell 5.1+ | Must not use PowerShell 7+ specific features |
| Portability | Zero-install | No external dependencies beyond Windows built-in tools |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-9 | Code Indexer — PowerShell version | Done | Task | Main ticket |
| KSA-1 | Kiro SDLC Agents — VS Code/Kiro Extension | Done | Epic | Parent epic |

---

## 8. Appendix

### Resolution Note

This ticket was resolved on 2026-05-20. Per the comment from Duc Nguyen Minh: "Indexing absorbed by MCP server IndexingEngine. Standalone PowerShell indexer no longer needed." The functionality originally planned for this standalone script has been integrated into the MCP code intelligence server's IndexingEngine component.

### Glossary

| Term | Definition |
|------|------------|
| Code Indexer | A tool that scans source code files and builds a searchable index of code symbols |
| MCP | Model Context Protocol — the server framework used for code intelligence |
| IndexingEngine | The component within the MCP server that handles code indexing |
| PowerShell 5.1 | Windows built-in scripting language and shell |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| Jira Ticket KSA-9 | https://jiraassist.atlassian.net/browse/KSA-9 |
| Epic KSA-1 | https://jiraassist.atlassian.net/browse/KSA-1 |
