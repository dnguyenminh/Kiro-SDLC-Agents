# Functional Specification Document (FSD)

## Kiro SDLC Agents — KSA-239: Multi-format Document Indexing

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-239 |
| Title | Multi-format document indexing — support docx/xlsx/pdf/image in Index Documents |
| Author | BA Agent + TA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Related BRD | BRD-v1-KSA-239.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-07-14 | BA Agent | Initiate document — auto-generated from BRD KSA-239 |
| 1.0 | 2025-07-14 | TA Agent | Technical enrichment — API contracts, pseudocode, integration specs |

---

## 1. Introduction

### 1.1 Purpose

This FSD specifies the functional behavior of the multi-format document indexing feature for the Kiro SDLC Agents VS Code extension. It details how the indexer discovers, converts, and ingests documents of various formats into the Knowledge Base.

### 1.2 Scope

Expanding `kiro-sdlc-agents/src/indexer.ts` to:
- Discover all supported file formats in ticket folders (not just .md)
- Convert non-markdown files to markdown using `filetomarkdown` npm package
- Ingest converted content into KB via existing MCP server HTTP API
- Show conversion/indexing progress to user

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| KB | Knowledge Base — semantic search database for AI agent context |
| MCP | Model Context Protocol — communication standard for AI agents |
| filetomarkdown | npm package for file conversion |
| Ingestion | Process of converting and storing content into KB for retrieval |
| INDEXABLE_EXTENSIONS | Set of file extensions recognized by the scanner |
| DOCUMENT_TYPES | Mapping from filename to KB entry type classification |

### 1.4 References

| Document | Location |
|----------|----------|
| BRD | BRD-v1-KSA-239.docx |
| Current indexer.ts | kiro-sdlc-agents/src/indexer.ts |
| filetomarkdown | https://github.com/jojomondag/FileToMarkdown |

---

## 2. System Overview

### 2.1 System Context Diagram

![System Context](diagrams/system-context.png)

The multi-format indexing feature operates within the VS Code extension, interacting with:
- **Developer (User):** Triggers indexing via command palette
- **File System:** Reads documents from `documents/{TICKET}/` folders
- **filetomarkdown package:** Converts non-markdown files to markdown text
- **MCP Server (KB):** Receives converted markdown for semantic indexing
- **AI Agents:** Query KB to find indexed content from any format

### 2.2 System Architecture

The feature is contained within the existing indexer module:
```
User → VS Code Command → indexer.ts → discoverDocuments() → convertFiles() → ingestViaHttp()
                                              ↓                      ↓                ↓
                                         File System          filetomarkdown      MCP Server
```

---

## 3. Functional Requirements

### 3.1 Feature: Multi-format File Discovery

**Source:** BRD Story 1, Story 7

#### 3.1.1 Description

The document discovery function recursively scans all ticket folders under `documents/`, identifying indexable files by their extension. It categorizes each file by document type and format for downstream conversion routing.

#### 3.1.2 Use Case

**Use Case ID:** UC-01
**Actor:** Developer
**Preconditions:** Workspace has `documents/` folder with at least one ticket subfolder
**Postconditions:** List of discovered files with type and format metadata

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | Selects "Index Documents" | | User triggers indexing |
| 2 | | Scans documents/ root | Finds ticket folders matching `[A-Z]+-\d+` pattern |
| 3 | | Enters each ticket folder | Recursively scans subdirectories |
| 4 | | Checks each file extension | Matches against INDEXABLE_EXTENSIONS set |
| 5 | | Categorizes file | Maps filename to DOCUMENT_TYPES or defaults to CONTEXT |
| 6 | | Returns file list | Array of {path, type, ticket, format} |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-01a | No ticket folders found | Return empty array, show "No documents found" message |
| AF-01b | Ticket folder has no indexable files | Skip folder, continue with next |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-01a | Permission denied reading directory | Log warning, skip directory, continue |
| EF-01b | Symlink loop detected | Skip directory after max depth (10 levels) |

#### 3.1.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-01 | Files in `diagrams/` subdirectory are excluded from scanning | BRD Story 7 |
| BR-02 | Files in `testdata/` subdirectory are excluded from scanning | BRD Story 7 |
| BR-03 | Only files with extensions in INDEXABLE_EXTENSIONS are processed | BRD Story 1 |
| BR-04 | Filename base (uppercase) determines document type via DOCUMENT_TYPES map | BRD Story 8 |
| BR-05 | Files not matching any DOCUMENT_TYPES key are classified as CONTEXT | BRD Story 8 |
| BR-06 | Folder name must match `[A-Z]+-\d+` pattern to be treated as ticket folder | Existing behavior |

#### 3.1.4 Data Specifications

**Input Data:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| root | string | Y | Must be valid workspace path | Workspace root directory |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| path | string | Relative path from workspace root |
| type | string | REQUIREMENT, ARCHITECTURE, PROCEDURE, or CONTEXT |
| ticket | string | Ticket key extracted from folder name |
| format | string | File format for conversion routing |

---

### 3.2 Feature: File Conversion Pipeline

**Source:** BRD Stories 2, 3, 4

#### 3.2.1 Description

Non-markdown files are converted to markdown text before ingestion. The conversion pipeline routes files to the appropriate converter based on format, handles errors gracefully, and tracks conversion statistics.

#### 3.2.2 Use Case

**Use Case ID:** UC-02
**Actor:** System (automatic after discovery)
**Preconditions:** File list from UC-01 contains non-markdown files
**Postconditions:** All convertible files have markdown text ready for ingestion

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Separates files by format | markdown files go directly, non-md need conversion |
| 2 | | Reads file from disk | Uses fs.readFileSync with appropriate encoding |
| 3 | | Calls filetomarkdown | Passes file buffer/path to conversion function |
| 4 | | Receives markdown output | Converted text string |
| 5 | | Validates output | Checks non-empty string returned |
| 6 | | Adds to ingestion queue | Pairs markdown with metadata |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-02a | File is .md format | Skip conversion, read content directly |
| AF-02b | File is text-based (.txt, .csv, .json, .xml, .yaml) | Read as UTF-8 text, wrap in code block |
| AF-02c | Conversion returns empty string | Log warning, index with metadata only |

**Exception Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| EF-02a | File too large (>50MB PDF, >20MB image) | Log warning, skip, continue |
| EF-02b | filetomarkdown throws error | Log error, skip, continue |
| EF-02c | File is password-protected | Log warning, skip, continue |
| EF-02d | File cannot be read | Log warning, skip, continue |

#### 3.2.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-07 | One file failure must not abort entire batch | BRD NFR |
| BR-08 | PDF files > 50MB are skipped | BRD Risk |
| BR-09 | Image files > 20MB are skipped | BRD Story 4 |
| BR-10 | Text-based formats are read directly (no conversion needed) | Optimization |
| BR-11 | Conversion timeout: 30 seconds per file | Performance |

#### 3.2.5 API Contract — Conversion Function

**Function:** `convertFileToMarkdown(filePath: string, format: string): Promise<ConversionResult>`

**Input Parameters:**

| Parameter | Type | Required | Business Rule | Description |
|-----------|------|----------|---------------|-------------|
| filePath | string | Y | Must exist | Absolute path to file |
| format | string | Y | BR-03 | Extension without dot |

**Output Data:**

| Field | Type | Description |
|-------|------|-------------|
| markdown | string | Converted markdown text |
| success | boolean | Whether conversion succeeded |
| error | string or null | Error description if failed |
| bytesProcessed | number | Original file size |

**Business Error Scenarios:**

| Scenario | User Message | Trigger Condition |
|----------|-------------|-------------------|
| File too large | "Skipped {filename}: exceeds size limit" | BR-08, BR-09 |
| Conversion error | "Failed to convert {filename}: {error}" | filetomarkdown throws |
| Timeout | "Conversion timeout: {filename} (>30s)" | BR-11 exceeded |

---

### 3.3 Feature: KB Ingestion via HTTP API

**Source:** BRD Story 1

#### 3.3.1 Description

After conversion, all markdown content is sent to MCP server HTTP API for KB ingestion.

#### 3.3.2 Use Case

**Use Case ID:** UC-03
**Actor:** System (automatic after conversion)
**Preconditions:** Markdown content ready; MCP server running
**Postconditions:** Content ingested into KB, searchable by agents

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Resolves MCP server port | From .kiro/settings/mcp.json |
| 2 | | Builds payload | Array of {file_path, type, format} |
| 3 | | POST /api/memory/ingest-file | HTTP request |
| 4 | | Receives response | {ingested, skipped} counts |
| 5 | | Reports results | Shows to user |

**Alternative Flows:**

| ID | Condition | Steps |
|----|-----------|-------|
| AF-03a | File unchanged | Server returns "skipped" |
| AF-03b | Server not running | Show error message |

#### 3.3.3 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-12 | Re-indexing unchanged files is idempotent | BRD NFR |
| BR-13 | Payload includes source path for provenance | Data lineage |
| BR-14 | Format field always "markdown" for ingestion | API contract |

#### 3.3.4 API Contract — Ingestion Endpoint

**Endpoint:** `POST http://localhost:{port}/api/memory/ingest-file`

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| files | Array | Y | Files to ingest |
| files[].file_path | string | Y | Relative path |
| files[].type | string | Y | REQUIREMENT/ARCHITECTURE/PROCEDURE/CONTEXT |
| files[].format | string | Y | Always "markdown" |

**Output:**

| Field | Type | Description |
|-------|------|-------------|
| ingested | number | Successfully ingested count |
| skipped | number | Unchanged files skipped |

---

### 3.4 Feature: Progress Notification

**Source:** BRD Story 5, Story 6

#### 3.4.1 Use Case

**Use Case ID:** UC-04
**Actor:** Developer (observer)

**Main Flow:**

| Step | Actor | System | Description |
|------|-------|--------|-------------|
| 1 | | Shows notification | "Discovering documents..." |
| 2 | | Updates | "Found {N} files ({M} need conversion)" |
| 3 | | Updates | "Converting {X}/{M} files..." |
| 4 | | Updates | "Indexing {Y} files..." |
| 5 | | Completion toast | Final summary counts |
| 6 | | Output panel | Per-file detailed log |

#### 3.4.2 Business Rules

| Rule ID | Rule | Source |
|---------|------|--------|
| BR-15 | Progress is non-cancellable | BRD Story 5 |
| BR-16 | Output channel: "SDLC Indexing" | Existing |
| BR-17 | Label: "Index all SDLC documents into Knowledge Base" | BRD Story 6 |

---

## 4. Data Model

### 4.1 Type Definitions

```typescript
interface ConversionResult {
    markdown: string;
    success: boolean;
    error: string | null;
    originalSize: number;
    conversionTime: number;
}

interface DiscoveredDocument {
    path: string;      // Relative from workspace root
    type: string;      // REQUIREMENT | ARCHITECTURE | PROCEDURE | CONTEXT
    ticket: string;    // Ticket key (e.g., "KSA-239")
    format: string;    // Extension without dot
}

interface IndexStats {
    totalDiscovered: number;
    directMarkdown: number;
    converted: number;
    skipped: number;
    ingested: number;
}
```

---

## 5. Integration Specifications

### 5.1 filetomarkdown npm package

| Attribute | Value |
|-----------|-------|
| Purpose | Convert Office/PDF/Image files to markdown |
| Direction | Outbound (library call) |
| Format | File buffer → markdown string |
| Frequency | On-demand during indexing |

### 5.2 MCP Server HTTP API

| Attribute | Value |
|-----------|-------|
| Purpose | Ingest markdown into KB |
| Direction | Outbound (HTTP POST) |
| Format | JSON payload → JSON response |
| Frequency | On-demand during indexing |

---

## 6. Processing Logic

### 6.1 Document Indexing Pipeline

**Pseudocode:**

```typescript
async function indexDocuments(root: string): Promise<IndexStats> {
    const stats: IndexStats = { totalDiscovered: 0, directMarkdown: 0, converted: 0, skipped: 0, ingested: 0 };
    
    // Step 1: Discover
    const files = discoverDocuments(root);
    stats.totalDiscovered = files.length;
    
    // Step 2: Separate by format
    const mdFiles = files.filter(f => f.format === 'markdown');
    const nonMdFiles = files.filter(f => f.format !== 'markdown');
    stats.directMarkdown = mdFiles.length;
    
    // Step 3-5: Convert non-markdown files
    const convertedFiles: Array<DiscoveredDocument & { markdown: string }> = [];
    for (const file of nonMdFiles) {
        const absPath = path.join(root, file.path);
        const fileSize = fs.statSync(absPath).size;
        
        // Size limit check
        if (isFileTooLarge(file.format, fileSize)) {
            stats.skipped++;
            continue;
        }
        
        // Text-based: read directly
        if (isTextFormat(file.format)) {
            const content = fs.readFileSync(absPath, 'utf-8');
            convertedFiles.push({ ...file, markdown: wrapTextContent(content, file.format) });
            stats.converted++;
            continue;
        }
        
        // Binary: convert via filetomarkdown with timeout
        try {
            const result = await convertWithTimeout(absPath, file.format, 30000);
            if (result.success && result.markdown) {
                convertedFiles.push({ ...file, markdown: result.markdown });
                stats.converted++;
            } else {
                stats.skipped++;
            }
        } catch (err) {
            stats.skipped++;
        }
    }
    
    // Step 6-7: Ingest all into KB
    const allFiles = [...mdFiles, ...convertedFiles];
    const result = await ingestDocumentsViaHttp(allFiles, report);
    stats.ingested = result.ingested;
    
    return stats;
}
```

---

## 7. Security Requirements

### 7.1 Constraints

- Only access files within workspace `documents/` folder
- All network calls go to localhost only
- File content never transmitted externally
- filetomarkdown runs in-process (no external service)
- No additional authentication needed

---

## 8. Non-Functional Requirements

| Category | Requirement | Acceptance Criteria |
|----------|-------------|---------------------|
| Performance | Single file conversion | < 5s for files under 10MB |
| Performance | Batch indexing | 50 files within 2 minutes |
| Reliability | Error isolation | One failure doesn't stop batch |
| Reliability | Idempotency | Unchanged files skipped |
| Compatibility | OS | Windows, macOS, Linux |
| Memory | During conversion | Extension increase < 100MB |

---

## 9. Error Handling

### 9.1 Error Scenarios

| Scenario | Severity | User Message | Recovery |
|----------|----------|-------------|----------|
| MCP server down | Critical | "Cannot reach MCP server at port {port}" | Start server |
| File too large | Warning | "Skipped: exceeds limit" | Reduce file or increase limit |
| Conversion failed | Warning | "Failed to convert: {error}" | Check file integrity |
| No documents | Info | "No documents found" | Add documents to folder |
| Permission denied | Warning | "Cannot read: permission denied" | Fix permissions |
| Timeout | Warning | "Timeout converting (>30s)" | Split large file |

---

## 10. Testing Considerations

| ID | Scenario | Priority |
|----|----------|----------|
| TC-01 | Index .md files only (existing behavior) | High |
| TC-02 | Convert and index .docx | High |
| TC-03 | Convert and index .pdf | High |
| TC-04 | Convert and index .xlsx | High |
| TC-05 | Convert and index .png (image) | Medium |
| TC-06 | Skip diagrams/ folder | High |
| TC-07 | Skip testdata/ folder | High |
| TC-08 | Handle file too large | Medium |
| TC-09 | Handle corrupt file | High |
| TC-10 | Handle server down | High |
| TC-11 | Mixed format batch | High |
| TC-12 | Text file direct read | Medium |
| TC-13 | Unknown type → CONTEXT | Medium |
| TC-14 | Progress notification accuracy | Medium |
| TC-15 | Recursive nested dirs | Medium |

---

## 11. Appendix

### State Diagram — File Processing

![State Diagram](diagrams/state-file-processing.png)

### Sequence Diagram — Indexing Flow

![Sequence Diagram](diagrams/sequence-indexing.png)

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | System Context | [system-context.png](diagrams/system-context.png) | [system-context.drawio](diagrams/system-context.drawio) |
| 2 | Sequence — Indexing Flow | [sequence-indexing.png](diagrams/sequence-indexing.png) | [sequence-indexing.drawio](diagrams/sequence-indexing.drawio) |
| 3 | State — File Processing | [state-file-processing.png](diagrams/state-file-processing.png) | [state-file-processing.drawio](diagrams/state-file-processing.drawio) |
