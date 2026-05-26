# Business Requirements Document (BRD)

## Kiro SDLC Agents — KSA-8: Code Indexer — Java version

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-8 |
| Title | Code Indexer — Java version |
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
| 1.0 | 2026-05-10 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-8 and linked tickets |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This document captures the business requirements for building a standalone **Code Indexer** implemented in Java (JDK 17+). The indexer is designed to parse and index source code files within a project workspace, enabling downstream tools (such as AI agents and code intelligence features) to perform fast symbol lookups, code search, and dependency analysis.

The key constraint is **zero external dependencies** — the tool must run using only the standard JDK 17+ libraries, with simple `run.bat` and `run.sh` wrapper scripts for cross-platform execution.

**Note:** Per the resolution comment on KSA-8, the standalone Java indexer functionality was ultimately absorbed into the MCP server's `IndexingEngine`. This BRD documents the original requirements as specified.

### 1.2 Out of Scope

- IDE plugin integration (handled by separate tickets)
- Language-specific deep semantic analysis beyond basic indexing
- Cloud-hosted indexing service
- Support for JDK versions below 17

### 1.3 Preliminary Requirement

- JDK 17+ must be installed on the target machine
- Source code workspace must be accessible on the local filesystem

---

## 2. Business Requirements

### 2.1 High Level Process Map

The Code Indexer follows a simple pipeline:

1. **Input**: User invokes `run.bat` (Windows) or `run.sh` (Linux/Mac) pointing to a project directory
2. **Scanning**: Indexer recursively scans source files in the workspace
3. **Parsing**: Extracts symbols (classes, functions, methods, interfaces) from each file
4. **Indexing**: Builds an in-memory index of symbols with file locations
5. **Output**: Persists the index to a local database/file for consumption by other tools

```mermaid
flowchart LR
    A[User runs script] --> B[Scan workspace files]
    B --> C[Parse source files]
    C --> D[Extract symbols]
    D --> E[Build index]
    E --> F[Persist to disk]
```

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer, I want a zero-dependency Java code indexer so that I can index my project without installing additional tools | MUST HAVE | KSA-8 |
| 2 | As a developer, I want cross-platform run scripts (bat/sh) so that I can execute the indexer on any OS | MUST HAVE | KSA-8 |
| 3 | As a developer, I want all source files to be ≤200 lines so that the codebase remains maintainable | SHOULD HAVE | KSA-8 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** Developer clones or opens a project workspace

**Step 2:** Developer runs `run.bat` (Windows) or `run.sh` (Linux/Mac) from the indexer directory, passing the target project path as argument

**Step 3:** The indexer scans the project directory recursively, identifying source code files by extension

**Step 4:** For each source file, the indexer parses and extracts code symbols (classes, functions, methods, interfaces, variables)

**Step 5:** The indexer builds a searchable index structure mapping symbols to file locations (file path, line number)

**Step 6:** The index is persisted to a local file (e.g., SQLite DB or JSON) for consumption by downstream tools

**Step 7:** The indexer reports completion status (files scanned, symbols indexed, errors encountered)

---

#### STORY 1: Zero-Dependency Java Code Indexer

> As a developer, I want a zero-dependency Java code indexer so that I can index my project without installing additional tools

**Requirement Details:**

1. The indexer must be implemented using only JDK 17+ standard libraries — no Maven/Gradle dependencies
2. Must compile and run with a simple `javac` + `java` command chain
3. Must handle common source file types (Java, TypeScript, Python, etc.)
4. Must produce a persistent index that can be queried by other tools

**Acceptance Criteria:**

1. Zero external dependencies — only JDK 17+ standard library used
2. `run.bat` and `run.sh` wrapper scripts provided for easy execution
3. All implementation files are ≤200 lines each
4. Indexer is tested and working on a sample project

**Validation Rules:**

- No `pom.xml`, `build.gradle`, or other dependency management files required
- All `.java` files must be ≤200 lines (enforced by code review)
- JDK version check at startup — fail gracefully if JDK < 17

**Error Handling:**

- File not found: Log warning and skip, continue indexing remaining files
- Parse error: Log warning with file path and line number, continue with next file
- Permission denied: Log error, skip file, report in summary

---

#### STORY 2: Cross-Platform Run Scripts

> As a developer, I want cross-platform run scripts (bat/sh) so that I can execute the indexer on any OS

**Requirement Details:**

1. `run.bat` for Windows execution
2. `run.sh` for Linux/macOS execution
3. Scripts should handle JDK detection, compilation (if needed), and execution
4. Scripts should accept project path as command-line argument

**Acceptance Criteria:**

1. `run.bat` works on Windows 10+ with JDK 17+
2. `run.sh` works on Linux/macOS with JDK 17+
3. Scripts provide clear error messages if JDK is not found
4. Scripts accept at least one argument: the target project directory path

---

#### STORY 3: Maintainable Codebase (≤200 Lines per File)

> As a developer, I want all source files to be ≤200 lines so that the codebase remains maintainable

**Requirement Details:**

1. Each Java source file must not exceed 200 lines
2. Functionality should be decomposed into small, focused classes
3. Clear separation of concerns: scanning, parsing, indexing, persistence

**Acceptance Criteria:**

1. No single `.java` file exceeds 200 lines (including comments and blank lines)
2. Code is organized into logical packages/modules
3. Each class has a single responsibility

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| JDK 17+ | System | N/A | Required runtime environment |
| Epic KSA-1 | Project | KSA-1 | Parent epic — Kiro SDLC Agents VS Code/Kiro Extension |
| MCP Server IndexingEngine | System | N/A | Functionality was absorbed into this component (per resolution) |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Reporter | Duc Nguyen | Requirements definition, review | Ticket reporter |
| Resolver | Duc Nguyen Minh | Implementation decision (absorbed into MCP server) | Comment author |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Zero-dependency constraint limits parsing capability | Medium | Medium | Focus on regex/pattern-based parsing for common languages |
| 200-line limit may force over-decomposition | Low | Low | Use clear package structure to maintain cohesion |
| Standalone indexer may become redundant if MCP server handles indexing | High | High (realized) | Absorbed into MCP IndexingEngine per resolution |

### 5.2 Assumptions

- JDK 17+ is available on all target developer machines
- Source files use UTF-8 encoding
- Project directories are accessible on local filesystem (no remote/network drives required)
- The indexer does not need real-time/watch mode — batch execution is sufficient

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Index a medium project (1000 files) in under 30 seconds | Batch processing, no real-time requirement |
| Portability | Run on Windows, Linux, macOS | Via run.bat/run.sh wrappers |
| Maintainability | All files ≤200 lines | Explicit acceptance criterion |
| Reliability | Graceful error handling | Skip problematic files, report summary |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-8 | Code Indexer — Java version | Done | Task | Main ticket |
| KSA-1 | Kiro SDLC Agents — VS Code/Kiro Extension | Done | Epic | Parent epic |

---

## 8. Appendix

### Resolution Note

Per comment by Duc Nguyen Minh (2026-05-20): "Indexing absorbed by MCP server IndexingEngine. Standalone Java indexer no longer needed." The ticket was resolved as Done with the understanding that the functionality lives within the MCP server rather than as a standalone tool.

### Glossary

| Term | Definition |
|------|------------|
| Code Indexer | A tool that scans source code and builds a searchable index of symbols |
| MCP Server | Model Context Protocol server — the runtime that hosts code intelligence tools |
| IndexingEngine | The component within the MCP server that handles code indexing |
| JDK | Java Development Kit |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| Jira Ticket KSA-8 | https://jiraassist.atlassian.net/browse/KSA-8 |
| Parent Epic KSA-1 | https://jiraassist.atlassian.net/browse/KSA-1 |
