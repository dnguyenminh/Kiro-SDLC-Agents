# Technical Design Document (TDD)

## Kiro SDLC Agents — KSA-13: Release v1.0.3 — SM agent project-level workflow + jira.conf management

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-13 |
| Title | Release v1.0.3 — SM agent project-level workflow + jira.conf management |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-10 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-13.docx |
| Related FSD | FSD-v1-KSA-13.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-10 | SA Agent | Initial TDD |

---

## 1. Architecture Overview

### 1.1 System Architecture

The SM agent is implemented as a prompt-based agent within the Kiro SDLC Agents VS Code extension. It does not have traditional compiled code — instead, it operates through a structured prompt that defines its behavior. The "implementation" consists of:

1. **SM Agent Prompt** — A markdown file containing the full behavioral specification
2. **Extension Infrastructure** — TypeScript code that loads and serves agent prompts
3. **Sync Script** — PowerShell script that keeps prompts consistent across locations

![Architecture Diagram](diagrams/architecture.png)

### 1.2 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Extension | TypeScript + VS Code Extension API | Package and distribute agents |
| Agent Prompts | Markdown (.md) | Define agent behavior |
| Build | TypeScript Compiler (tsc) | Compile extension source |
| Package | vsce (VS Code Extension CLI) | Create VSIX package |
| Sync | PowerShell | Synchronize prompts across locations |
| Config | Plain text (KEY=VALUE) | jira.conf format |

### 1.3 Component Architecture

![Component Diagram](diagrams/component.png)

---

## 2. Detailed Design

### 2.1 Input Parsing Module (within SM Prompt)

**Location:** SM agent prompt, section "Input Parsing"

**Design:**

The input parsing is declarative (regex-based rules in the prompt). The SM agent (LLM) interprets these rules at runtime:

```
Rule 1: If input matches [A-Z][A-Z0-9_]+-\d+ → Ticket-level
  Extract: ticket_key, action (optional)
  
Rule 2: If input matches [A-Z][A-Z0-9_]+ + whitespace + action → Project-level
  Extract: project_key, action
  
Rule 3: Neither → Error response
```

**Constraints & Edge Cases:**

| Case | Input Example | Behavior | Rationale |
|------|---------------|----------|-----------|
| Single-char key | `A workflow` | ❌ Rejected | Regex requires ≥2 uppercase chars (`[A-Z][A-Z0-9_]+`) |
| Lowercase | `ksa workflow` | ❌ Rejected | Project keys are always uppercase in Jira |
| Key with underscore | `MY_PROJ workflow` | ✅ Accepted | Jira supports underscores in project keys |
| Ticket without action | `KSA-13` | ✅ Ticket-level | Action defaults to "full pipeline" |
| Project without action | `KSA` (no action) | ❌ Rejected | Project-level requires explicit action keyword |
| Ambiguous: key looks like project | `KSA13` (no dash) | ✅ Project-level | No `-\d+` pattern → falls to Rule 2 |

**Pseudocode:**
```
function parseInput(input: string):
  // Try ticket pattern first (more specific)
  ticketMatch = input.match(/^([A-Z][A-Z0-9_]+-\d+)\s*(.*)$/)
  if ticketMatch:
    return { type: "ticket", key: ticketMatch[1], action: ticketMatch[2].trim() }
  
  // Try project pattern (requires action keyword after key)
  projectMatch = input.match(/^([A-Z][A-Z0-9_]+)\s+(.+)$/)
  if projectMatch:
    return { type: "project", key: projectMatch[1], action: projectMatch[2].trim() }
  
  // Invalid
  return { type: "error", message: "Input không hợp lệ" }
```

### 2.2 jira.conf Management Module

**Location:** SM agent prompt, section "jira.conf Management"

**File Operations:**

| Operation | Tool Used | Details |
|-----------|-----------|---------|
| Check existence | `readFile` | Try to read, handle "not found" |
| Read content | `readFile` | Parse KEY=VALUE format |
| Create file | `fs_write` | Write comment header + prefix |
| Update file | `fs_write` | Overwrite with new prefix |

**Parse Logic:**
```
function parseJiraConf(content: string):
  lines = content.split('\n')
  for line in lines:
    if line.startsWith('#') or line.trim() == '':
      continue
    if line.startsWith('JIRA_PROJECT_PREFIX='):
      return line.split('=')[1].trim()
  return null  // invalid format
```

**Conflict Resolution Flow:**
```
function manageJiraConf(inputKey: string):
  content = readFile("jira.conf")
  
  if content == null:  // file doesn't exist
    writeFile("jira.conf", generateContent(inputKey))
    return "created"
  
  currentKey = parseJiraConf(content)
  
  if currentKey == inputKey:
    return "match"
  
  // Conflict — ask user
  response = askUser(
    "⚠️ jira.conf hiện tại có JIRA_PROJECT_PREFIX={currentKey}.\n" +
    "Bạn muốn đổi sang {inputKey}?\n" +
    "1. Đổi sang {inputKey}\n" +
    "2. Giữ nguyên {currentKey}"
  )
  
  if response == "1":
    writeFile("jira.conf", generateContent(inputKey))
    return "updated"
  else:
    return "cancelled"
```

### 2.3 Project Query Module

**Location:** SM agent prompt, section "Project-level Workflow"

**Integration with Jira MCP:**
```
function queryProjectTickets(projectKey: string):
  jql = 'project = "{projectKey}" ORDER BY key ASC'
  result = jira_search(jql=jql, limit=50, fields="summary,status,issuetype,labels,priority")
  
  if result.error:
    return fallbackToLocalScan(projectKey)
  
  tickets = []
  for issue in result.issues:
    docsStatus = checkDocsStatus(issue.key)
    tickets.append({
      key: issue.key,
      summary: issue.fields.summary,
      jiraStatus: issue.fields.status.name,
      docsStatus: docsStatus
    })
  
  return tickets
```

**Docs Status Check:**
```
function checkDocsStatus(ticketKey: string):
  statusFile = "documents/{ticketKey}/STATUS.json"
  
  if exists(statusFile):
    status = readJSON(statusFile)
    if status.phases.design.status == "done":
      return "✅ Complete"
    elif status.phases.requirements.status == "done":
      return "🔄 Partial"
    else:
      return "❌ No docs"
  
  // Fallback: scan files
  hasBRD = exists("documents/{ticketKey}/BRD.md")
  hasFSD = exists("documents/{ticketKey}/FSD.md")
  hasTDD = exists("documents/{ticketKey}/TDD.md")
  
  if hasBRD and hasFSD and hasTDD:
    return "✅ Complete"
  elif hasBRD or hasFSD or hasTDD:
    parts = []
    if hasBRD: parts.append("BRD")
    if hasFSD: parts.append("FSD")
    if hasTDD: parts.append("TDD")
    return "🔄 Partial ({', '.join(parts)})"
  else:
    return "❌ No docs"
```

---

## 3. File Structure

### 3.1 Files Modified in This Release

| # | File | Change Type | Description |
|---|------|-------------|-------------|
| 1 | `kiro-sdlc-agents/resources/.kiro/agents/sm-agent.md` | Modified | Add project-level workflow + jira.conf sections |
| 2 | `kiro-sdlc-agents/resources/.kiro/agents/prompts/sm-agent.md` | Modified | Same content (synced) |
| 3 | `.kiro/agents/sm-agent.md` | Modified | Same content (synced via script) |
| 4 | `.kiro/agents/prompts/sm-agent.md` | Modified | Same content (synced) |
| 5 | `jira.conf` | Modified | Corrected prefix from ICL2 to KSA, removed JIRA_BASE_URL |
| 6 | `kiro-sdlc-agents/CHANGELOG.md` | Modified | Added v1.0.3 entry |
| 7 | `kiro-sdlc-agents/package.json` | Modified | Version bumped to 1.0.3 |
| 8 | `kiro-sdlc-agents/resources/.sdlc-checksums.json` | Modified | Regenerated checksums |

### 3.2 File Sync Architecture

```
Source of Truth:
  .kiro/agents/sm-agent.md  (workspace — edited directly)
    │
    ├── copy-resources.js ──→ kiro-sdlc-agents/resources/.kiro/agents/sm-agent.md
    │                          (bundled in VSIX)
    │
    └── copy-resources.js ──→ kiro-sdlc-agents/resources/.kiro/agents/prompts/sm-agent.md
                               (prompt library)
```

### 3.3 Class Diagram

> **N/A** — This feature is prompt-based (SM agent behavior defined in markdown), not compiled code with class hierarchies. The "implementation" is declarative rules within the agent prompt file. No new TypeScript classes, interfaces, or functions are introduced in extension source code.

---

## 4. Security Design

### 4.1 jira.conf Security

| Concern | Mitigation |
|---------|-----------|
| Sensitive data exposure | jira.conf only stores project prefix (e.g., "KSA") — no URLs, tokens, or credentials |
| Unauthorized modification | File is local to workspace, protected by OS file permissions |
| Accidental commit | File should be in .gitignore (open issue — see FSD §8) |

### 4.2 Jira MCP Security

| Concern | Mitigation |
|---------|-----------|
| Authentication | Handled by MCP server configuration (external to SM agent) |
| Data access | SM only reads ticket metadata (summary, status) — no sensitive fields |
| Rate limiting | Single query per invocation, max 50 results |

---

## 5. Error Handling

| Error | Detection | Recovery | User Message |
|-------|-----------|----------|--------------|
| jira.conf not found | File read returns null/error | Create new file | (Silent — auto-creates) |
| jira.conf invalid format | Parse returns null | Offer to recreate | "⚠️ jira.conf format không hợp lệ. Tạo lại?" |
| Jira MCP unavailable | API call returns error/timeout | Fallback to local scan | "⚠️ Không thể kết nối Jira. Hiển thị status từ local files." |
| No tickets found | Empty result set | Report to user | "Project {KEY} không có tickets nào" |
| File write failure | Write operation throws | Report error | "Không thể ghi jira.conf. Kiểm tra quyền truy cập." |

---

## 6. Testing Strategy

### 6.1 Test Scenarios

| # | Scenario | Expected Result |
|---|----------|-----------------|
| 1 | Input "KSA workflow" with no jira.conf | Creates jira.conf, queries tickets, shows overview |
| 2 | Input "KSA workflow" with matching jira.conf | Proceeds directly to query |
| 3 | Input "KSA workflow" with jira.conf = ICL2 | Shows conflict warning, asks user |
| 4 | Input "KSA-13 tạo BRD" | Routes to ticket-level (backward compatible) |
| 5 | Input "KSA status" | Shows overview without action proposals |
| 6 | Jira MCP unavailable | Falls back to local file scan |
| 7 | Project with 0 tickets | Reports "no tickets found" |
| 8 | Project with 50+ tickets | Shows first 50, indicates more exist |

### 6.2 Verification Method

Since the SM agent is prompt-based (not compiled code), testing is done through:
1. **Manual invocation** — Run SM agent with various inputs
2. **Prompt review** — Verify prompt contains correct logic
3. **Checksum verification** — Ensure all 4 locations have identical content
4. **VSIX installation test** — Install extension, verify agent loads correctly

---

## 7. Deployment

### 7.1 Release Steps (Already Completed)

| Step | Command/Action | Status |
|------|---------------|--------|
| 1 | Update SM prompt in source | ✅ |
| 2 | Run `sync-from-source.ps1` | ✅ |
| 3 | Update `package.json` version | ✅ |
| 4 | Update `CHANGELOG.md` | ✅ |
| 5 | `npx tsc` (compile) | ✅ |
| 6 | Regenerate `.sdlc-checksums.json` | ✅ |
| 7 | `npx vsce package` | ✅ |
| 8 | `git add -A && git commit -m "KSA-13: Release v1.0.3"` | ✅ |
| 9 | `git tag v1.0.3 && git push --tags` | ✅ |
| 10 | Verify on Marketplace | ⏳ Pending |

### 7.2 Rollback Plan

If issues found after release:
1. `git revert HEAD` (revert release commit)
2. Bump version to 1.0.4 with fix
3. Re-package and re-publish

---

## 8. Implementation Checklist

| # | Task | File(s) | Complexity |
|---|------|---------|-----------|
| 1 | Add "Input Parsing" section to SM prompt | sm-agent.md | Low |
| 2 | Add "jira.conf Management" section to SM prompt | sm-agent.md | Medium |
| 3 | Add "Project-level Workflow" section to SM prompt | sm-agent.md | Medium |
| 4 | Add "Interactive Guidance" section to SM prompt | sm-agent.md | Low |
| 5 | Update jira.conf (fix ICL2 → KSA, remove JIRA_BASE_URL) | jira.conf | Trivial |
| 6 | Sync prompts to all 4 locations | copy-resources.js | Low |
| 7 | Compile TypeScript | npx tsc | Trivial |
| 8 | Regenerate checksums | node scripts/gen-checksums.js | Low |
| 9 | Package VSIX | npx vsce package | Trivial |
| 10 | Tag and push | git tag v1.0.3 && git push --tags | Trivial |

---

## 9. Appendix

### 9.1 Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture Overview | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component Diagram | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
