# Technical Design Document (TDD)

## Kiro SDLC Agents — KSA-3: Injector — Copy Resources to Workspace

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-3 |
| Title | Injector — Copy Resources to Workspace |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2025-01-20 |
| Status | Draft |
| Related BRD | documents/KSA-3/BRD.md |
| Related FSD | documents/KSA-3/FSD.md |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | SA Agent – Solution Architect | Create document |
| Peer Reviewer | SM Agent – Scrum Master | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-20 | SA Agent | Initiate document — auto-generated from BRD and FSD |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the technical design in this TDD |
| | ☐ I agree and confirm the technical design in this TDD |

---

## 1. Introduction

> **Scope Boundary:** This TDD specifies HOW to implement the requirements defined in the FSD. It does NOT repeat functional requirements, business rules, use cases, or UI specifications — refer to the FSD for those. This document focuses on: technology choices, architecture decisions, implementation patterns, and deployment concerns.

### 1.1 Purpose

This TDD defines the technical design for the **Injector** module of the Kiro SDLC Agents VS Code extension. The Injector is responsible for copying pre-packaged resource files (agents, steering rules, hooks, document templates, and code intelligence indexer scripts) from the extension's bundled `resources/` directory into the user's workspace. It provides full injection, selective injection, filtered copy for indexer scripts, and status checking.

### 1.2 Scope

This document covers:
- Module architecture within the VS Code extension
- File copy algorithms (recursive with exclusions, filtered)
- VS Code API integration (QuickPick, notifications, workspace resolution)
- Configuration data model (Component interface, CORE_COMPONENTS, INDEXER_OPTIONS)
- Error handling strategy
- Cross-platform path handling
- Integration with Extension Core (KSA-2) and Indexer Runner

### 1.3 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | ^5.4.0 |
| Runtime | VS Code Extension Host (Node.js) | Node 18+ |
| Target IDE | VS Code | ^1.85.0 |
| File I/O | Node.js `fs` (sync) | Built-in |
| UI | VS Code QuickPick API | Built-in |
| Build Tool | TypeScript Compiler (tsc) | ^5.4.0 |
| Packaging | vsce | ^2.24.0 |

### 1.4 Design Principles

- **Zero external dependencies** — Only Node.js stdlib (`fs`, `path`) and VS Code API
- **Synchronous file I/O** — Uses `fs.*Sync` methods for simplicity and atomicity within a single component copy
- **Fail-soft per component** — One component failure does not abort remaining copies
- **Single Responsibility** — `injector.ts` handles copy logic; `config.ts` holds data; `extension.ts` handles commands
- **Cross-platform** — Uses `path.join()` for all path construction; no hardcoded separators

### 1.5 Constraints

- Must run within VS Code Extension Host process (no separate process for file operations)
- No async file I/O — current implementation uses synchronous `fs` for simplicity
- No file merge — overwrite-only semantics (v1.0)
- No progress reporting for individual files — only component-level success/failure
- Extension must be bundled with all resources in `resources/` directory at publish time

### 1.6 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-3/BRD.md |
| FSD | documents/KSA-3/FSD.md |
| VS Code Extension API | https://code.visualstudio.com/api |
| Node.js fs module | https://nodejs.org/api/fs.html |

---

## 2. System Architecture

### 2.1 Architecture Overview

The Injector module operates within the VS Code Extension Host process. It is a pure TypeScript module with no external dependencies beyond Node.js stdlib and VS Code API. The architecture follows a simple layered pattern:

1. **Command Layer** (`extension.ts`) — Registers VS Code commands, handles user confirmation, invokes injector functions
2. **Injection Logic Layer** (`injector.ts`) — Orchestrates component injection, implements copy algorithms
3. **Configuration Layer** (`config.ts`) — Defines component metadata, paths, and filter lists

