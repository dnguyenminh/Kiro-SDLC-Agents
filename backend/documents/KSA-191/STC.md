# Software Test Cases (STC)

## mcp-code-intelligence-nodejs — KSA-191: Salesforce Language Support (v2 — Extend Existing Tools)

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-191 |
| Title | Salesforce Language Support — Extend Existing Tools |
| Author | QA Agent |
| Version | 2.0 |
| Date | 2026-06-02 |
| Status | Draft |
| Related STP | STP-v2-KSA-191.docx |
| Related FSD | FSD-v2-KSA-191.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-27 | QA Agent | Initial (v1 - 3 MCP servers) - SUPERSEDED |
| 2.0 | 2026-06-02 | QA Agent | Complete rewrite for v2 approach |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| PBT - Property-Based Tests | PBT-001 to PBT-008 | 8 | High |
| UT - Unit Tests | UT-001 to UT-024 | 24 | High |
| IT - Integration Tests | IT-001 to IT-018 | 18 | High |
| E2E-API - Enhanced Tool Tests | E2E-001 to E2E-028 | 28 | High |
| E2E-UI - Extension Command | UI-001 to UI-004 | 4 | High |
| SIT - Manual Exploratory | SIT-001 to SIT-005 | 5 | Medium |
| **Total** | | **87** | |

---

## 1. Property-Based Tests (PBT)

### PBT-001: ApexParser always produces valid ParseResult for any .cls content

| Field | Value |
|-------|-------|
| **ID** | PBT-001 |
| **Level** | PBT |
| **Priority** | High |
| **Requirement** | BR-05, TDD S5.6 |
| **Property** | For any string input to ApexParser.parse(), result is a valid ParseResult (never throws) |

**Generator:** Random ASCII strings (0-10000 chars), valid Apex snippets, fuzz mutations
**Invariants:**
- Result has `symbols` array (may be empty)
- Result has `errors` array (populated for invalid input)
- No uncaught exceptions
- Return type matches `ParseResult` interface

---

### PBT-002: ApexParser symbol count monotonically increases with valid code additions

| Field | Value |
|-------|-------|
| **ID** | PBT-002 |
| **Level** | PBT |
| **Priority** | High |
| **Requirement** | BR-05, BR-06 |
| **Property** | Adding a valid method to a class file -> symbol count increases by >=1 |

**Generator:** Base valid Apex class + random valid method signatures appended
**Invariants:**
- symbols.length(extended) >= symbols.length(base)
- New method appears in symbols array

---

### PBT-003: SalesforceMetaParser produces valid result for any XML input

| Field | Value |
|-------|-------|
| **ID** | PBT-003 |
| **Level** | PBT |
| **Priority** | High |
| **Requirement** | BR-29, TDD S5.6 |
| **Property** | For any string input to SalesforceMetaParser.parse(), returns ParseResult without throwing |

**Generator:** Random XML-like strings, valid Flow XML, fuzz mutations
**Invariants:**
- Never throws - returns partial result with errors[]
- Server remains responsive after parse

---

### PBT-004: SfdxDetector.detect() returns null or valid SfdxProject

| Field | Value |
|-------|-------|
| **ID** | PBT-004 |
| **Level** | PBT |
| **Priority** | High |
| **Requirement** | BR-01, UC-01 |
| **Property** | For any directory path, detect() returns null or SfdxProject (never throws) |

**Generator:** Random directory structures with/without sfdx-project.json
**Invariants:**
- Result is null OR has valid `root`, `packageDirectories` (non-empty array)
- If sfdx-project.json missing -> always null
- If sfdx-project.json present -> always SfdxProject

---

### PBT-005: Relationship kinds are always from valid enum set

| Field | Value |
|-------|-------|
| **ID** | PBT-005 |
| **Level** | PBT |
| **Priority** | High |
| **Requirement** | BR-13, TDD S4.2 |
| **Property** | All relationships extracted by parsers have kind in SF_RELATIONSHIP_KINDS union existing kinds |

**Generator:** Random valid Apex files with various patterns (DML, SOQL, inheritance)
**Invariants:**
- Every relationship.kind is in known set
- No unknown relationship kinds produced

---

### PBT-006: Incremental indexing is idempotent

| Field | Value |
|-------|-------|
| **ID** | PBT-006 |
| **Level** | PBT |
| **Priority** | High |
| **Requirement** | BR-02, Story 1 AC3 |
| **Property** | Indexing same unchanged files twice produces identical DB state |

**Generator:** Random subset of fixture files, index twice
**Invariants:**
- symbols table row count unchanged after second index
- relationships table row count unchanged
- File hashes match

---

### PBT-007: Graph traversal terminates for any relationship graph

| Field | Value |
|-------|-------|
| **ID** | PBT-007 |
| **Level** | PBT |
| **Priority** | High |
| **Requirement** | BR-19, TDD S8 |
| **Property** | DependencyGraphService.getForwardDeps() always terminates (even with cycles) |

**Generator:** Random relationship graphs including cycles
**Invariants:**
- Function returns within 5 seconds
- No stack overflow
- Cycle detection prevents infinite traversal

---

### PBT-008: detectMetadataType is total function

| Field | Value |
|-------|-------|
| **ID** | PBT-008 |
| **Level** | PBT |
| **Priority** | Medium |
| **Requirement** | TDD S5.4 |
| **Property** | detectMetadataType(path) returns SfMetadataType or null for any string |

**Generator:** Random file paths, valid SF paths, edge cases
**Invariants:**
- Never throws
- .cls -> ApexClass, .trigger -> ApexTrigger, .flow-meta.xml -> Flow, etc.
- Unknown extensions -> null

---

## 2. Unit Tests (UT)

### UT-001: SfdxDetector.detect() with valid sfdx-project.json

| Field | Value |
|-------|-------|
| **ID** | UT-001 |
| **Level** | UT |
| **Priority** | High |
| **Requirement** | UC-01, BR-01, Story 1 |
| **Preconditions** | Fixture directory with valid sfdx-project.json |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call SfdxDetector.detect(fixturePath) | Returns SfdxProject object |
| 2 | Verify root property | Equals fixture path |
| 3 | Verify packageDirectories | Contains ["force-app"] |
| 4 | Verify configPath | Points to sfdx-project.json |

**Test Data:** tests/fixtures/sfdx-sample/sfdx-project.json with packageDirectories: [{path: "force-app"}]

---

### UT-002: SfdxDetector.detect() without sfdx-project.json

| Field | Value |
|-------|-------|
| **ID** | UT-002 |
| **Level** | UT |
| **Priority** | High |
| **Requirement** | UC-01 AF-01, BR-01 |
| **Preconditions** | Fixture directory without sfdx-project.json |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call SfdxDetector.detect(nonSfdxPath) | Returns null |
| 2 | Verify no side effects | No files created, no errors logged |

---

### UT-003: SfdxDetector.detect() with malformed JSON

| Field | Value |
|-------|-------|
| **ID** | UT-003 |
| **Level** | UT |
| **Priority** | High |
| **Requirement** | UC-01 EF-01 |
| **Preconditions** | Fixture with invalid JSON in sfdx-project.json |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call SfdxDetector.detect(malformedPath) | Returns null (graceful) |
| 2 | Verify warning logged | Warning message about malformed JSON |

---

### UT-004: ApexParser.parse() valid class

| Field | Value |
|-------|-------|
| **ID** | UT-004 |
| **Level** | UT |
| **Priority** | High |
| **Requirement** | UC-02, BR-05, BR-06, Story 2 |
| **Preconditions** | ApexParser instantiated with loaded grammar |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse AccountService.cls content | ParseResult returned |
| 2 | Verify class symbol | kind=class, name=AccountService |
| 3 | Verify modifiers | ["public", "with sharing"] |
| 4 | Verify methods extracted | getAccounts, createAccount methods found |
| 5 | Verify annotations | @AuraEnabled on getAccounts |

**Test Data:** AccountService.cls fixture with 3 methods

---

### UT-005: ApexParser.parse() trigger file

| Field | Value |
|-------|-------|
| **ID** | UT-005 |
| **Level** | UT |
| **Priority** | High |
| **Requirement** | UC-02, BR-08, Story 2 AC2 |
| **Preconditions** | ApexParser instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse AccountTrigger.trigger content | ParseResult returned |
| 2 | Verify trigger symbol | kind=trigger, name=AccountTrigger |
| 3 | Verify trigger events | ["before insert", "after update"] |
| 4 | Verify SObject reference | Account |

---

### UT-006: ApexParser.parse() malformed file (graceful degradation)

| Field | Value |
|-------|-------|
| **ID** | UT-006 |
| **Level** | UT |
| **Priority** | High |
| **Requirement** | UC-01 EF-02, TDD S5.6 |
| **Preconditions** | ApexParser instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse malformed Apex content (missing closing brace) | ParseResult returned (not thrown) |
| 2 | Verify partial symbols | Some symbols extracted before error point |
| 3 | Verify errors array | Non-empty with line/column info |

---

### UT-007: ApexParser extracts SOQL relationships

| Field | Value |
|-------|-------|
| **ID** | UT-007 |
| **Level** | UT |
| **Priority** | High |
| **Requirement** | BR-15, UC-04 |
| **Preconditions** | ApexParser instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse file with [SELECT Id FROM Account] | ParseResult returned |
| 2 | Verify relationships | Contains {kind: "soql", target: "Account"} |

---

### UT-008: ApexParser extracts DML relationships

| Field | Value |
|-------|-------|
| **ID** | UT-008 |
| **Level** | UT |
| **Priority** | High |
| **Requirement** | BR-16, UC-04 |
| **Preconditions** | ApexParser instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse file with `insert accounts;` | ParseResult returned |
| 2 | Verify relationships | Contains {kind: "dml", target: "Account", metadata: {operation: "INSERT"}} |

---

### UT-009: ApexParser extracts inheritance relationships

| Field | Value |
|-------|-------|
| **ID** | UT-009 |
| **Level** | UT |
| **Priority** | High |
| **Requirement** | BR-18, UC-04 |
| **Preconditions** | ApexParser instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse `public class AccountService extends BaseService implements IService` | ParseResult returned |
| 2 | Verify inherits relationship | {kind: "inherits", target: "BaseService"} |
| 3 | Verify implements relationship | {kind: "implements", target: "IService"} |

---

### UT-010: SalesforceMetaParser.parse() Flow XML

| Field | Value |
|-------|-------|
| **ID** | UT-010 |
| **Level** | UT |
| **Priority** | High |
| **Requirement** | UC-03, BR-10, Story 3 |
| **Preconditions** | SalesforceMetaParser instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse Account_Update.flow-meta.xml | ParseResult returned |
| 2 | Verify flow symbol | kind=flow, name=Account_Update |
| 3 | Verify flow-object relationship | {kind: "flow-object", target: "Account"} |
| 4 | Verify flow-action relationship (if Apex action present) | {kind: "flow-action", target: "ContactService"} |

---

### UT-011: SalesforceMetaParser.parse() Object XML

| Field | Value |
|-------|-------|
| **ID** | UT-011 |
| **Level** | UT |
| **Priority** | High |
| **Requirement** | UC-03, BR-10 |
| **Preconditions** | SalesforceMetaParser instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse Account.object-meta.xml | ParseResult returned |
| 2 | Verify object symbol | kind=object, name=Account |
| 3 | Verify fields extracted | Custom fields as child symbols |

---

### UT-012: SalesforceMetaParser.parse() LWC js-meta.xml

| Field | Value |
|-------|-------|
| **ID** | UT-012 |
| **Level** | UT |
| **Priority** | High |
| **Requirement** | UC-03, BR-17 |
| **Preconditions** | SalesforceMetaParser instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse accountList.js with @wire imports | ParseResult returned |
| 2 | Verify wire relationship | {kind: "wire", target: "AccountController"} |
| 3 | Verify component symbol | kind=lwc-component, name=accountList |

---

### UT-013: SalesforceMetaParser.parse() invalid XML (graceful)

| Field | Value |
|-------|-------|
| **ID** | UT-013 |
| **Level** | UT |
| **Priority** | High |
| **Requirement** | TDD S5.6 |
| **Preconditions** | SalesforceMetaParser instantiated |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse invalid XML content | ParseResult returned (not thrown) |
| 2 | Verify errors array non-empty | Contains XML parse error info |
| 3 | Verify partial results | Whatever could be extracted before error |

---

### UT-014: isSfRelationship() type guard

| Field | Value |
|-------|-------|
| **ID** | UT-014 |
| **Level** | UT |
| **Priority** | Medium |
| **Requirement** | TDD S5.4 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | isSfRelationship("trigger-on") | true |
| 2 | isSfRelationship("soql") | true |
| 3 | isSfRelationship("calls") | false (existing, not SF-specific) |
| 4 | isSfRelationship("invalid") | false |

---

### UT-015: detectMetadataType() file classification

| Field | Value |
|-------|-------|
| **ID** | UT-015 |
| **Level** | UT |
| **Priority** | Medium |
| **Requirement** | TDD S5.4 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | detectMetadataType("AccountService.cls") | ApexClass |
| 2 | detectMetadataType("AccountTrigger.trigger") | ApexTrigger |
| 3 | detectMetadataType("MyFlow.flow-meta.xml") | Flow |
| 4 | detectMetadataType("Account.object-meta.xml") | CustomObject |
| 5 | detectMetadataType("main.ts") | null |

---

### UT-016: getSfFilePaths() returns correct file list

| Field | Value |
|-------|-------|
| **ID** | UT-016 |
| **Level** | UT |
| **Priority** | High |
| **Requirement** | UC-01, Story 1 AC2 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call getSfFilePaths(sfdxConfig) with fixture | Returns array of SF file paths |
| 2 | Verify .cls files included | AccountService.cls in results |
| 3 | Verify .trigger files included | AccountTrigger.trigger in results |
| 4 | Verify .flow-meta.xml included | Account_Update.flow-meta.xml in results |
| 5 | Verify non-SF files excluded | No .ts, .js (non-LWC) files |

---

### UT-017: ApexParser extracts annotations correctly

| Field | Value |
|-------|-------|
| **ID** | UT-017 |
| **Level** | UT |
| **Priority** | High |
| **Requirement** | BR-06, Story 2 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse class with @IsTest, @AuraEnabled, @InvocableMethod | Annotations in decorators[] |
| 2 | Verify @IsTest on class level | Class symbol has @IsTest |
| 3 | Verify @AuraEnabled on method | Method symbol has @AuraEnabled |

---

### UT-018: ApexParser extracts Apex-specific modifiers

| Field | Value |
|-------|-------|
| **ID** | UT-018 |
| **Level** | UT |
| **Priority** | High |
| **Requirement** | BR-05, Story 2 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse `global with sharing class Foo` | modifiers = ["global", "with sharing"] |
| 2 | Parse `public without sharing class Bar` | modifiers = ["public", "without sharing"] |
| 3 | Parse `public virtual class Baz` | modifiers = ["public", "virtual"] |

---

### UT-019: ApexGrammarLoader loads .wasm successfully

| Field | Value |
|-------|-------|
| **ID** | UT-019 |
| **Level** | UT |
| **Priority** | High |
| **Requirement** | TDD S5.2 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call ApexGrammarLoader.load(wasmPath) | Parser instance returned |
| 2 | Verify parser can parse simple Apex | Returns valid tree |

---

### UT-020: ApexGrammarLoader handles missing .wasm

| Field | Value |
|-------|-------|
| **ID** | UT-020 |
| **Level** | UT |
| **Priority** | High |
| **Requirement** | TDD S5.6, UC-01 EF-03 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call ApexGrammarLoader.load("nonexistent.wasm") | Returns null (graceful) |
| 2 | Verify warning logged | Log message about missing grammar |

---

### UT-021: SF_RELATIONSHIP_KINDS constant completeness

| Field | Value |
|-------|-------|
| **ID** | UT-021 |
| **Level** | UT |
| **Priority** | Medium |
| **Requirement** | TDD S4.2 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify SF_RELATIONSHIP_KINDS contains all 7 SF kinds | trigger-on, soql, dml, wire, flow-action, flow-object, apex-import |
| 2 | Verify no duplicates | Set size equals array length |

---

### UT-022: SfdxDetector.getPackageDirectories() multiple dirs

| Field | Value |
|-------|-------|
| **ID** | UT-022 |
| **Level** | UT |
| **Priority** | Medium |
| **Requirement** | BR-03, Story 1 AC2 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse sfdx-project.json with packageDirectories: [{path:"force-app"},{path:"unpackaged"}] | Returns ["force-app", "unpackaged"] |

---

### UT-023: ApexParser handles inner classes

| Field | Value |
|-------|-------|
| **ID** | UT-023 |
| **Level** | UT |
| **Priority** | Medium |
| **Requirement** | BR-05 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse class with inner class definition | Both outer and inner class symbols found |
| 2 | Verify parent-child | Inner class has parentName = outer class |

---

### UT-024: SalesforceMetaParser extracts subflow references

| Field | Value |
|-------|-------|
| **ID** | UT-024 |
| **Level** | UT |
| **Priority** | Medium |
| **Requirement** | UC-05 AF-02 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse flow with subflow elements | Subflow references extracted |
| 2 | Verify relationships | Contains calls to subflow names |

---

## 3. Integration Tests (IT)

### IT-001: Full indexing pipeline - SFDX project

| Field | Value |
|-------|-------|
| **ID** | IT-001 |
| **Level** | IT |
| **Priority** | High |
| **Requirement** | UC-01, Story 1 |
| **Preconditions** | In-memory SQLite DB, SFDX fixture project |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Initialize IndexingEngine with SFDX fixture path | Engine detects SFDX project |
| 2 | Run full index | Indexing completes |
| 3 | Query symbols table | Apex classes, triggers, flows, objects stored |
| 4 | Query relationships table | SF relationship types stored (trigger-on, soql, dml, etc.) |
| 5 | Verify SF stats | Correct counts per metadata type |

---

### IT-002: Incremental indexing - unchanged files skipped

| Field | Value |
|-------|-------|
| **ID** | IT-002 |
| **Level** | IT |
| **Priority** | High |
| **Requirement** | BR-02, Story 1 AC3 |
| **Preconditions** | SFDX project already indexed once |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run full index (first time) | All files indexed |
| 2 | Run index again (no changes) | 0 files re-parsed (all skipped) |
| 3 | Modify one .cls file | File hash changes |
| 4 | Run index again | Only 1 file re-parsed |

---

### IT-003: Parser -> DB symbol storage roundtrip

| Field | Value |
|-------|-------|
| **ID** | IT-003 |
| **Level** | IT |
| **Priority** | High |
| **Requirement** | UC-02, BR-05 |
| **Preconditions** | SQLite DB initialized |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse AccountService.cls with ApexParser | ParseResult with symbols |
| 2 | Store symbols in DB via indexer | Symbols persisted |
| 3 | Query DB for file symbols | Same symbols returned with correct metadata |
| 4 | Verify modifiers stored correctly | JSON array preserved |
| 5 | Verify decorators stored correctly | Annotations preserved |

---

### IT-004: Parser -> DB relationship storage roundtrip

| Field | Value |
|-------|-------|
| **ID** | IT-004 |
| **Level** | IT |
| **Priority** | High |
| **Requirement** | UC-04, BR-13 |
| **Preconditions** | SQLite DB initialized |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse file with SOQL, DML, inheritance | ParseResult with relationships |
| 2 | Store relationships in DB | Relationships persisted |
| 3 | Query DB by source_symbol | Correct relationships returned |
| 4 | Query DB by target_symbol | Reverse lookup works |
| 5 | Verify kind values | All SF relationship kinds stored correctly |

---

### IT-005: DependencyGraphService with SF relationships

| Field | Value |
|-------|-------|
| **ID** | IT-005 |
| **Level** | IT |
| **Priority** | High |
| **Requirement** | UC-04, BR-13-BR-19 |
| **Preconditions** | DB populated with SF relationships |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call getForwardDeps("AccountService") | Returns SOQL, DML, class deps |
| 2 | Call getReverseDeps("Account") | Returns triggers, classes with SOQL/DML on Account |
| 3 | Verify SF relationship kinds included | trigger-on, soql, dml, flow-action in results |

---

### IT-006: ImpactAnalysisService cross-metadata traversal

| Field | Value |
|-------|-------|
| **ID** | IT-006 |
| **Level** | IT |
| **Priority** | High |
| **Requirement** | UC-05, BR-20-BR-23 |
| **Preconditions** | DB with: Trigger->Account, Class->Account (SOQL), Flow->Account |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call analyzeImpact("Account") | Impact result returned |
| 2 | Verify triggers included | AccountTrigger in impacted list |
| 3 | Verify classes included | Classes with SOQL/DML on Account |
| 4 | Verify flows included | Flows referencing Account |
| 5 | Verify severity | Direct deps = high, transitive = medium/low |

---

### IT-007: CallGraphService with SF call types

| Field | Value |
|-------|-------|
| **ID** | IT-007 |
| **Level** | IT |
| **Priority** | High |
| **Requirement** | UC-06, BR-24-BR-27 |
| **Preconditions** | DB with: Flow->AccountService (flow-action), LWC->AccountController (wire) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call getCallers("AccountService.createAccount") | Returns all callers |
| 2 | Verify Flow caller | Flow action invocation found |
| 3 | Verify LWC caller | Wire adapter import found |
| 4 | Verify call types labeled | method_call, apex_action, wire_adapter |

---

### IT-008: Non-SFDX project indexing unchanged

| Field | Value |
|-------|-------|
| **ID** | IT-008 |
| **Level** | IT |
| **Priority** | Critical |
| **Requirement** | BRD NFR Backward Compat |
| **Preconditions** | Non-SFDX TypeScript project fixture |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Initialize IndexingEngine with non-SFDX path | No SFDX detected |
| 2 | Run full index | Standard indexing (TS/JS only) |
| 3 | Verify no SF symbols | Zero symbols with language=apex |
| 4 | Verify no SF relationships | Zero relationships with SF kinds |
| 5 | Verify performance unchanged | Timing within baseline +/- 10% |

---

### IT-009: SFDX detection does not affect non-SF indexing timing

| Field | Value |
|-------|-------|
| **ID** | IT-009 |
| **Level** | IT |
| **Priority** | High |
| **Requirement** | BR-01, BRD NFR |
| **Preconditions** | Mixed project with SFDX + TS files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Index TS files only (baseline) | Record timing |
| 2 | Add SFDX project to workspace | sfdx-project.json exists |
| 3 | Re-index (full) | TS file indexing time within baseline +/- 10% |

---

### IT-010: Grammar loading lazy (only on first .cls encounter)

| Field | Value |
|-------|-------|
| **ID** | IT-010 |
| **Level** | IT |
| **Priority** | High |
| **Requirement** | TDD S8.4 |
| **Preconditions** | Server fresh start, no .cls files encountered yet |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start server | Apex grammar NOT loaded yet (check memory) |
| 2 | Index TS-only project | Grammar still not loaded |
| 3 | Encounter first .cls file | Grammar loaded on-demand |
| 4 | Verify parser cached | Subsequent .cls uses cached parser |

---

### IT-011: Multiple packageDirectories scanned

| Field | Value |
|-------|-------|
| **ID** | IT-011 |
| **Level** | IT |
| **Priority** | High |
| **Requirement** | BR-03, Story 1 AC2 |
| **Preconditions** | SFDX project with packageDirectories: ["force-app", "unpackaged"] |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run index on multi-package project | Both directories scanned |
| 2 | Verify files from force-app/ indexed | Classes from force-app found |
| 3 | Verify files from unpackaged/ indexed | Classes from unpackaged found |

---

### IT-012: Relationship deduplication

| Field | Value |
|-------|-------|
| **ID** | IT-012 |
| **Level** | IT |
| **Priority** | Medium |
| **Requirement** | TDD S4.2 |
| **Preconditions** | File with multiple SOQL to same object |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Parse class with 3 SOQL queries to Account | 3 relationships extracted |
| 2 | Store in DB | All 3 stored (different lines) |
| 3 | Query dependencies | Each shown with line reference |

---

### IT-013: Module detection for SFDX paths

| Field | Value |
|-------|-------|
| **ID** | IT-013 |
| **Level** | IT |
| **Priority** | Medium |
| **Requirement** | TDD S4.3 |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | File in force-app/main/default/classes/ | module = "apex-classes" |
| 2 | File in force-app/main/default/triggers/ | module = "apex-triggers" |
| 3 | File in force-app/main/default/flows/ | module = "sf-flows" |
| 4 | File in force-app/main/default/objects/ | module = "sf-objects" |
| 5 | File in force-app/main/default/lwc/ | module = "lwc-components" |

---

### IT-014: code_index_status returns SF stats section

| Field | Value |
|-------|-------|
| **ID** | IT-014 |
| **Level** | IT |
| **Priority** | High |
| **Requirement** | UC-09, BR-36-BR-39, Story 9 |
| **Preconditions** | SFDX project indexed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call code_index_status tool handler | Response includes sfdx section |
| 2 | Verify sfdx.detected = true | SFDX detected flag |
| 3 | Verify stats counts | apexClasses, triggers, flows, objects, lwc counts correct |
| 4 | Verify relationships counts | By-type breakdown matches DB |

---

### IT-015: code_index_status without SFDX project

| Field | Value |
|-------|-------|
| **ID** | IT-015 |
| **Level** | IT |
| **Priority** | High |
| **Requirement** | BR-36, Story 9 AC3 |
| **Preconditions** | Non-SFDX project indexed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call code_index_status | Response returned |
| 2 | Verify no sfdx section | sfdx field absent or sfdx.detected=false |
| 3 | Verify standard fields unchanged | files_indexed, symbols_count normal |

---

### IT-016: Apex file re-index updates relationships

| Field | Value |
|-------|-------|
| **ID** | IT-016 |
| **Level** | IT |
| **Priority** | High |
| **Requirement** | BR-02 |
| **Preconditions** | File previously indexed with SOQL to Account |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Modify file: add SOQL to Contact | File hash changes |
| 2 | Re-index file | Old relationships for file deleted, new ones stored |
| 3 | Query relationships | Now has both Account and Contact SOQL |
| 4 | Old-only relationships gone | Previous relationships replaced |

---

### IT-017: Performance - 500 Apex files indexing < 30s

| Field | Value |
|-------|-------|
| **ID** | IT-017 |
| **Level** | IT |
| **Priority** | Medium |
| **Requirement** | BRD NFR Performance |
| **Preconditions** | Generated large SFDX project fixture (500 .cls files) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start timer | t0 |
| 2 | Run full index on 500-file project | Indexing completes |
| 3 | Stop timer | t1 - t0 < 30000ms |

---

### IT-018: Performance - single Apex parse < 500ms

| Field | Value |
|-------|-------|
| **ID** | IT-018 |
| **Level** | IT |
| **Priority** | Medium |
| **Requirement** | BRD NFR Performance |
| **Preconditions** | Large Apex class (500 lines) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start timer | t0 |
| 2 | Parse large Apex file | ParseResult returned |
| 3 | Stop timer | t1 - t0 < 500ms |

---

## 4. End-to-End API Tests (E2E-API)

### E2E-001: code_symbols returns Apex class symbols

| Field | Value |
|-------|-------|
| **ID** | E2E-001 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-02, BR-05, Story 2 AC1 |
| **Preconditions** | MCP server running, SFDX project indexed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send tools/call: code_symbols(file_path="AccountService.cls") | Response returned |
| 2 | Verify class symbol | name=AccountService, kind=class |
| 3 | Verify methods | All public methods listed with signatures |
| 4 | Verify modifiers | "public", "with sharing" present |
| 5 | Verify annotations | @AuraEnabled on appropriate methods |

---

### E2E-002: code_symbols returns trigger symbols

| Field | Value |
|-------|-------|
| **ID** | E2E-002 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-02, BR-08, Story 2 AC2 |
| **Preconditions** | MCP server running, trigger file indexed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_symbols(file_path="AccountTrigger.trigger") | Response returned |
| 2 | Verify trigger symbol | kind=trigger, events listed, SObject=Account |

---

### E2E-003: code_search finds Apex symbols

| Field | Value |
|-------|-------|
| **ID** | E2E-003 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-03, BR-09, Story 3 AC1 |
| **Preconditions** | MCP server running, SFDX indexed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_search(query="AccountService") | Results returned |
| 2 | Verify Apex class in results | AccountService.cls found |
| 3 | Verify metadata present | File path, line, signature included |

---

### E2E-004: code_search finds Flow symbols

| Field | Value |
|-------|-------|
| **ID** | E2E-004 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-03, BR-10, Story 3 AC2 |
| **Preconditions** | MCP server running, flows indexed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_search(query="Account_Update") | Results returned |
| 2 | Verify Flow in results | Account_Update.flow-meta.xml found |

---

### E2E-005: code_search finds Object symbols

| Field | Value |
|-------|-------|
| **ID** | E2E-005 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-03, BR-10, Story 3 |
| **Preconditions** | MCP server running, objects indexed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_search(query="Account") | Results include object |
| 2 | Verify custom object in results | Account object metadata found |

---

### E2E-006: code_search finds LWC symbols

| Field | Value |
|-------|-------|
| **ID** | E2E-006 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-03, BR-10, Story 3 AC3 |
| **Preconditions** | MCP server running, LWC indexed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_search(query="accountList") | Results returned |
| 2 | Verify LWC component in results | accountList component found |

---

### E2E-007: code_dependencies shows trigger-on relationship

| Field | Value |
|-------|-------|
| **ID** | E2E-007 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-04, BR-13, Story 4 AC1 |
| **Preconditions** | MCP server running, trigger + object indexed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_dependencies(symbol="Account", direction="dependents") | Results returned |
| 2 | Verify trigger in dependents | AccountTrigger with relationship=trigger-on |

---

### E2E-008: code_dependencies shows SOQL relationships

| Field | Value |
|-------|-------|
| **ID** | E2E-008 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-04, BR-15, Story 4 |
| **Preconditions** | MCP server running, class with SOQL indexed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_dependencies(symbol="AccountService") | Results returned |
| 2 | Verify SOQL dependency | Account object with relationship=soql |

---

### E2E-009: code_dependencies shows DML relationships

| Field | Value |
|-------|-------|
| **ID** | E2E-009 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-04, BR-16, Story 4 |
| **Preconditions** | MCP server running, class with DML indexed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_dependencies(symbol="AccountService") | Results include DML |
| 2 | Verify DML dependency | Account with relationship=dml, metadata.operation |

---

### E2E-010: code_dependencies shows flow-action relationship

| Field | Value |
|-------|-------|
| **ID** | E2E-010 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-04, BR-14, Story 4 AC3 |
| **Preconditions** | MCP server running, flow with Apex action indexed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_dependencies(symbol="Auto_Create_Contact") | Results returned |
| 2 | Verify flow-action relationship | ContactService with relationship=flow-action |

---

### E2E-011: code_dependencies shows wire relationship

| Field | Value |
|-------|-------|
| **ID** | E2E-011 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-04, BR-17, Story 4 |
| **Preconditions** | MCP server running, LWC with @wire indexed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_dependencies(symbol="accountList") | Results returned |
| 2 | Verify wire relationship | AccountController with relationship=wire |

---

### E2E-012: code_impact cross-metadata traversal

| Field | Value |
|-------|-------|
| **ID** | E2E-012 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-05, BR-20, Story 5 AC1 |
| **Preconditions** | MCP server running, full relationship graph indexed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_impact(symbol="Account", action="modify") | Impact results returned |
| 2 | Verify triggers included | AccountTrigger (direct, high severity) |
| 3 | Verify classes with SOQL | AccountService (direct, high) |
| 4 | Verify flows | Flows referencing Account (direct, high) |
| 5 | Verify transitive impact | Callers of AccountService (medium severity) |

---

### E2E-013: code_impact on Apex class

| Field | Value |
|-------|-------|
| **ID** | E2E-013 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-05, BR-21, Story 5 AC2 |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_impact(symbol="AccountService") | Impact results |
| 2 | Verify callers (Apex + Flow + LWC) included | All caller types present |
| 3 | Verify severity hints | Direct = high, transitive = medium/low |

---

### E2E-014: code_impact results grouped by metadata type

| Field | Value |
|-------|-------|
| **ID** | E2E-014 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | BR-23, Story 5 |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_impact(symbol="Account") | Results returned |
| 2 | Verify grouping | Results grouped by: triggers, classes, flows, lwc |

---

### E2E-015: code_callers includes SF call types

| Field | Value |
|-------|-------|
| **ID** | E2E-015 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-06, BR-24, Story 6 AC1 |
| **Preconditions** | MCP server running, full graph |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_callers(symbol="AccountService.createAccount") | Results returned |
| 2 | Verify Apex method callers | Other Apex methods calling createAccount |
| 3 | Verify Flow callers | Flows invoking via InvocableMethod |
| 4 | Verify LWC callers | LWC components importing via @wire |
| 5 | Verify call type labels | method_call, apex_action, wire_adapter |

---

### E2E-016: code_callees includes SF targets

| Field | Value |
|-------|-------|
| **ID** | E2E-016 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-06, BR-25, Story 6 AC2 |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_callees(symbol="AccountTrigger") | Results returned |
| 2 | Verify handler methods | Trigger handler class methods listed |
| 3 | Verify SOQL targets | SObjects queried listed with type=soql |
| 4 | Verify DML targets | SObjects written listed with type=dml |

---

### E2E-017: code_callers distinguishes call types

| Field | Value |
|-------|-------|
| **ID** | E2E-017 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | BR-27, Story 6 AC3 |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_callers for method called by multiple types | Results returned |
| 2 | Verify each result has call_type field | method_call, apex_action, wire_adapter distinguished |

---

### E2E-018: mem_ingest_file with .cls file

| Field | Value |
|-------|-------|
| **ID** | E2E-018 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-07, BR-28, Story 7 AC1 |
| **Preconditions** | MCP server running, .cls file on disk |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send mem_ingest_file(path="AccountService.cls") | Success response |
| 2 | Verify structured parsing applied | Symbols extracted in KB entry |
| 3 | Verify tags | Tagged with: salesforce, ApexClass, AccountService |

---

### E2E-019: mem_ingest_file with .trigger file

| Field | Value |
|-------|-------|
| **ID** | E2E-019 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-07, BR-28, Story 7 |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send mem_ingest_file(path="AccountTrigger.trigger") | Success response |
| 2 | Verify trigger metadata | Events, SObject reference in KB |
| 3 | Verify tags | salesforce, ApexTrigger, AccountTrigger |

---

### E2E-020: mem_ingest_file with .flow-meta.xml

| Field | Value |
|-------|-------|
| **ID** | E2E-020 |
| **Level** | E2E-API |
| **Priority** | Medium |
| **Requirement** | UC-07, BR-29, Story 7 AC2 |
| **Preconditions** | MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send mem_ingest_file(path="Account_Update.flow-meta.xml") | Success |
| 2 | Verify flow structure parsed | Flow elements in KB entry |
| 3 | Verify tags | salesforce, Flow, Account_Update |

---

### E2E-021: code_index_status with SFDX stats

| Field | Value |
|-------|-------|
| **ID** | E2E-021 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | UC-09, BR-36-BR-39, Story 9 AC1 |
| **Preconditions** | MCP server running, SFDX indexed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_index_status | Response with sfdx section |
| 2 | Verify sfdx.detected = true | Present |
| 3 | Verify stats breakdown | apex_classes, triggers, flows, objects, lwc counts |
| 4 | Verify relationships counts | By-type breakdown |
| 5 | Verify lastIndexed | Valid ISO timestamp |

---

### E2E-022: code_index_status backward compat (no SFDX)

| Field | Value |
|-------|-------|
| **ID** | E2E-022 |
| **Level** | E2E-API |
| **Priority** | Critical |
| **Requirement** | BR-36, Story 9 AC3, BRD NFR |
| **Preconditions** | MCP server running with non-SFDX project |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_index_status | Response without sfdx section |
| 2 | Verify standard fields present | files_indexed, symbols_count, languages |
| 3 | Verify no SF languages | "apex" not in languages list |

---

### E2E-023: Backward compat - code_search non-SF project

| Field | Value |
|-------|-------|
| **ID** | E2E-023 |
| **Level** | E2E-API |
| **Priority** | Critical |
| **Requirement** | BRD NFR Backward Compat |
| **Preconditions** | MCP server with non-SFDX project |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_search(query="function") | Results returned |
| 2 | Verify only TS/JS results | No Apex/Flow/Object symbols |
| 3 | Verify response format unchanged | Same schema as before SF integration |

---

### E2E-024: Backward compat - code_dependencies non-SF project

| Field | Value |
|-------|-------|
| **ID** | E2E-024 |
| **Level** | E2E-API |
| **Priority** | Critical |
| **Requirement** | BRD NFR Backward Compat |
| **Preconditions** | MCP server with non-SFDX project |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_dependencies(symbol="MyService") | Results returned |
| 2 | Verify no SF relationship kinds | Only standard kinds (calls, imports, etc.) |
| 3 | Verify response time | Within baseline (< 200ms) |

---

### E2E-025: Backward compat - code_impact non-SF project

| Field | Value |
|-------|-------|
| **ID** | E2E-025 |
| **Level** | E2E-API |
| **Priority** | Critical |
| **Requirement** | BRD NFR Backward Compat |
| **Preconditions** | MCP server with non-SFDX project |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_impact(symbol="MyService") | Results returned |
| 2 | Verify standard traversal | Only existing relationship kinds traversed |
| 3 | Verify no SF grouping | No metadata-type grouping (only for SF) |

---

### E2E-026: Error handling - malformed Apex file in index

| Field | Value |
|-------|-------|
| **ID** | E2E-026 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | TDD S5.6, UC-01 EF-02 |
| **Preconditions** | SFDX project with 1 malformed .cls file among valid ones |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger full index | Indexing completes (does not crash) |
| 2 | Send code_index_status | Shows files indexed with error count |
| 3 | Verify valid files indexed | Other valid Apex files have symbols |
| 4 | Verify server stable | Subsequent tool calls work |

---

### E2E-027: Error handling - missing .wasm grammar

| Field | Value |
|-------|-------|
| **ID** | E2E-027 |
| **Level** | E2E-API |
| **Priority** | High |
| **Requirement** | TDD S5.6, UC-01 EF-03 |
| **Preconditions** | Server started without tree-sitter-apex.wasm |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start server (grammar missing) | Server starts (no crash) |
| 2 | Send code_symbols for .cls file | Graceful error or regex fallback |
| 3 | Verify non-Apex tools work | code_search for TS files works normally |

---

### E2E-028: Performance - dependency query < 200ms

| Field | Value |
|-------|-------|
| **ID** | E2E-028 |
| **Level** | E2E-API |
| **Priority** | Medium |
| **Requirement** | BR-19, BRD NFR |
| **Preconditions** | Large indexed SFDX project |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Send code_dependencies(symbol="Account") | Response returned |
| 2 | Measure response time | < 200ms |
| 3 | Send code_impact(symbol="AccountService") | Response returned |
| 4 | Measure response time | < 500ms |

---

## 5. End-to-End UI Tests (E2E-UI)

### UI-001: Extension command registered in palette

| Field | Value |
|-------|-------|
| **ID** | UI-001 |
| **Level** | E2E-UI |
| **Priority** | High |
| **Requirement** | UC-08, BR-32, Story 8 AC1 |
| **Preconditions** | Kiro extension installed |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open command palette (Ctrl+Shift+P) | Palette opens |
| 2 | Type "Index Salesforce" | "Kiro SDLC: Index Salesforce Project" appears |
| 3 | Verify command ID | kiro-sdlc.indexSalesforceProject |

---

### UI-002: Command success with SFDX project

| Field | Value |
|-------|-------|
| **ID** | UI-002 |
| **Level** | E2E-UI |
| **Priority** | High |
| **Requirement** | UC-08, BR-33, BR-34, Story 8 AC1 |
| **Preconditions** | Workspace with SFDX project |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run "Kiro SDLC: Index Salesforce Project" | Progress notification shown |
| 2 | Wait for completion | Result notification with stats |
| 3 | Verify stats in notification | "N Apex classes, M triggers, K flows, L objects indexed" |

---

### UI-003: Command error - no SFDX project

| Field | Value |
|-------|-------|
| **ID** | UI-003 |
| **Level** | E2E-UI |
| **Priority** | High |
| **Requirement** | UC-08 AF-01, Story 8 AC2 |
| **Preconditions** | Workspace without sfdx-project.json |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run "Kiro SDLC: Index Salesforce Project" | Error notification shown |
| 2 | Verify message | "No SFDX project found (missing sfdx-project.json)" |

---

### UI-004: Command handles indexing already in progress

| Field | Value |
|-------|-------|
| **ID** | UI-004 |
| **Level** | E2E-UI |
| **Priority** | Medium |
| **Requirement** | UC-08 AF-02, Story 8 AC3 |
| **Preconditions** | Indexing currently running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger indexing (first call) | Progress notification |
| 2 | Immediately trigger again | Info message: "Indexing already in progress" |

---

## 6. System Integration Testing (SIT) - Manual

### SIT-001: Full workflow - Open SFDX project, index, query

| Field | Value |
|-------|-------|
| **ID** | SIT-001 |
| **Level** | SIT |
| **Priority** | High |
| **Requirement** | All stories |
| **Preconditions** | Real SFDX project, Kiro IDE |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open SFDX project in Kiro IDE | Project loaded |
| 2 | Run "Index Salesforce Project" command | Progress shown, completes with stats |
| 3 | Ask AI agent "what classes reference Account?" | Agent uses code_dependencies, returns SF results |
| 4 | Ask "show me impact of changing AccountService" | Agent uses code_impact, shows cross-metadata impact |
| 5 | Verify UX is smooth | No freezes, reasonable response times |

---

### SIT-002: Mixed project - TS + SFDX coexist

| Field | Value |
|-------|-------|
| **ID** | SIT-002 |
| **Level** | SIT |
| **Priority** | High |
| **Requirement** | BRD NFR Backward Compat |
| **Preconditions** | Project with both TS and SFDX directories |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Index workspace (standard) | Both TS and SF files indexed |
| 2 | Search for TS symbol | Found normally |
| 3 | Search for Apex symbol | Found alongside TS results |
| 4 | Query dependencies of TS file | Only TS deps shown (no SF noise) |

---

### SIT-003: Large SFDX project performance

| Field | Value |
|-------|-------|
| **ID** | SIT-003 |
| **Level** | SIT |
| **Priority** | Medium |
| **Requirement** | BRD NFR Performance |
| **Preconditions** | Real large SFDX project (200+ Apex files) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run "Index Salesforce Project" | Completes within 30s |
| 2 | Query symbols | Response within 200ms |
| 3 | Check memory usage | Server memory < 512MB |

---

### SIT-004: Extension command coexists with "Index Workspace"

| Field | Value |
|-------|-------|
| **ID** | SIT-004 |
| **Level** | SIT |
| **Priority** | Medium |
| **Requirement** | BR-35 |
| **Preconditions** | Both commands available |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run "Index Workspace" (existing) | Standard indexing works |
| 2 | Run "Index Salesforce Project" (new) | SF-specific indexing works |
| 3 | Verify no conflict | Both commands coexist, no errors |

---

### SIT-005: Progress notification timing and UX

| Field | Value |
|-------|-------|
| **ID** | SIT-005 |
| **Level** | SIT |
| **Priority** | Medium |
| **Requirement** | BR-33 |
| **Preconditions** | SFDX project with ~100 files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run index command | Progress notification appears immediately |
| 2 | Observe during indexing | Progress text updates (or spinner active) |
| 3 | Wait for completion | Result notification replaces progress |
| 4 | Verify result message readable | Clear stats, no truncation |

---

## 7. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Status |
|-------------|--------|------------|--------|
| UC-01 (SFDX Auto-Detection) | FSD S3.1 | PBT-004, UT-001-003, IT-001-002, IT-008-011 | Covered |
| UC-02 (Apex in code_symbols) | FSD S3.2 | PBT-001-002, UT-004-006, UT-017-018, IT-003, E2E-001-002 | Covered |
| UC-03 (SF in code_search) | FSD S3.3 | UT-010-012, E2E-003-006 | Covered |
| UC-04 (SF in code_dependencies) | FSD S3.4 | PBT-005, UT-007-009, IT-004-005, E2E-007-011 | Covered |
| UC-05 (SF in code_impact) | FSD S3.5 | PBT-007, IT-006, E2E-012-014 | Covered |
| UC-06 (SF in code_callers/callees) | FSD S3.6 | IT-007, E2E-015-017 | Covered |
| UC-07 (SF in mem_ingest_file) | FSD S3.7 | E2E-018-020 | Covered |
| UC-08 (Extension Command) | FSD S3.8 | UI-001-004, SIT-001, SIT-004-005 | Covered |
| UC-09 (SFDX Stats) | FSD S3.9 | IT-014-015, E2E-021-022 | Covered |
| BR-01 (No perf impact) | BRD NFR | IT-008-009, E2E-023-025 | Covered |
| BR-02 (Incremental indexing) | Story 1 AC3 | PBT-006, IT-002, IT-016 | Covered |
| BR-03 (All packageDirectories) | Story 1 AC2 | UT-022, IT-011 | Covered |
| BR-04 (Additive only) | BRD v2 | IT-008, E2E-022-025 | Covered |
| BR-05 (Apex modifiers) | Story 2 | UT-004, UT-018, E2E-001 | Covered |
| BR-06 (Apex annotations) | Story 2 | UT-017, E2E-001 | Covered |
| BR-07 (Apex conventions) | Story 2 | UT-004 | Covered |
| BR-08 (Trigger events + SObject) | Story 2 AC2 | UT-005, E2E-002 | Covered |
| BR-09 (Search includes Apex) | Story 3 | E2E-003 | Covered |
| BR-10 (Search includes Flow/Object/LWC) | Story 3 | E2E-004-006 | Covered |
| BR-11 (Type filtering) | Story 3 | E2E-004 | Covered |
| BR-12 (Same metadata as other langs) | Story 3 | E2E-003 | Covered |
| BR-13 (trigger-on) | Story 4 | UT-005, IT-005, E2E-007 | Covered |
| BR-14 (flow-action) | Story 4 | UT-010, E2E-010 | Covered |
| BR-15 (SOQL) | Story 4 | UT-007, E2E-008 | Covered |
| BR-16 (DML) | Story 4 | UT-008, E2E-009 | Covered |
| BR-17 (wire) | Story 4 | UT-012, E2E-011 | Covered |
| BR-18 (inherits) | Story 4 | UT-009 | Covered |
| BR-19 (query < 200ms) | BRD NFR | IT-018, E2E-028 | Covered |
| BR-20 (Object impact includes all) | Story 5 | IT-006, E2E-012 | Covered |
| BR-21 (Class impact) | Story 5 | E2E-013 | Covered |
| BR-22 (Severity hints) | Story 5 AC3 | E2E-012-013 | Covered |
| BR-23 (Grouped by type) | Story 5 | E2E-014 | Covered |
| BR-24 (callers includes SF) | Story 6 | IT-007, E2E-015 | Covered |
| BR-25 (callees includes SF) | Story 6 | E2E-016 | Covered |
| BR-26 (Cross-metadata traversal) | Story 6 | E2E-015-016 | Covered |
| BR-27 (Distinguish call types) | Story 6 AC3 | E2E-017 | Covered |
| BR-28 (Accept .cls/.trigger) | Story 7 | E2E-018-019 | Covered |
| BR-29 (Accept .flow-meta.xml) | Story 7 | E2E-020 | Covered |
| BR-30 (Structured metadata) | Story 7 | E2E-018 | Covered |
| BR-31 (KB tags) | Story 7 | E2E-018-020 | Covered |
| BR-32 (Follow existing pattern) | Story 8 | UI-001 | Covered |
| BR-33 (Progress notification) | Story 8 | UI-002, SIT-005 | Covered |
| BR-34 (Report results) | Story 8 | UI-002 | Covered |
| BR-35 (No new MCP connection) | BRD v2 | UI-002, SIT-004 | Covered |
| BR-36 (SF section only when detected) | Story 9 AC3 | IT-015, E2E-022 | Covered |
| BR-37 (Stats counts) | Story 9 | IT-014, E2E-021 | Covered |
| BR-38 (Last indexed + pending) | Story 9 | E2E-021 | Covered |
| BR-39 (Relationship counts) | Story 9 | IT-014, E2E-021 | Covered |
| Graceful error handling | TDD S5.6 | PBT-001, PBT-003, UT-006, UT-013, UT-020, E2E-026-027 | Covered |
| Performance NFRs | BRD S6 | IT-017-018, E2E-028, SIT-003 | Covered |

**Coverage Summary:**

| Category | Total | Covered | Coverage % |
|----------|-------|---------|------------|
| Use Cases | 9 | 9 | 100% |
| Business Rules | 39 | 39 | 100% |
| Error Flows | 5 | 5 | 100% |
| NFRs | 4 | 4 | 100% |
| **Overall** | **57** | **57** | **100%** |

---

## 8. Test Data Files

| File | Purpose | Location |
|------|---------|----------|
| sfdx-project.json | Valid SFDX config | tests/fixtures/sfdx-sample/ |
| AccountService.cls | Apex class with methods, SOQL, DML | tests/fixtures/sfdx-sample/force-app/main/default/classes/ |
| AccountTrigger.trigger | Trigger on Account | tests/fixtures/sfdx-sample/force-app/main/default/triggers/ |
| Account_Update.flow-meta.xml | Record-triggered Flow | tests/fixtures/sfdx-sample/force-app/main/default/flows/ |
| Account.object-meta.xml | Object with fields | tests/fixtures/sfdx-sample/force-app/main/default/objects/Account/ |
| accountList/ | LWC with @wire | tests/fixtures/sfdx-sample/force-app/main/default/lwc/accountList/ |
| BrokenClass.cls | Malformed Apex | tests/fixtures/malformed/ |
| broken.flow-meta.xml | Invalid XML | tests/fixtures/malformed/ |

---

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Test Coverage | [test-coverage.png](diagrams/test-coverage.png) | [test-coverage.drawio](diagrams/test-coverage.drawio) |
| 2 | Test Execution Flow | [test-execution-flow.png](diagrams/test-execution-flow.png) | [test-execution-flow.drawio](diagrams/test-execution-flow.drawio) |
