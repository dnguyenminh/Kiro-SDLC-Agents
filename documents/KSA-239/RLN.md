# Release Notes (RLN)

## KSA-239 — Multi-format Document Indexing

---

## Release Information

| Field | Value |
|-------|-------|
| Version | 1.17.0 |
| Release Date | 2025-07-14 |
| Jira Ticket | KSA-239 |
| Type | Feature (minor) |
| Branch | KSA-239 |
| Previous Version | 1.16.0 |

---

## What's New

### Multi-format Document Indexing

The "Index Documents" command now supports indexing non-markdown files. Documents in your `documents/` folder are automatically converted to markdown before ingestion into the Knowledge Base.

**Supported formats:**
- **Office:** .docx, .doc, .xlsx, .xls, .pptx, .ppt
- **PDF:** .pdf (text-based and scanned)
- **Images:** .png, .jpg, .jpeg, .gif, .bmp, .webp, .svg
- **Text:** .txt, .csv, .json, .xml, .yaml, .yml
- **Rich text:** .rtf, .odt, .ods, .odp

### Key Features

1. **Automatic conversion** — Non-markdown files are converted via `filetomarkdown` package
2. **Text format optimization** — .txt, .csv, .json, .xml, .yaml are read directly (no binary conversion needed)
3. **Size limits** — PDF: 50MB max, Images: 20MB max (oversized files skipped gracefully)
4. **30-second timeout** — Per-file conversion timeout prevents hangs
5. **Error isolation** — One failed conversion does not abort the batch
6. **Progressive enhancement** — Extension works normally even if filetomarkdown unavailable
7. **Updated UI label** — Quick pick shows "Index all SDLC documents into Knowledge Base"

---

## Files Changed

### New Files
| File | Purpose |
|------|---------|
| `src/converter.ts` | Multi-format conversion wrapper with timeout + size limits |
| `src/__tests__/converter.test.ts` | 28 unit + integration tests for converter |
| `src/__tests__/indexer.test.ts` | 11 tests for document discovery logic |

### Modified Files
| File | Changes |
|------|---------|
| `src/indexer.ts` | Integration with converter, updated label, enhanced payload |
| `package.json` | Added `filetomarkdown` dependency |

---

## Dependencies Added

| Package | Version | Purpose |
|---------|---------|---------|
| filetomarkdown | ^1.0.0 | Convert docx/pdf/xlsx/images to markdown |

---

## Test Results

| Level | Count | Result |
|-------|-------|--------|
| PBT (Property-Based) | 3 | PASS |
| UT (Unit Tests) | 26 | PASS |
| IT (Integration Tests) | 10 | PASS |
| **Total** | **39** | **100% PASS** |

---

## Breaking Changes

None. This is a backward-compatible feature addition. Existing .md-only indexing behavior is preserved.

---

## Migration Guide

No migration needed. Simply update the extension to v1.17.0. All existing indexed documents remain unchanged. New non-markdown files will be converted on next "Index Workspace" run.
