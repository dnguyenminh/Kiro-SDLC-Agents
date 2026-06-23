# Business Requirements Document (BRD)

## Kiro SDLC Agents — KSA-239: Multi-format Document Indexing

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-239 |
| Title | Multi-format document indexing — support docx/xlsx/pdf/image in Index Documents |
| Author | BA Agent |
| Version | 1.0 |
| Date | 2025-07-14 |
| Status | Draft |
| Architecture Pattern | Plugin (VS Code Extension) |

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
| 1.0 | 2025-07-14 | BA Agent | Initiate document — auto-generated from Jira ticket KSA-239 |

---

## Sign-Off

| Name | Signature and date |
|------|--------------------|
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |
| | ☐ I agree and confirm all criteria on this BRD as expected requirements |

---

## 1. Introduction

### 1.1 Scope

This change request expands the "Index Documents" feature of the Kiro SDLC Agents VS Code extension to support all common document formats beyond Markdown. Currently, the document indexer (`kiro-sdlc-agents/src/indexer.ts`) only indexes `.md` files into the Knowledge Base. This enhancement adds conversion of Office documents (.docx, .xlsx, .pptx), PDF, images (.png, .jpg), text-based formats (.txt, .csv, .json, .xml, .yaml), and rich text (.rtf, .odt) to Markdown before ingestion.

The solution leverages the `filetomarkdown` npm package to perform format conversion, maintaining the existing KB ingestion pipeline while broadening the input funnel.

### 1.2 Out of Scope

- Changes to the Knowledge Base storage or search backend
- Changes to the MCP server API endpoints
- OCR quality tuning or custom model training for image conversion
- Conversion of binary/executable files
- Conversion of video or audio files
- Changes to the code indexing feature (only document indexing affected)
- Custom conversion rules per file type

### 1.3 Preliminary Requirement

- `filetomarkdown` npm package must be compatible with the VS Code extension bundling (esbuild)
- The existing `discoverDocuments()` function already supports multi-format file discovery (INDEXABLE_EXTENSIONS set) — this was pre-scaffolded
- MCP server HTTP API `/api/memory/ingest-file` must accept converted markdown content

---

## 2. Business Requirements

### 2.1 High Level Process Map

The document indexing process follows this high-level flow:

1. User triggers "Index Documents" from the VS Code command palette or quick pick
2. System recursively scans all ticket folders under `documents/` for indexable files
3. For each file found:
   - If `.md` → ingest directly (current behavior, unchanged)
   - If non-markdown but supported format → convert to markdown via `filetomarkdown`, then ingest
   - If unsupported format → skip with warning
4. System reports progress (files discovered, converted, indexed, skipped)
5. All indexed content becomes searchable by AI agents via KB semantic search

### 2.2 List of User Stories / Use Cases

| # | Story / Use Case | Priority | Source Ticket |
|---|------------------|----------|---------------|
| 1 | As a developer using Kiro SDLC, I want all document formats in my ticket folders to be indexed so that AI agents can find information regardless of file format | MUST HAVE | KSA-239 |
| 2 | As a developer, I want Office documents (.docx, .xlsx, .pptx) converted and indexed so that exported deliverables are searchable | MUST HAVE | KSA-239 |
| 3 | As a developer, I want PDF files converted and indexed so that attached specifications are searchable | MUST HAVE | KSA-239 |
| 4 | As a developer, I want image files (.png, .jpg) converted and indexed so that diagram content is extractable | SHOULD HAVE | KSA-239 |
| 5 | As a developer, I want clear progress feedback during indexing showing conversion + ingestion counts | MUST HAVE | KSA-239 |
| 6 | As a developer, I want the UI label to clearly indicate all documents are indexed (not just markdown) | MUST HAVE | KSA-239 |
| 7 | As a developer, I want recursive scanning of ticket subfolders (excluding diagrams/ and testdata/) so that nested documents are found | MUST HAVE | KSA-239 |
| 8 | As a developer, I want unknown file types to be indexed as CONTEXT type so no information is lost | SHOULD HAVE | KSA-239 |

---

### 2.3 Details of User Stories

---

#### Business Flow

**Step 1:** User opens command palette and selects "Kiro SDLC: Index Workspace" or clicks the index button

**Step 2:** User selects "Index Documents" from the quick pick options

**Step 3:** System scans `documents/` folder recursively, discovering all files matching INDEXABLE_EXTENSIONS

**Step 4:** System categorizes files: markdown (direct ingest) vs non-markdown (needs conversion)

**Step 5:** For each non-markdown file, system calls `filetomarkdown` to convert to markdown text

**Step 6:** System sends all markdown content (direct + converted) to MCP server via HTTP API for KB ingestion

**Step 7:** System displays progress notification: "Converting X files... Indexing Y files..."

**Step 8:** System shows completion summary in Output panel: total files, converted count, indexed count, skipped count

> **Note:** The `diagrams/` and `testdata/` subdirectories within each ticket folder are excluded from scanning to avoid indexing raw diagram XML and test fixture data.

---

#### STORY 1: Multi-format File Discovery

> As a developer using Kiro SDLC, I want all document formats in my ticket folders to be indexed so that AI agents can find information regardless of file format.

**Requirement Details:**

1. The `discoverDocuments()` function must scan for all extensions in the INDEXABLE_EXTENSIONS set
2. Recursive scanning into subdirectories (except `diagrams/` and `testdata/`)
3. Each discovered file is categorized by its document type (BRD, FSD, TDD, etc.) based on filename, or CONTEXT if unknown
4. File format is determined by extension for conversion routing

**Data Fields:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| path | string | Yes | Relative path from workspace root | `documents/KSA-239/BRD.docx` |
| type | string | Yes | Document type classification | `REQUIREMENT`, `ARCHITECTURE`, `CONTEXT` |
| ticket | string | Yes | Ticket key extracted from folder name | `KSA-239` |
| format | string | Yes | File format for conversion routing | `markdown`, `docx`, `pdf`, `png` |

**Acceptance Criteria:**

1. When user selects "Index Documents", ALL files in ticket folders are scanned (not just .md)
2. Supported extensions: .md, .docx, .doc, .xlsx, .xls, .pptx, .ppt, .pdf, .png, .jpg, .jpeg, .gif, .bmp, .webp, .svg, .txt, .csv, .json, .xml, .yaml, .yml, .rtf, .odt, .ods, .odp
3. Files in `diagrams/` and `testdata/` subdirectories are excluded
4. Each file is correctly typed based on filename (BRD→REQUIREMENT, TDD→ARCHITECTURE, etc.)
5. Files not matching known document names are typed as CONTEXT

---

#### STORY 2: Office Document Conversion (.docx, .xlsx, .pptx)

> As a developer, I want Office documents converted and indexed so that exported deliverables are searchable.

**Requirement Details:**

1. System uses `filetomarkdown` package to convert Office files to markdown
2. Conversion preserves document structure: headings, tables, lists, bold/italic
3. .xlsx conversion preserves table structure (rows and columns)
4. .pptx conversion extracts slide text content
5. Converted markdown is passed to KB ingestion API

**Acceptance Criteria:**

1. .docx files are converted to markdown, preserving headings and tables
2. .xlsx files are converted with table structure intact
3. .pptx files extract text content from all slides
4. Converted content is successfully ingested into KB
5. Agents can find content from .docx/.xlsx/.pptx via `mem_search`

**Error Handling:**

- Corrupted Office file: Log warning, skip file, continue with remaining files
- Password-protected file: Log warning "File is password-protected, skipping", continue
- Empty file: Skip silently (no warning needed)

---

#### STORY 3: PDF Conversion

> As a developer, I want PDF files converted and indexed so that attached specifications are searchable.

**Requirement Details:**

1. System uses `filetomarkdown` to extract text from PDF files
2. Text-based PDFs: full text extraction
3. Image-based/scanned PDFs: best-effort OCR via the package's capabilities
4. Multi-page PDFs: all pages combined into single markdown output

**Acceptance Criteria:**

1. Text-based PDF files are converted to markdown with content preserved
2. Multi-page PDFs produce combined output from all pages
3. Converted PDF content is ingested into KB
4. Agents can search and find PDF-sourced content

**Error Handling:**

- Encrypted PDF: Log warning, skip file
- Very large PDF (>50MB): Log warning, skip file
- Scanned PDF with no extractable text: Ingest with metadata-only (filename, type)

---

#### STORY 4: Image Conversion

> As a developer, I want image files converted and indexed so that diagram content is extractable.

**Requirement Details:**

1. System uses `filetomarkdown` to process images
2. Image conversion produces descriptive text (OCR or description)
3. Useful for: screenshots of UI mockups, exported diagram PNGs, whiteboard photos
4. Image metadata (filename, dimensions if available) is included

**Acceptance Criteria:**

1. .png and .jpg files are processed through filetomarkdown
2. Extracted text/description is ingested into KB
3. If no text can be extracted, file is indexed with metadata only (path, ticket, type=CONTEXT)

**Error Handling:**

- Corrupt image: Log warning, skip
- Very large image (>20MB): Log warning, skip
- No text extractable: Index with metadata only, no error

---

#### STORY 5: Progress Notification

> As a developer, I want clear progress feedback during indexing showing conversion + ingestion counts.

**Requirement Details:**

1. VS Code notification progress bar shows during indexing
2. Progress message updates: "Discovering documents...", "Converting X files...", "Indexing Y files..."
3. Final summary shows: total discovered, converted, indexed, skipped (with reasons)
4. Output panel displays detailed log per file

**Acceptance Criteria:**

1. Progress notification shows "Converting N files..." during conversion phase
2. Progress notification shows "Indexing N files..." during ingestion phase
3. Final count includes: discovered, converted successfully, indexed, skipped
4. Output panel shows per-file details: filename, action (direct/converted/skipped), result

**UI Specifications:**

| No. | Name | Type | Required | Description | Note |
|-----|------|------|----------|-------------|------|
| 1 | Progress Notification | vscode.ProgressLocation.Notification | Yes | Shows progress bar + message | Non-cancellable |
| 2 | Output Channel | vscode.OutputChannel | Yes | Detailed per-file log | Channel name: "SDLC Indexing" |
| 3 | Summary Toast | Information Message | Yes | Final summary counts | After completion |

---

#### STORY 6: Updated UI Label

> As a developer, I want the UI label to clearly indicate all documents are indexed (not just markdown).

**Requirement Details:**

1. The quick pick option for document indexing changes label from current to new text
2. New label: "Index all SDLC documents into Knowledge Base"
3. Description: "Scans ticket folders for all document formats (md, docx, xlsx, pdf, images, etc.)"

**Acceptance Criteria:**

1. Quick pick shows label: "$(book) Index Documents" with description "Index all SDLC documents into Knowledge Base"
2. Label clearly communicates that all formats are supported (not just .md)

---

#### STORY 7: Recursive Scan with Exclusions

> As a developer, I want recursive scanning of ticket subfolders (excluding diagrams/ and testdata/) so that nested documents are found.

**Requirement Details:**

1. The scanner recursively enters subdirectories within each ticket folder
2. `diagrams/` directory is excluded (contains .drawio XML and PNG exports — not useful as text)
3. `testdata/` directory is excluded (contains test fixtures like CSV data — already referenced in STC)
4. All other subdirectories are scanned

**Acceptance Criteria:**

1. Documents in nested subdirectories are discovered and indexed
2. Files in `diagrams/` folders are NOT indexed
3. Files in `testdata/` folders are NOT indexed
4. Other subdirectories (e.g., `attachments/`, `specs/`) ARE scanned

---

#### STORY 8: Unknown File Type Handling

> As a developer, I want unknown file types to be indexed as CONTEXT type so no information is lost.

**Requirement Details:**

1. Files with extensions in INDEXABLE_EXTENSIONS but not matching known document names (BRD, FSD, TDD, etc.) are classified as type CONTEXT
2. These files are still converted (if non-markdown) and indexed normally
3. Examples: `notes.docx`, `meeting-minutes.pdf`, `api-spec.yaml`

**Acceptance Criteria:**

1. Files not matching DOCUMENT_TYPES keys are typed as CONTEXT
2. CONTEXT-typed files are still converted and indexed
3. Agents can find CONTEXT-typed content via `mem_search`

---

## 3. Dependencies

| Dependency | Type | Related Ticket | Description |
|------------|------|----------------|-------------|
| filetomarkdown | External Package | N/A | npm package for converting files to markdown (https://github.com/jojomondag/FileToMarkdown) |
| MCP Server HTTP API | System | N/A | `/api/memory/ingest-file` endpoint for KB ingestion |
| VS Code Extension API | System | N/A | vscode.window.withProgress, QuickPick, OutputChannel |
| esbuild bundler | Tooling | N/A | Must bundle filetomarkdown and its dependencies correctly |
| Node.js fs module | System | N/A | File system access for reading documents |

---

## 4. Stakeholders

| Role | Name / Team | Responsibility | Source |
|------|-------------|----------------|--------|
| Product Owner | Duc Nguyen Minh | Define requirements, prioritize | Jira reporter |
| Developer | Unassigned | Implement conversion pipeline | Jira assignee |
| QA | QA Agent | Verify all format conversions work | Pipeline |

---

## 5. Risks and Assumptions

### 5.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| filetomarkdown package has native dependencies that break esbuild bundling | High | Medium | Test bundling early; if fails, use dynamic require or spawn subprocess |
| Image OCR quality is poor for complex diagrams | Low | High | Accept best-effort; diagram content is supplementary |
| Large files (>50MB PDF) cause memory issues in VS Code extension | Medium | Low | Set file size limits; skip files exceeding threshold |
| filetomarkdown package is unmaintained or has vulnerabilities | Medium | Low | Pin specific version; monitor for issues; have fallback plan |
| Conversion takes too long for many files (>100 files) | Medium | Medium | Add cancellation support; convert in batches; show progress |

### 5.2 Assumptions

- The `filetomarkdown` package supports all listed formats (docx, xlsx, pptx, pdf, images)
- The package can be bundled with esbuild (or dynamically loaded)
- The MCP server's ingest API accepts any markdown string content regardless of original source format
- The existing `INDEXABLE_EXTENSIONS` set in indexer.ts already defines the correct set of supported extensions
- The existing `scanDirectoryRecursive()` function already implements the exclusion logic for `diagrams/` and `testdata/`
- No changes needed to the KB schema — converted content is stored as regular KB entries

---

## 6. Non-Functional Requirements

| Category | Requirement | Details |
|----------|-------------|---------|
| Performance | Conversion speed | Single file conversion < 5 seconds for files under 10MB |
| Performance | Total indexing time | Index 50 documents (mixed formats) within 2 minutes |
| Performance | Memory usage | Extension memory increase < 100MB during conversion |
| Reliability | Error isolation | One file conversion failure must not abort the entire batch |
| Reliability | Idempotency | Re-indexing unchanged files should skip (no duplicate entries) |
| Compatibility | VS Code version | Compatible with VS Code >= 1.85.0 |
| Compatibility | OS support | Windows, macOS, Linux |
| Compatibility | Node.js | Compatible with VS Code's bundled Node.js (v18+) |
| Security | File access | Only access files within workspace `documents/` folder |
| Security | No data exfiltration | Converted content stays local (sent to localhost MCP server only) |
| Maintainability | Package version | Pin filetomarkdown to specific version |

---

## 7. Related Tickets

| Ticket Key | Summary | Status | Type | Relationship |
|------------|---------|--------|------|--------------|
| KSA-239 | Multi-format document indexing | In Progress | Task | Main ticket |

---

## 8. Appendix

### Glossary

| Term | Definition |
|------|------------|
| Knowledge Base (KB) | Semantic search database used by AI agents to find project context |
| MCP | Model Context Protocol — communication standard between AI agents and tools |
| Ingestion | Process of converting and storing content into the KB for later retrieval |
| INDEXABLE_EXTENSIONS | Set of file extensions recognized by the document scanner |
| DOCUMENT_TYPES | Mapping from filename patterns to KB entry type classification |
| filetomarkdown | npm package that converts various file formats to markdown text |

### Reference Documents

| Document | Link / Location |
|----------|-----------------|
| filetomarkdown GitHub | https://github.com/jojomondag/FileToMarkdown |
| Current indexer.ts | kiro-sdlc-agents/src/indexer.ts |
| MCP Server Config | .kiro/settings/mcp.json |
| Extension package.json | kiro-sdlc-agents/package.json |

### Supported Format Matrix

| Category | Extensions | Conversion Method | Priority |
|----------|-----------|-------------------|----------|
| Markdown | .md | Direct (no conversion) | MUST HAVE |
| Office | .docx, .doc, .xlsx, .xls, .pptx, .ppt | filetomarkdown | MUST HAVE |
| PDF | .pdf | filetomarkdown | MUST HAVE |
| Images | .png, .jpg, .jpeg, .gif, .bmp, .webp, .svg | filetomarkdown (OCR/description) | SHOULD HAVE |
| Text | .txt, .csv, .json, .xml, .yaml, .yml | Direct read (already text) | MUST HAVE |
| Rich Text | .rtf, .odt, .ods, .odp | filetomarkdown | COULD HAVE |

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Business Flow | [business-flow.png](diagrams/business-flow.png) | [business-flow.drawio](diagrams/business-flow.drawio) |
| 2 | Use Case | [use-case.png](diagrams/use-case.png) | [use-case.drawio](diagrams/use-case.drawio) |
