# Software Test Cases (STC)

## Kiro SDLC Agents — KSA-239: Multi-format Document Indexing

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-239 |
| Title | Multi-format document indexing — support docx/xlsx/pdf/image in Index Documents |
| Author | QA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related STP | STP-v1-KSA-239.docx |
| Related FSD | FSD-v1-KSA-239.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | QA Agent | Initial test cases from BRD, FSD, and TDD |

---

## Test Case Summary

| Category | ID Range | Count | Priority |
|----------|----------|-------|----------|
| PBT — Property-Based | PBT-001 to PBT-004 | 4 | High |
| UT — Unit Tests | UT-001 to UT-018 | 18 | High |
| IT — Integration Tests | IT-001 to IT-012 | 12 | High |
| E2E-API — Pipeline Tests | E2E-API-001 to E2E-API-008 | 8 | High |
| E2E-UI — Extension Tests | E2E-UI-001 to E2E-UI-004 | 4 | Medium |
| SIT — Manual Exploratory | SIT-001 to SIT-005 | 5 | Medium |
| **Total** | | **51** | |

---

## 1. PBT — Property-Based Tests

### PBT-001: File Extension Classification is Total

| Field | Value |
|-------|-------|
| **ID** | PBT-001 |
| **Priority** | High |
| **Level** | PBT |
| **Requirement** | BR-03, BR-04, BR-05 |
| **Property** | For any extension in INDEXABLE_EXTENSIONS, classifyFormat returns a valid format string (never undefined) |

**Property Definition:**
```typescript
fc.assert(fc.property(
  fc.constantFrom(...INDEXABLE_EXTENSIONS),
  (ext) => {
    const result = classifyFormat(ext);
    return result !== undefined && result !== null && typeof result === 'string';
  }
));
```

**Runs:** 1000 iterations minimum

---

### PBT-002: Document Type Mapping is Deterministic

| Field | Value |
|-------|-------|
| **ID** | PBT-002 |
| **Priority** | High |
| **Level** | PBT |
| **Requirement** | BR-04, BR-05 |
| **Property** | Same filename always maps to same type. Unknown filenames map to CONTEXT. |

**Property Definition:**
```typescript
fc.assert(fc.property(
  fc.string({ minLength: 1, maxLength: 50 }),
  (filename) => {
    const r1 = classifyType(filename);
    const r2 = classifyType(filename);
    if (r1 !== r2) return false; // deterministic
    const knownNames = ['BRD', 'FSD', 'TDD', 'STP', 'STC', 'UG', 'DPG', 'RLN'];
    if (!knownNames.includes(filename.split('.')[0].toUpperCase())) {
      return r1 === 'CONTEXT';
    }
    return true;
  }
));
```

**Runs:** 1000 iterations

---

### PBT-003: Text Wrapping Preserves Content

| Field | Value |
|-------|-------|
| **ID** | PBT-003 |
| **Priority** | High |
| **Level** | PBT |
| **Requirement** | BR-10, BR-12 |
| **Property** | wrapTextContent always includes original content and starts with code fence |

**Property Definition:**
```typescript
fc.assert(fc.property(
  fc.string(),
  fc.constantFrom('txt', 'csv', 'json', 'xml', 'yaml', 'yml'),
  (content, format) => {
    const result = wrapTextContent(content, format);
    return result.includes(content) && result.startsWith('```');
  }
));
```

**Runs:** 500 iterations

---

### PBT-004: Size Limit Check is Monotonic

| Field | Value |
|-------|-------|
| **ID** | PBT-004 |
| **Priority** | High |
| **Level** | PBT |
| **Requirement** | BR-08, BR-09 |
| **Property** | Size check is monotonically increasing (if size S fails, S+1 also fails) |

**Property Definition:**
```typescript
fc.assert(fc.property(
  fc.constantFrom('pdf', 'png', 'jpg', 'docx'),
  fc.nat({ max: 100 * 1024 * 1024 }),
  (format, size) => {
    const result = isFileTooLarge(format, size);
    if (result) return isFileTooLarge(format, size + 1) === true;
    return size === 0 || isFileTooLarge(format, size - 1) === false;
  }
));
```

**Runs:** 1000 iterations

---

## 2. UT — Unit Tests

### UT-001: convertFileToMarkdown — Text Format Direct Read (.txt)

| Field | Value |
|-------|-------|
| **ID** | UT-001 |
| **Priority** | High |
| **Level** | UT |
| **Requirement** | BR-10, AF-02b |
| **Preconditions** | converter.ts exists, fs mocked |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock fs.existsSync returns true | File found |
| 2 | Mock fs.statSync returns size 100 bytes | Within limits |
| 3 | Mock fs.readFileSync returns "Hello World\nLine 2" | Content read |
| 4 | Call convertFileToMarkdown("/path/file.txt", "txt") | ConversionResult |
| 5 | Assert result.success === true | Passed |
| 6 | Assert result.markdown contains "Hello World" | Content preserved |
| 7 | Assert result.markdown starts with "```txt" | Wrapped in code block |

**Test Data:** "Hello World\nLine 2"

---

### UT-002: convertFileToMarkdown — Text Format Direct Read (.csv)

| Field | Value |
|-------|-------|
| **ID** | UT-002 |
| **Priority** | High |
| **Level** | UT |
| **Requirement** | BR-10, AF-02b |
| **Preconditions** | fs mocked |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock file content "name,age\nAlice,30\nBob,25" | CSV data |
| 2 | Call convertFileToMarkdown("/path/data.csv", "csv") | ConversionResult |
| 3 | Assert result.success === true | Passed |
| 4 | Assert result.markdown contains "name,age" | CSV preserved |
| 5 | Assert result.markdown wrapped in ```csv block | Format-specific block |

**Test Data:** "name,age\nAlice,30\nBob,25"

---

### UT-003: convertFileToMarkdown — Text Format Direct Read (.json)

| Field | Value |
|-------|-------|
| **ID** | UT-003 |
| **Priority** | High |
| **Level** | UT |
| **Requirement** | BR-10, AF-02b |
| **Preconditions** | fs mocked |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock file content '{"name":"test","version":"1.0"}' | JSON data |
| 2 | Call convertFileToMarkdown("/path/config.json", "json") | ConversionResult |
| 3 | Assert result.success === true | Passed |
| 4 | Assert result.markdown wrapped in ```json block | Correct format |

**Test Data:** '{"name":"test","version":"1.0"}'

---

### UT-004: convertFileToMarkdown — Size Limit Exceeded (PDF > 50MB)

| Field | Value |
|-------|-------|
| **ID** | UT-004 |
| **Priority** | High |
| **Level** | UT |
| **Requirement** | BR-08 |
| **Preconditions** | fs.statSync mocked, size = 55MB |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock fs.statSync returns { size: 57671680 } | 55MB |
| 2 | Call convertFileToMarkdown("/path/large.pdf", "pdf") | ConversionResult |
| 3 | Assert result.success === false | Rejected |
| 4 | Assert result.error contains "size limit" | Clear message |
| 5 | Assert filetomarkdown NOT called | Short-circuit |

**Test Data:** fileSize = 57671680

---

### UT-005: convertFileToMarkdown — Size Limit Exceeded (Image > 20MB)

| Field | Value |
|-------|-------|
| **ID** | UT-005 |
| **Priority** | High |
| **Level** | UT |
| **Requirement** | BR-09 |
| **Preconditions** | fs.statSync mocked, size = 25MB |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock fs.statSync returns { size: 26214400 } | 25MB |
| 2 | Call convertFileToMarkdown("/path/big.png", "png") | ConversionResult |
| 3 | Assert result.success === false | Rejected |
| 4 | Assert result.error contains "size limit" | Clear message |

**Test Data:** fileSize = 26214400

---

### UT-006: convertFileToMarkdown — Conversion Timeout (>30s)

| Field | Value |
|-------|-------|
| **ID** | UT-006 |
| **Priority** | High |
| **Level** | UT |
| **Requirement** | BR-11 |
| **Preconditions** | filetomarkdown mocked to never resolve, jest fake timers |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | jest.useFakeTimers() | Timer control |
| 2 | Mock filetomarkdown returns new Promise that never resolves | Hangs |
| 3 | Call convertFileToMarkdown("/path/slow.docx", "docx") | Promise pending |
| 4 | jest.advanceTimersByTime(30000) | Advance past timeout |
| 5 | Await result | ConversionResult resolved |
| 6 | Assert result.success === false | Timeout triggered |
| 7 | Assert result.error contains "timeout" | Clear message |

---

### UT-007: convertFileToMarkdown — File Not Found

| Field | Value |
|-------|-------|
| **ID** | UT-007 |
| **Priority** | High |
| **Level** | UT |
| **Requirement** | EF-02d |
| **Preconditions** | fs.existsSync or statSync throws ENOENT |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock fs.statSync to throw { code: 'ENOENT' } | File missing |
| 2 | Call convertFileToMarkdown("/nonexistent.docx", "docx") | ConversionResult |
| 3 | Assert result.success === false | Failed |
| 4 | Assert result.error mentions file not found | Clear message |

---

### UT-008: convertFileToMarkdown — filetomarkdown Throws

| Field | Value |
|-------|-------|
| **ID** | UT-008 |
| **Priority** | High |
| **Level** | UT |
| **Requirement** | EF-02b, BR-07 |
| **Preconditions** | filetomarkdown mocked to throw |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock filetomarkdown to throw Error("corrupt file") | Throws |
| 2 | Call convertFileToMarkdown("/path/corrupt.docx", "docx") | ConversionResult |
| 3 | Assert result.success === false | Error caught |
| 4 | Assert result.error contains "corrupt file" | Error propagated |
| 5 | Assert no uncaught exception | Graceful handling |

---

### UT-009: Lazy Loading — filetomarkdown Unavailable

| Field | Value |
|-------|-------|
| **ID** | UT-009 |
| **Priority** | Medium |
| **Level** | UT |
| **Requirement** | TDD 3.2 |
| **Preconditions** | require mocked to throw MODULE_NOT_FOUND |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock require('filetomarkdown') to throw MODULE_NOT_FOUND | Package missing |
| 2 | Call convertFileToMarkdown("/path/file.docx", "docx") | ConversionResult |
| 3 | Assert result.success === false | Cannot convert |
| 4 | Assert result.error mentions "filetomarkdown" + "unavailable" | Descriptive |

---

### UT-010: discoverDocuments — Excludes diagrams/

| Field | Value |
|-------|-------|
| **ID** | UT-010 |
| **Priority** | High |
| **Level** | UT |
| **Requirement** | BR-01 |
| **Preconditions** | Mock fs with diagrams/ folder containing .drawio |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock fs tree: documents/TEST-1/diagrams/arch.drawio | File in excluded dir |
| 2 | Mock fs tree: documents/TEST-1/BRD.md | File in included dir |
| 3 | Call discoverDocuments(root) | File list |
| 4 | Assert result does NOT contain arch.drawio | Excluded |
| 5 | Assert result contains BRD.md | Included |

---

### UT-011: discoverDocuments — Excludes testdata/

| Field | Value |
|-------|-------|
| **ID** | UT-011 |
| **Priority** | High |
| **Level** | UT |
| **Requirement** | BR-02 |
| **Preconditions** | Mock fs with testdata/ folder |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock fs tree: documents/TEST-1/testdata/data.csv | Excluded dir |
| 2 | Mock fs tree: documents/TEST-1/notes.csv | Not excluded |
| 3 | Call discoverDocuments(root) | File list |
| 4 | Assert testdata/data.csv NOT in result | Excluded |
| 5 | Assert notes.csv IS in result | Included |

---

### UT-012: discoverDocuments — Includes Nested Subdirs

| Field | Value |
|-------|-------|
| **ID** | UT-012 |
| **Priority** | High |
| **Level** | UT |
| **Requirement** | BRD Story 7 |
| **Preconditions** | Mock fs with nested attachments/ |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock: documents/TEST-1/attachments/spec.pdf | Nested file |
| 2 | Call discoverDocuments(root) | File list |
| 3 | Assert spec.pdf in result | Nested dirs scanned |

---

### UT-013: discoverDocuments — Only INDEXABLE_EXTENSIONS

| Field | Value |
|-------|-------|
| **ID** | UT-013 |
| **Priority** | High |
| **Level** | UT |
| **Requirement** | BR-03 |
| **Preconditions** | Mix of supported and unsupported extensions |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock files: report.docx, script.exe, run.sh, notes.md | Mixed |
| 2 | Call discoverDocuments(root) | File list |
| 3 | Assert report.docx in result | Supported |
| 4 | Assert notes.md in result | Supported |
| 5 | Assert script.exe NOT in result | Unsupported |
| 6 | Assert run.sh NOT in result | Unsupported |

---

### UT-014: discoverDocuments — Type Classification (Known Names)

| Field | Value |
|-------|-------|
| **ID** | UT-014 |
| **Priority** | High |
| **Level** | UT |
| **Requirement** | BR-04 |
| **Preconditions** | Files with known document names |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create files: BRD.md, FSD.docx, TDD.pdf, STP.xlsx | Known names |
| 2 | Call discoverDocuments(root) | Typed file list |
| 3 | Assert BRD.md type = "REQUIREMENT" | Correct |
| 4 | Assert FSD.docx type = "SPECIFICATION" | Correct |
| 5 | Assert TDD.pdf type = "ARCHITECTURE" | Correct |

---

### UT-015: discoverDocuments — Unknown Name to CONTEXT

| Field | Value |
|-------|-------|
| **ID** | UT-015 |
| **Priority** | High |
| **Level** | UT |
| **Requirement** | BR-05 |
| **Preconditions** | Files with unrecognized names |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create: meeting-notes.docx, api-spec.yaml | Unknown names |
| 2 | Call discoverDocuments(root) | Typed file list |
| 3 | Assert meeting-notes.docx type = "CONTEXT" | Fallback |
| 4 | Assert api-spec.yaml type = "CONTEXT" | Fallback |

---

### UT-016: discoverDocuments — Ticket Key Extraction

| Field | Value |
|-------|-------|
| **ID** | UT-016 |
| **Priority** | High |
| **Level** | UT |
| **Requirement** | BR-06 |
| **Preconditions** | Folder named with ticket pattern |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock: documents/KSA-239/BRD.md | Standard ticket folder |
| 2 | Call discoverDocuments(root) | File list |
| 3 | Assert BRD.md ticket = "KSA-239" | Extracted from folder |

---

### UT-017: isFileTooLarge — PDF Boundary at 50MB

| Field | Value |
|-------|-------|
| **ID** | UT-017 |
| **Priority** | High |
| **Level** | UT |
| **Requirement** | BR-08 |
| **Preconditions** | SIZE_LIMITS defined |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | isFileTooLarge("pdf", 50*1024*1024) | false (at limit = OK) |
| 2 | isFileTooLarge("pdf", 50*1024*1024 + 1) | true (over limit) |
| 3 | isFileTooLarge("pdf", 49*1024*1024) | false (under limit) |

---

### UT-018: isFileTooLarge — Image Boundary at 20MB

| Field | Value |
|-------|-------|
| **ID** | UT-018 |
| **Priority** | High |
| **Level** | UT |
| **Requirement** | BR-09 |
| **Preconditions** | SIZE_LIMITS defined |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | isFileTooLarge("png", 20*1024*1024) | false (at limit) |
| 2 | isFileTooLarge("png", 20*1024*1024 + 1) | true (over) |
| 3 | isFileTooLarge("jpg", 20*1024*1024 + 1) | true (jpg same limit) |

---

## 3. IT — Integration Tests

### IT-001: Convert Real .docx File

| Field | Value |
|-------|-------|
| **ID** | IT-001 |
| **Priority** | High |
| **Level** | IT |
| **Requirement** | UC-02, BRD Story 2 |
| **Preconditions** | filetomarkdown installed, test/fixtures/sample.docx |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Read test/fixtures/sample.docx (contains "Document Title" + table) | File exists |
| 2 | Call convertFileToMarkdown(fixturePath, "docx") | ConversionResult |
| 3 | Assert result.success === true | Converted |
| 4 | Assert result.markdown.length > 50 | Substantial content |
| 5 | Assert result.markdown contains "Document Title" | Heading preserved |
| 6 | Assert result.conversionTime < 5000 | Within NFR |

**Test Data:** test/fixtures/sample.docx with heading + 2-column table

---

### IT-002: Convert Real .xlsx File

| Field | Value |
|-------|-------|
| **ID** | IT-002 |
| **Priority** | High |
| **Level** | IT |
| **Requirement** | UC-02, BRD Story 2 |
| **Preconditions** | test/fixtures/data.xlsx exists |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Prepare data.xlsx (Sheet1: Name, Age, City) | File ready |
| 2 | Call convertFileToMarkdown(fixturePath, "xlsx") | ConversionResult |
| 3 | Assert result.success === true | Converted |
| 4 | Assert result.markdown contains table data | Content preserved |

**Test Data:** test/fixtures/data.xlsx — 3 columns, 5 rows

---

### IT-003: Convert Real .pdf File (Text-based)

| Field | Value |
|-------|-------|
| **ID** | IT-003 |
| **Priority** | High |
| **Level** | IT |
| **Requirement** | UC-02, BRD Story 3 |
| **Preconditions** | test/fixtures/spec.pdf (text-based, 3 pages) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call convertFileToMarkdown(fixturePath, "pdf") | ConversionResult |
| 2 | Assert result.success === true | Converted |
| 3 | Assert result.markdown contains text from multiple pages | Multi-page extraction |
| 4 | Assert result.conversionTime < 5000 | Within NFR |

---

### IT-004: Convert Real .png File

| Field | Value |
|-------|-------|
| **ID** | IT-004 |
| **Priority** | Medium |
| **Level** | IT |
| **Requirement** | UC-02, BRD Story 4 |
| **Preconditions** | test/fixtures/screenshot.png with visible text |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Call convertFileToMarkdown(fixturePath, "png") | ConversionResult |
| 2 | Assert result.success === true | Processed |
| 3 | Assert result.markdown.length > 0 | At least metadata extracted |

**Test Data:** test/fixtures/screenshot.png — UI screenshot with "Login" text

---

### IT-005: Text Format (.yaml) Direct Read

| Field | Value |
|-------|-------|
| **ID** | IT-005 |
| **Priority** | High |
| **Level** | IT |
| **Requirement** | BR-10 |
| **Preconditions** | test/fixtures/config.yaml |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Write config.yaml: "server:\n  port: 8080\n  host: localhost" | Real file |
| 2 | Call convertFileToMarkdown(fixturePath, "yaml") | ConversionResult |
| 3 | Assert result.success === true | Read ok |
| 4 | Assert result.markdown contains ```yaml wrapper | Format block |
| 5 | Assert result.markdown contains "port: 8080" | Content exact |

---

### IT-006: Error Isolation — Corrupt File in Batch

| Field | Value |
|-------|-------|
| **ID** | IT-006 |
| **Priority** | High |
| **Level** | IT |
| **Requirement** | BR-07 |
| **Preconditions** | valid.docx + corrupt.docx + valid2.md |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create corrupt.docx (random bytes) | Bad file |
| 2 | Convert batch: [valid.docx, corrupt.docx, valid2.md] | Pipeline runs |
| 3 | valid.docx: result.success | true |
| 4 | corrupt.docx: result.success | false |
| 5 | valid2.md: still processed (pipeline not aborted) | true |
| 6 | Stats: converted=1, skipped=1, directMarkdown=1 | Correct counts |

---

### IT-007: Size Limit — Skip Oversized PDF

| Field | Value |
|-------|-------|
| **ID** | IT-007 |
| **Priority** | High |
| **Level** | IT |
| **Requirement** | BR-08 |
| **Preconditions** | File with size > 50MB (or mock stat) |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create temp file > 50MB (or mock stat) | Large file |
| 2 | Call convertFileToMarkdown(largePath, "pdf") | ConversionResult |
| 3 | Assert result.success === false | Skipped |
| 4 | Assert filetomarkdown never called | Short-circuit |

---

### IT-008: Timeout Enforcement

| Field | Value |
|-------|-------|
| **ID** | IT-008 |
| **Priority** | High |
| **Level** | IT |
| **Requirement** | BR-11 |
| **Preconditions** | Mock filetomarkdown with artificial delay |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mock filetomarkdown to delay 35s | Slow conversion |
| 2 | Call convertFileToMarkdown with timeout=30000 | ConversionResult |
| 3 | Assert resolves in ~30s (not 35s) | Timeout enforced |
| 4 | Assert result.success === false | Aborted |

---

### IT-009: Full Discovery with Mixed Structure

| Field | Value |
|-------|-------|
| **ID** | IT-009 |
| **Priority** | High |
| **Level** | IT |
| **Requirement** | UC-01, BR-01, BR-02 |
| **Preconditions** | Realistic temp folder with diagrams/ and testdata/ |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create tmp folder mimicking: TEST-1/BRD.md, TEST-1/FSD.docx, TEST-1/diagrams/arch.drawio, TEST-1/testdata/data.csv | Structure |
| 2 | Call discoverDocuments(tmpRoot) | File list |
| 3 | Assert count = 2 (BRD.md + FSD.docx) | Correct |
| 4 | Assert arch.drawio not in results | Excluded |
| 5 | Assert data.csv not in results | Excluded |

---

### IT-010: Recursive Subdirectory Discovery

| Field | Value |
|-------|-------|
| **ID** | IT-010 |
| **Priority** | High |
| **Level** | IT |
| **Requirement** | BRD Story 7 |
| **Preconditions** | Nested folder structure in temp dir |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create: TEST-1/attachments/design.pdf, TEST-1/specs/api.yaml | Nested |
| 2 | Call discoverDocuments(tmpRoot) | File list |
| 3 | Assert both files found | Recursive scan works |

---

### IT-011: XML and YAML as Text Formats

| Field | Value |
|-------|-------|
| **ID** | IT-011 |
| **Priority** | Medium |
| **Level** | IT |
| **Requirement** | BR-10 |
| **Preconditions** | Real .xml and .yaml files |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create config.xml with "<root><item>test</item></root>" | XML file |
| 2 | convertFileToMarkdown(xmlPath, "xml") | result.markdown has ```xml block |
| 3 | Create deploy.yml with "deploy:\n  target: prod" | YAML file |
| 4 | convertFileToMarkdown(ymlPath, "yml") | result.markdown has ```yaml block |

---

### IT-012: Multiple Ticket Folders

| Field | Value |
|-------|-------|
| **ID** | IT-012 |
| **Priority** | High |
| **Level** | IT |
| **Requirement** | UC-01, BR-06 |
| **Preconditions** | Multiple ticket folders in temp dir |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create: KSA-1/BRD.md, KSA-2/FSD.docx, KSA-3/TDD.pdf | 3 tickets |
| 2 | Call discoverDocuments(tmpRoot) | File list |
| 3 | Assert 3 files found | All tickets scanned |
| 4 | Assert ticket fields: KSA-1, KSA-2, KSA-3 | Correctly extracted |

---

## 4. E2E-API — Full Pipeline Tests

### E2E-API-001: Pipeline — Markdown Only (Regression)

| Field | Value |
|-------|-------|
| **ID** | E2E-API-001 |
| **Priority** | High |
| **Level** | E2E-API |
| **Requirement** | UC-01, UC-03 |
| **Preconditions** | nock HTTP mock, .md files only |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | nock intercepts POST /api/memory/ingest-file, returns {ingested:1, skipped:0} | Mock ready |
| 2 | Create documents/TEST-1/BRD.md | File exists |
| 3 | Call indexDocuments(root) | IndexStats |
| 4 | Assert stats.totalDiscovered = 1 | Found |
| 5 | Assert stats.directMarkdown = 1 | Direct path |
| 6 | Assert stats.converted = 0 | No conversion |
| 7 | Verify nock intercepted POST with correct payload | HTTP called |

---

### E2E-API-002: Pipeline — Mixed Formats

| Field | Value |
|-------|-------|
| **ID** | E2E-API-002 |
| **Priority** | High |
| **Level** | E2E-API |
| **Requirement** | UC-01, UC-02, UC-03 |
| **Preconditions** | nock mock, mix of file formats |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | nock accepts POST | Mock ready |
| 2 | Create: BRD.md, FSD.docx, notes.txt | 3 formats |
| 3 | Call indexDocuments(root) | IndexStats |
| 4 | Assert stats.totalDiscovered = 3 | All found |
| 5 | Assert stats.directMarkdown = 1 | .md direct |
| 6 | Assert stats.converted = 2 | docx + txt converted |
| 7 | Assert nock called with 3 files | All ingested |

---

### E2E-API-003: Pipeline — Error Isolation

| Field | Value |
|-------|-------|
| **ID** | E2E-API-003 |
| **Priority** | High |
| **Level** | E2E-API |
| **Requirement** | BR-07 |
| **Preconditions** | Includes corrupt file |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create: valid.md, corrupt.docx, valid2.txt | 1 bad |
| 2 | Call indexDocuments(root) | IndexStats (no throw) |
| 3 | Assert stats.skipped = 1 | Corrupt skipped |
| 4 | Assert stats.ingested = 2 | Others succeeded |
| 5 | Assert no exception thrown | Pipeline resilient |

---

### E2E-API-004: Pipeline — Idempotency

| Field | Value |
|-------|-------|
| **ID** | E2E-API-004 |
| **Priority** | High |
| **Level** | E2E-API |
| **Requirement** | BR-12 |
| **Preconditions** | nock returns skipped on second call |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | First call: nock returns {ingested:3, skipped:0} | Fresh index |
| 2 | Second call: nock returns {ingested:0, skipped:3} | Unchanged |
| 3 | Assert second stats.ingested = 0 | No duplicates |
| 4 | Assert second stats.skipped = 3 | All skipped |

---

### E2E-API-005: Pipeline — MCP Server Down

| Field | Value |
|-------|-------|
| **ID** | E2E-API-005 |
| **Priority** | High |
| **Level** | E2E-API |
| **Requirement** | AF-03b |
| **Preconditions** | nock rejects connection |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | nock.disableNetConnect() (simulates server down) | Unreachable |
| 2 | Create valid .md file | File exists |
| 3 | Call indexDocuments(root) | Handles gracefully |
| 4 | Assert error reported | "Cannot reach MCP server" |
| 5 | Assert no crash | Function returns |

---

### E2E-API-006: Pipeline — 50-File Batch Performance

| Field | Value |
|-------|-------|
| **ID** | E2E-API-006 |
| **Priority** | High |
| **Level** | E2E-API |
| **Requirement** | NFR (50 files < 2 min) |
| **Preconditions** | 50 files, nock mock |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create 50 files (20 .md, 15 .txt, 10 .docx, 5 .pdf) | Batch ready |
| 2 | Start timer | t0 |
| 3 | Call indexDocuments(root) | IndexStats |
| 4 | Assert stats.totalDiscovered = 50 | All found |
| 5 | Assert elapsed < 120000ms | Within 2 minutes |

---

### E2E-API-007: Ingestion Payload Format

| Field | Value |
|-------|-------|
| **ID** | E2E-API-007 |
| **Priority** | High |
| **Level** | E2E-API |
| **Requirement** | BR-13, BR-14 |
| **Preconditions** | nock captures request body |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Setup nock to capture POST body | Ready |
| 2 | Create BRD.docx and run pipeline | Converted + sent |
| 3 | Inspect body.files[0].file_path | Relative path |
| 4 | Inspect body.files[0].type | "REQUIREMENT" |
| 5 | Inspect body.files[0].format | "markdown" |

---

### E2E-API-008: Content Field for Converted Files

| Field | Value |
|-------|-------|
| **ID** | E2E-API-008 |
| **Priority** | High |
| **Level** | E2E-API |
| **Requirement** | TDD 4.2 |
| **Preconditions** | nock captures body |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create .docx, mock conversion returns "converted md" | Setup |
| 2 | Run pipeline | Ingestion called |
| 3 | Inspect payload for .docx entry | Has content field |
| 4 | Assert content = "converted md" | Pre-converted passed |
| 5 | For .md file entry | content field absent or matches file read |

---

## 5. E2E-UI — VS Code Extension Tests

### E2E-UI-001: Updated Quick Pick Label

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-001 |
| **Priority** | Medium |
| **Level** | E2E-UI |
| **Requirement** | BR-17, BRD Story 6 |
| **Preconditions** | Extension loaded in @vscode/test-electron |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Activate extension | Ready |
| 2 | Execute index workspace command | Quick pick appears |
| 3 | Find document index option label | Present |
| 4 | Assert label contains "Index all SDLC documents" | Updated text |

---

### E2E-UI-002: Progress Notification Shows During Indexing

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-002 |
| **Priority** | Medium |
| **Level** | E2E-UI |
| **Requirement** | UC-04, BR-15 |
| **Preconditions** | Sample docs in test workspace |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create .md file in test workspace | File ready |
| 2 | Trigger index documents | Command fires |
| 3 | Verify withProgress called | Progress API used |
| 4 | Verify cancellable = false | Non-cancellable |

---

### E2E-UI-003: Output Channel Populated

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-003 |
| **Priority** | Medium |
| **Level** | E2E-UI |
| **Requirement** | UC-04, BRD Story 5 |
| **Preconditions** | Multiple files in workspace |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create BRD.md + FSD.docx | 2 files |
| 2 | Trigger index | Runs |
| 3 | Get output channel "SDLC Indexing" content | Has entries |
| 4 | Assert per-file entries present | Each file logged |

---

### E2E-UI-004: Completion Toast

| Field | Value |
|-------|-------|
| **ID** | E2E-UI-004 |
| **Priority** | Medium |
| **Level** | E2E-UI |
| **Requirement** | UC-04 |
| **Preconditions** | Indexing completes |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run indexing to completion | Done |
| 2 | Verify showInformationMessage called | Toast shown |
| 3 | Assert message contains counts | Summary visible |

---

## 6. SIT — Manual System Integration Tests

### SIT-001: Real Office Documents E2E

| Field | Value |
|-------|-------|
| **ID** | SIT-001 |
| **Priority** | High |
| **Level** | SIT (Manual) |
| **Requirement** | BRD Stories 1-4 |
| **Preconditions** | Extension installed, MCP server running |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Place BRD.docx, FSD.xlsx, design.pdf in documents/TEST/ | Files ready |
| 2 | Trigger Index Documents | Progress shows |
| 3 | Check Output panel for per-file logs | Logged |
| 4 | mem_search for .docx content | Found |
| 5 | mem_search for .xlsx content | Found |
| 6 | mem_search for .pdf content | Found |

**Pass Criteria:** All formats discoverable via KB search

---

### SIT-002: Edge Cases — Corrupt and Protected Files

| Field | Value |
|-------|-------|
| **ID** | SIT-002 |
| **Priority** | High |
| **Level** | SIT (Manual) |
| **Requirement** | EF-02a to EF-02d |
| **Preconditions** | Corrupt .docx, password-protected .pdf |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Place corrupt.docx + protected.pdf + valid.md | Mix |
| 2 | Trigger Index Documents | Completes (no crash) |
| 3 | Check Output: warnings for bad files | Clear warnings |
| 4 | Verify valid.md indexed | Searchable |
| 5 | Verify counts: skipped=2, ingested=1 | Accurate |

---

### SIT-003: Large File Handling

| Field | Value |
|-------|-------|
| **ID** | SIT-003 |
| **Priority** | Medium |
| **Level** | SIT (Manual) |
| **Requirement** | BR-08, BR-09 |
| **Preconditions** | 60MB PDF + 25MB PNG + normal 1MB .docx |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Place all 3 files in documents/TEST/ | Ready |
| 2 | Trigger Index Documents | Runs |
| 3 | Large files skipped quickly | No long wait |
| 4 | Output shows "exceeds size limit" | Clear |
| 5 | Normal .docx indexed | Searchable |

---

### SIT-004: Progress UX Visual Verification

| Field | Value |
|-------|-------|
| **ID** | SIT-004 |
| **Priority** | Medium |
| **Level** | SIT (Manual) |
| **Requirement** | UC-04, BRD Story 5 |
| **Preconditions** | 10+ files of mixed formats |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Place 10+ mixed files | Ready |
| 2 | Trigger and observe notification | Progress bar visible |
| 3 | Watch progression: Discovering... Converting... Indexing... | Logical sequence |
| 4 | Completion toast shows | Accurate counts |
| 5 | No cancel button | Non-cancellable |

---

### SIT-005: Directory Exclusion Verification

| Field | Value |
|-------|-------|
| **ID** | SIT-005 |
| **Priority** | Medium |
| **Level** | SIT (Manual) |
| **Requirement** | BR-01, BR-02 |
| **Preconditions** | Folder with diagrams/, testdata/, attachments/ |

**Test Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Structure: BRD.md + diagrams/arch.drawio + testdata/data.csv + attachments/spec.pdf | Full layout |
| 2 | Trigger Index Documents | Runs |
| 3 | Output shows BRD.md + spec.pdf | Included |
| 4 | Output does NOT show arch.drawio | Excluded |
| 5 | Output does NOT show data.csv | Excluded |

---

## 7. Requirements Traceability Matrix (RTM)

| Requirement | Source | Test Cases | Coverage |
|-------------|--------|------------|----------|
| UC-01 | FSD 3.1 | PBT-001, PBT-002, UT-010 to UT-016, IT-009, IT-010, IT-012, E2E-API-001 | Covered |
| UC-02 | FSD 3.2 | UT-001 to UT-009, IT-001 to IT-008, IT-011, E2E-API-002, E2E-API-003 | Covered |
| UC-03 | FSD 3.3 | E2E-API-001 to E2E-API-008 | Covered |
| UC-04 | FSD 3.4 | E2E-UI-001 to E2E-UI-004, SIT-004 | Covered |
| BR-01 | FSD 3.1.3 | UT-010, IT-009, SIT-005 | Covered |
| BR-02 | FSD 3.1.3 | UT-011, IT-009, SIT-005 | Covered |
| BR-03 | FSD 3.1.3 | PBT-001, UT-013 | Covered |
| BR-04 | FSD 3.1.3 | PBT-002, UT-014 | Covered |
| BR-05 | FSD 3.1.3 | PBT-002, UT-015 | Covered |
| BR-06 | FSD 3.1.3 | UT-016, IT-012 | Covered |
| BR-07 | FSD 3.2.3 | UT-008, IT-006, E2E-API-003, SIT-002 | Covered |
| BR-08 | FSD 3.2.3 | UT-004, UT-017, IT-007, SIT-003 | Covered |
| BR-09 | FSD 3.2.3 | UT-005, UT-018, SIT-003 | Covered |
| BR-10 | FSD 3.2.3 | PBT-003, UT-001 to UT-003, IT-005, IT-011 | Covered |
| BR-11 | FSD 3.2.3 | UT-006, IT-008 | Covered |
| BR-12 | FSD 3.3.3 | PBT-003, E2E-API-004 | Covered |
| BR-13 | FSD 3.3.3 | E2E-API-007 | Covered |
| BR-14 | FSD 3.3.3 | E2E-API-007 | Covered |
| BR-15 | FSD 3.4.2 | E2E-UI-002, SIT-004 | Covered |
| BR-16 | FSD 3.4.2 | E2E-UI-003 | Covered |
| BR-17 | FSD 3.4.2 | E2E-UI-001, SIT-004 | Covered |
| Story 1 | BRD 2.3 | IT-009, E2E-API-002, SIT-001 | Covered |
| Story 2 | BRD 2.3 | IT-001, IT-002, SIT-001 | Covered |
| Story 3 | BRD 2.3 | IT-003, SIT-001 | Covered |
| Story 4 | BRD 2.3 | IT-004, SIT-001 | Covered |
| Story 5 | BRD 2.3 | E2E-UI-002 to E2E-UI-004, SIT-004 | Covered |
| Story 6 | BRD 2.3 | E2E-UI-001 | Covered |
| Story 7 | BRD 2.3 | UT-010 to UT-012, IT-009, IT-010, SIT-005 | Covered |
| Story 8 | BRD 2.3 | PBT-002, UT-015 | Covered |

**Coverage Summary:**

| Category | Total | Covered | Coverage % |
|----------|-------|---------|------------|
| Use Cases (UC) | 4 | 4 | 100% |
| Business Rules (BR) | 17 | 17 | 100% |
| User Stories | 8 | 8 | 100% |
| **Overall** | **29** | **29** | **100%** |

---

## 8. Test Data Files

| File | Location | Purpose |
|------|----------|---------|
| discovery-test-data.csv | documents/KSA-239/testdata/ | File paths + expected types/formats for PBT/UT |
| conversion-test-data.csv | documents/KSA-239/testdata/ | File formats + expected conversion outcomes |
| size-limit-test-data.csv | documents/KSA-239/testdata/ | Format + size boundary values |
