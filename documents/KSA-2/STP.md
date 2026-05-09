# Software Test Plan (STP)

## Kiro SDLC Agents Extension — KSA-2: Extension Core — Commands & Activation

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-2 |
| Title | Extension Core — Commands & Activation |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-01-20 |
| Status | Draft |
| Related BRD | documents/KSA-2/BRD.md |
| Related FSD | documents/KSA-2/FSD.md |
| Related TDD | documents/KSA-2/TDD.md |

---

## Author Tracking

| Role | Name - Position | Responsibility |
|------|-----------------|----------------|
| Author | QA Agent – QA Engineer | Create document |
| Peer Reviewer | SA Agent – Solution Architect | Review document |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-20 | QA Agent | Initiate document — auto-generated from BRD, FSD, and TDD |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm the test plan in this STP |
| | ☐ I agree and confirm the test plan in this STP |

---

## 1. Introduction

### 1.1 Purpose

This test plan defines the testing strategy, scope, schedule, and resources for verifying the **Extension Core — Commands & Activation** component (KSA-2) of the Kiro SDLC Agents VS Code extension. The component is responsible for extension activation on startup, 5 Command Palette commands, a status bar indicator, and confirmation dialogs before destructive operations.

### 1.2 Test Objectives

- Verify extension activates on VS Code startup without errors (BRD Story 1)
- Validate all 5 commands are registered and functional in Command Palette (BRD Story 2)
- Confirm status bar displays correct visual state based on workspace health (BRD Story 3)
- Ensure confirmation dialogs prevent accidental file modifications (BRD Story 4)
- Validate graceful degradation when no workspace is open (BR-3, BR-5)
- Verify non-functional requirements: activation < 100ms, command response < 2s (FSD Section 8)

### 1.3 References

| Document | Location |
|----------|----------|
| BRD | documents/KSA-2/BRD.md |
| FSD | documents/KSA-2/FSD.md |
| TDD | documents/KSA-2/TDD.md |
| Source Code | kiro-sdlc-agents/src/ (extension.ts, config.ts, injector.ts, indexer.ts) |

---

## 2. Test Strategy

### 2.1 Test Levels

| Level | Scope | Automation | Tools |
|-------|-------|------------|-------|
| UT | Unit tests — individual functions (config, injector helpers, indexer helpers) | Automated | vitest + vscode-test mock |
| IT | Integration tests — VS Code Extension Test Host (activate, commands, status bar) | Automated | @vscode/test-electron |
| SIT | Manual exploratory — full VS Code with real workspace | Manual | VS Code IDE |

### 2.2 Test Types

| Type | Description | Applicable |
|------|-------------|------------|
| Functional Testing | Verify commands, activation, status bar per FSD use cases | Yes |
| Regression Testing | Ensure existing VS Code functionality not broken | Yes |
| Performance Testing | Verify activation < 100ms, command response < 2s | Yes |
| Security Testing | Verify file system safety (no directory traversal) | Yes |
| Usability Testing | Verify command discoverability, status bar clarity | Yes |
| Compatibility Testing | VS Code ^1.85.0 + Kiro IDE | Yes |

### 2.3 Test Approach

- **Unit Tests (UT):** Mock `vscode` API using `vitest` with manual mocks. Test pure logic in `config.ts`, file copy helpers in `injector.ts`, and runtime detection in `indexer.ts`.
- **Integration Tests (IT):** Use `@vscode/test-electron` to launch a real VS Code instance with the extension loaded. Verify command registration, status bar creation, and dialog interactions.
- **Manual SIT:** Exploratory testing in a real VS Code workspace to verify visual states, user experience, and edge cases that cannot be automated.

### 2.4 Entry Criteria

| Level | Entry Criteria |
|-------|---------------|
| UT | Source code compiled without errors (`tsc -p ./` passes) |
| IT | Extension packaged successfully, test workspace prepared |
| SIT | IT tests pass with 0 Critical defects, extension installed in VS Code |

### 2.5 Exit Criteria

| Level | Exit Criteria |
|-------|--------------|
| UT | 100% test cases executed, all pass, code coverage ≥ 80% |
| IT | 100% test cases executed, 0 Critical/Major defects |
| SIT | All SIT scenarios executed, 0 Critical defects, ≤ 1 Major defect open |

---

## 3. Test Scope

### 3.1 Features In Scope

| # | Feature / Story | Priority | FSD Reference | Test Type |
|---|----------------|----------|---------------|-----------|
| 1 | Extension Activation on Startup | High | UC-1, BR-1, BR-2, BR-3 | UT + IT + SIT |
| 2 | Command Palette — Inject All | High | UC-2a, BR-5, BR-8, BR-12 | UT + IT + SIT |
| 3 | Command Palette — Inject Selective | High | UC-2b, BR-5, BR-10 | UT + IT + SIT |
| 4 | Command Palette — Run Code Indexer | High | UC-2c, BR-5, BR-11 | UT + IT + SIT |
| 5 | Command Palette — Update Agents | High | UC-2d, BR-5, BR-9 | UT + IT + SIT |
| 6 | Command Palette — Show Status | Medium | UC-2e, BR-5 | UT + IT + SIT |
| 7 | Status Bar Indicator (3 states) | High | UC-3, BR-13–BR-17 | IT + SIT |
| 8 | Confirmation Dialogs | High | UC-4, BR-18–BR-23 | UT + IT + SIT |

### 3.2 Features Out of Scope

| # | Feature | Reason |
|---|---------|--------|
| 1 | File injection logic (copy operations) | Covered by KSA-3 |
| 2 | Indexer language selection UI details | Covered by KSA-4 |
| 3 | Runtime detection & indexer execution internals | Covered by KSA-5 |
| 4 | Bundled resource file content | Covered by KSA-6 |
| 5 | Individual indexer script correctness | Covered by KSA-7 through KSA-10 |
| 6 | Marketplace publishing | Covered by KSA-11 |

---

## 4. Test Environment

### 4.1 Environment Requirements

| Environment | Setup | Purpose |
|-------------|-------|---------|
| UT | Node.js 20.x + vitest + vscode mock | Unit test execution |
| IT | VS Code ^1.85.0 + @vscode/test-electron | Integration test with real Extension Host |
| SIT | VS Code ^1.85.0 (or Kiro IDE) + extension installed | Manual testing |

### 4.2 OS / Platform Requirements

| Platform | Version | Required |
|----------|---------|----------|
| Windows 10/11 | Latest | Yes |
| macOS | 13+ | Optional (CI) |
| Linux (Ubuntu) | 22.04+ | Optional (CI) |

### 4.3 Test Data Requirements

| Data Type | Description | Preparation |
|-----------|-------------|-------------|
| Empty workspace | Folder with no SDLC components | Create empty temp directory |
| Full workspace | Folder with all SDLC components present | Pre-inject all components |
| Partial workspace | Folder with some components missing | Delete specific component folders |
| Extension bundle | `/resources/` directory with all SDLC resources | Built-in with extension |

### 4.4 External Dependencies

| System | Dependency | Mock/Stub Available |
|--------|-----------|---------------------|
| VS Code Extension API | vscode module | Yes — `@vscode/test-electron` or manual mock |
| Node.js `fs` module | File system operations | Yes — `memfs` or temp directories |
| Node.js `child_process` | Indexer execution | Yes — mock `exec` in UT |
| System runtimes (Python, Java, etc.) | Indexer detection | Yes — mock `commandExists()` |

---

## 5. Test Schedule

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Test Planning (STP + STC) | 1 day | STP + STC approved |
| Unit Test Development | 2 days | UT suite complete |
| Integration Test Development | 2 days | IT suite complete |
| Test Execution (UT + IT) | 1 day | Automated tests pass |
| SIT Execution | 1 day | SIT sign-off |
| Defect Fix & Retest | 1 day | All Critical/Major fixed |

---

## 6. Resources & Responsibilities

| Role | Name | Responsibility |
|------|------|---------------|
| Test Lead | QA Agent | Test planning, coordination, reporting |
| QA Engineer | QA Agent | Test case design, execution, defect reporting |
| Developer | DEV Agent | Bug fixing, unit test implementation |
| SA | SA Agent | Technical clarification, TDD review |

---

## 7. Risk & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | VS Code API mock incomplete | High | Medium | Use `@vscode/test-electron` for IT level; mock only for UT |
| 2 | Extension Host behavior differs between VS Code and Kiro | Medium | Low | Test on both platforms in SIT |
| 3 | File system permissions vary across OS | Medium | Low | Test on Windows (primary) + CI on Linux/Mac |
| 4 | Indexer runtime not available on test machine | Low | Medium | Mock runtime detection in UT/IT; test real runtimes in SIT |

---

## 8. Defect Management

### 8.1 Severity Levels

| Severity | Definition | Example |
|----------|-----------|---------|
| Critical | Extension fails to activate, commands not registered | `activate()` throws unhandled exception |
| Major | Command does not work, status bar shows wrong state | `injectAll` proceeds without confirmation |
| Minor | Tooltip text incorrect, icon slightly wrong | Tooltip says "active" when components missing |
| Trivial | Typo in success message | "Injeted" instead of "Injected" |

### 8.2 Priority Levels

| Priority | Definition | SLA (Fix Time) |
|----------|-----------|----------------|
| P1 | Must fix immediately | 4 hours |
| P2 | Must fix before release | 1 business day |
| P3 | Should fix if time permits | 3 business days |
| P4 | Nice to fix, can defer | Next release |

### 8.3 Defect Lifecycle

```
New → Open → In Progress → Fixed → Ready for Retest → Verified → Closed
                                                     → Reopened → In Progress
```

---

## 9. Test Metrics & Reporting

### 9.1 Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Test Execution Rate | Executed / Total × 100% | 100% |
| Pass Rate | Passed / Executed × 100% | ≥ 95% |
| Defect Density | Defects / Test Cases | ≤ 0.1 |
| Critical Defect Count | Count of Critical severity | 0 |
| Code Coverage (UT) | Lines covered / Total lines × 100% | ≥ 80% |

### 9.2 Test Cases Summary

| Level | Count | Automated | Manual |
|-------|-------|-----------|--------|
| UT | 20 | 20 | 0 |
| IT | 12 | 12 | 0 |
| SIT | 8 | 0 | 8 |
| **Total** | **40** | **32 (80%)** | **8 (20%)** |

---

## 10. Appendix

### Glossary

| Term | Definition |
|------|------------|
| UT | Unit Testing |
| IT | Integration Testing (VS Code Extension Test) |
| SIT | System Integration Testing (Manual) |
| Command Palette | VS Code UI (Ctrl+Shift+P) for command discovery |
| Status Bar | Bottom bar in VS Code showing contextual info |
| Codicon | VS Code built-in icon set |

### Assumptions

- VS Code ^1.85.0 supports `activationEvents: []` for startup activation
- `@vscode/test-electron` can simulate command execution and dialog responses
- Test machine has at least one indexer runtime (Python recommended) for SIT
- Extension bundle `/resources/` directory is populated before testing

---

*End of Document*
