# Agent Token-Optimized Workflows

## Tổng quan

Tài liệu này mô tả quy trình đọc/ghi tài liệu và source code đã được tối ưu token cho tất cả agents trong SDLC pipeline.

### Nguyên tắc cốt lõi

| Nguyên tắc | Cũ | Mới | Savings |
|------------|-----|-----|---------|
| Ingest document | readFile(full) → kb_ingest(full) | `mem_ingest_file(path)` | 99% |
| Đọc context | readFile(full, skipPruning=true) | `mem_search(query)` | 75-85% |
| Lưu kinh nghiệm | kb_ingest(title, content) | `mem_ingest(content, type)` | 50% |
| Tìm code patterns | grep_search | `code_search(query)` | Tương đương |

### Tool Prefix Guide

```
kb_*    → Orchestrator (remote) — Jira tickets, cross-project team KB
mem_*   → Code-Intelligence (local) — Documents, decisions, error patterns
code_*  → Code-Intelligence (local) — AST, symbols, code analysis
```

---

## 1. BA Agent — Quy trình tạo BRD/FSD

### 1.1 Đọc Jira Ticket (Input)

```
┌─────────────────────────────────────────────────────────┐
│  BA Agent bắt đầu task                                   │
│                                                          │
│  1. find_tools("jira get issue")                         │
│  2. execute_dynamic_tool("jira_get_issue", {key})        │
│     → Jira data vào context (~500 tokens)                │
│                                                          │
│  3. kb_ingest(title, content, tags)  ← Orchestrator      │
│     → Lưu Jira data vào remote KB (team-wide)           │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Tạo BRD (Output)

```
┌─────────────────────────────────────────────────────────┐
│  BA Agent tạo BRD.md                                     │
│                                                          │
│  1. stream_write_file(path, content, mode="write")       │
│     → Viết BRD.md ra disk (chunks ≤ 4000 chars)         │
│                                                          │
│  2. mem_ingest_file(file_path="documents/{T}/BRD.md",    │
│                     type="REQUIREMENT")                   │
│     → Server tự đọc file, chunk, index                   │
│     → Cost: ~80 tokens                                   │
│     → OLD: readFile(skipPruning) + kb_ingest = ~8000 tk  │
└─────────────────────────────────────────────────────────┘
```

### 1.3 Đọc BRD để tạo FSD (Input cho phase tiếp)

```
┌─────────────────────────────────────────────────────────┐
│  BA Agent cần đọc BRD để tạo FSD                         │
│                                                          │
│  1. mem_search("{TICKET} BRD requirements", detail=true)  │
│     → Trả relevant chunks (~1500 tokens)                 │
│     → OLD: readFile(BRD.md, skipPruning) = ~4000 tokens  │
│                                                          │
│  2. Nếu cần chi tiết 1 entry:                           │
│     mem_get(id=<entry_id>)                               │
│     → Full content 1 chunk (~200 tokens)                 │
│                                                          │
│  3. Fallback (nếu mem_search trả empty):                 │
│     readFile("documents/{T}/BRD.md")                     │
│     → Chỉ dùng khi document chưa được ingest            │
└─────────────────────────────────────────────────────────┘
```

---

## 2. SA Agent — Quy trình tạo TDD

### 2.1 Đọc BRD + FSD (Input)

```
┌─────────────────────────────────────────────────────────┐
│  SA Agent cần context từ BRD + FSD                        │
│                                                          │
│  1. mem_search("{TICKET} requirements user stories")      │
│     → BRD relevant chunks (~1000 tokens)                 │
│                                                          │
│  2. mem_search("{TICKET} use cases API specification")    │
│     → FSD relevant chunks (~1500 tokens)                 │
│                                                          │
│  3. code_search("existing implementation pattern")       │
│     → Code context (~500 tokens)                         │
│                                                          │
│  Total: ~3000 tokens                                     │
│  OLD: readFile(BRD) + readFile(FSD) = ~12,000 tokens     │
│  SAVINGS: 75%                                            │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Tạo TDD (Output)

```
┌─────────────────────────────────────────────────────────┐
│  SA Agent tạo TDD.md                                     │
│                                                          │
│  1. stream_write_file(path, content, mode="write/append")│
│     → Viết TDD.md ra disk                                │
│                                                          │
│  2. mem_ingest_file(file_path="documents/{T}/TDD.md",    │
│                     type="ARCHITECTURE")                  │
│     → Cost: ~80 tokens                                   │
│                                                          │
│  3. mem_ingest(content="Decision: chose coroutines...",   │
│               type="DECISION", source="{TICKET}")        │
│     → Lưu key decisions riêng (~100 tokens)              │
└─────────────────────────────────────────────────────────┘
```

---

## 3. DEV Agent — Quy trình implement code

### 3.1 Đọc TDD (Input)

```
┌─────────────────────────────────────────────────────────┐
│  DEV Agent cần context từ TDD                            │
│                                                          │
│  1. mem_search("{TICKET} API design endpoints")          │
│     → API specs (~800 tokens)                            │
│                                                          │
│  2. mem_search("{TICKET} class design database")         │
│     → Architecture details (~700 tokens)                 │
│                                                          │
│  3. mem_search("error pattern {technology}")             │
│     → Known pitfalls (~300 tokens)                       │
│                                                          │
│  4. code_search("similar implementation")                │
│     → Existing code patterns (~500 tokens)               │
│                                                          │
│  Total: ~2300 tokens                                     │
│  OLD: readFile(TDD.md, skipPruning) = ~6000 tokens       │
│  SAVINGS: 62%                                            │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Implement Code (Output)

```
┌─────────────────────────────────────────────────────────┐
│  DEV Agent viết code                                     │
│                                                          │
│  1. fs_write / str_replace → Tạo/sửa source files       │
│                                                          │
│  2. Nếu gặp error mới:                                  │
│     mem_ingest(content="Error: X, Fix: Y",              │
│               type="ERROR_PATTERN", source="{TICKET}")   │
│     → Lưu error pattern cho future reference             │
│                                                          │
│  3. Nếu có decision quan trọng:                          │
│     mem_ingest(content="Chose X over Y because...",     │
│               type="DECISION", source="{TICKET}")        │
└─────────────────────────────────────────────────────────┘
```

---

## 4. QA Agent — Quy trình tạo STP/STC

### 4.1 Đọc BRD + FSD + TDD (Input)

```
┌─────────────────────────────────────────────────────────┐
│  QA Agent cần context từ 3 documents                     │
│                                                          │
│  1. mem_search("{TICKET} acceptance criteria")           │
│     → AC từ BRD (~800 tokens)                            │
│                                                          │
│  2. mem_search("{TICKET} use cases flows")               │
│     → Use cases từ FSD (~1000 tokens)                    │
│                                                          │
│  3. mem_search("{TICKET} API endpoints validation")      │
│     → API specs từ TDD (~700 tokens)                     │
│                                                          │
│  4. mem_search("{TICKET} business rules")                │
│     → BR từ FSD (~500 tokens)                            │
│                                                          │
│  Total: ~3000 tokens                                     │
│  OLD: readFile(BRD+FSD+TDD) = ~18,000 tokens            │
│  SAVINGS: 83%                                            │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Tạo STP + STC (Output)

```
┌─────────────────────────────────────────────────────────┐
│  QA Agent tạo STP.md + STC.md                            │
│                                                          │
│  1. stream_write_file → Viết STP.md                      │
│  2. stream_write_file → Viết STC.md                      │
│                                                          │
│  3. mem_ingest_file("documents/{T}/STP.md", "PROCEDURE") │
│  4. mem_ingest_file("documents/{T}/STC.md", "PROCEDURE") │
│     → 2 × ~80 = ~160 tokens                             │
│     → OLD: 2 × readFile + kb_ingest = ~16,000 tokens    │
└─────────────────────────────────────────────────────────┘
```

---

## 5. DevOps Agent — Quy trình tạo DPG/RLN

### 5.1 Đọc TDD (Input)

```
┌─────────────────────────────────────────────────────────┐
│  DevOps Agent cần deployment context                     │
│                                                          │
│  1. mem_search("{TICKET} deployment architecture")       │
│     → Deploy specs (~700 tokens)                         │
│                                                          │
│  2. mem_search("{TICKET} environment configuration")     │
│     → Config details (~500 tokens)                       │
│                                                          │
│  3. mem_search("deployment error pattern")               │
│     → Known issues (~300 tokens)                         │
│                                                          │
│  Total: ~1500 tokens                                     │
│  OLD: readFile(TDD.md) = ~6000 tokens                    │
│  SAVINGS: 75%                                            │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Tạo DPG + RLN (Output)

```
┌─────────────────────────────────────────────────────────┐
│  DevOps Agent tạo DPG.md + RLN.md                        │
│                                                          │
│  1. stream_write_file → Viết DPG.md                      │
│  2. stream_write_file → Viết RLN.md                      │
│                                                          │
│  3. mem_ingest_file("documents/{T}/DPG.md", "PROCEDURE") │
│  4. mem_ingest_file("documents/{T}/RLN.md", "CONTEXT")   │
│     → 2 × ~80 = ~160 tokens                             │
└─────────────────────────────────────────────────────────┘
```

---

## 6. SM Agent — Quy trình điều phối

### 6.1 Phase Transition Flow

```
┌─────────────────────────────────────────────────────────┐
│  SM Agent chuyển phase                                   │
│                                                          │
│  Phase N complete:                                        │
│  1. Verify document exists (Test-Path)                   │
│  2. mem_ingest_file(document_path)  ← Auto-index         │
│  3. Update STATUS.json                                   │
│                                                          │
│  Phase N+1 start:                                        │
│  4. Gọi agent tiếp theo                                  │
│     → Agent TỰ mem_search để lấy context                 │
│     → SM KHÔNG cần bảo agent readFile                    │
│     → SM KHÔNG cần truyền document content               │
│                                                          │
│  Token savings: SM không còn là bottleneck               │
│  truyền full documents giữa agents                       │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Tổng hợp Token Usage — Full Pipeline (1 ticket)

### Trước (Old Flow)

```
Phase 1 (BA → BRD):
  Jira read:        500 tokens
  Write BRD:        0 (disk)
  Ingest BRD:       8,000 tokens (readFile + kb_ingest)
                    ─────────
  Subtotal:         8,500 tokens

Phase 2 (BA+TA → FSD):
  Read BRD:         4,000 tokens (readFile full)
  Write FSD:        0 (disk)
  Ingest FSD:       8,000 tokens
                    ─────────
  Subtotal:         12,000 tokens

Phase 3 (SA → TDD):
  Read BRD+FSD:     12,000 tokens (2 × readFile)
  Write TDD:        0 (disk)
  Ingest TDD:       8,000 tokens
                    ─────────
  Subtotal:         20,000 tokens

Phase 4 (QA → STP+STC):
  Read BRD+FSD+TDD: 18,000 tokens (3 × readFile)
  Write STP+STC:    0 (disk)
  Ingest STP+STC:   16,000 tokens
                    ─────────
  Subtotal:         34,000 tokens

Phase 5 (DEV → Code):
  Read TDD:         6,000 tokens
                    ─────────
  Subtotal:         6,000 tokens

Phase 7 (DevOps → DPG+RLN):
  Read TDD:         6,000 tokens
  Ingest DPG+RLN:   12,000 tokens
                    ─────────
  Subtotal:         18,000 tokens

═══════════════════════════════
TOTAL OLD:          ~98,500 tokens
```

### Sau (New Flow — mem_* tools)

```
Phase 1 (BA → BRD):
  Jira read:        500 tokens
  Write BRD:        0 (disk)
  mem_ingest_file:  80 tokens
                    ─────────
  Subtotal:         580 tokens

Phase 2 (BA+TA → FSD):
  mem_search(BRD):  1,500 tokens (relevant chunks)
  Write FSD:        0 (disk)
  mem_ingest_file:  80 tokens
                    ─────────
  Subtotal:         1,580 tokens

Phase 3 (SA → TDD):
  mem_search(BRD):  1,000 tokens
  mem_search(FSD):  1,500 tokens
  code_search:      500 tokens
  Write TDD:        0 (disk)
  mem_ingest_file:  80 tokens
  mem_ingest(dec):  100 tokens
                    ─────────
  Subtotal:         3,180 tokens

Phase 4 (QA → STP+STC):
  mem_search(AC):   800 tokens
  mem_search(UC):   1,000 tokens
  mem_search(API):  700 tokens
  mem_search(BR):   500 tokens
  Write STP+STC:    0 (disk)
  2× mem_ingest_file: 160 tokens
                    ─────────
  Subtotal:         3,160 tokens

Phase 5 (DEV → Code):
  mem_search(API):  800 tokens
  mem_search(arch): 700 tokens
  mem_search(err):  300 tokens
  code_search:      500 tokens
                    ─────────
  Subtotal:         2,300 tokens

Phase 7 (DevOps → DPG+RLN):
  mem_search(deploy): 700 tokens
  mem_search(config): 500 tokens
  mem_search(errors): 300 tokens
  2× mem_ingest_file: 160 tokens
                    ─────────
  Subtotal:         1,660 tokens

═══════════════════════════════
TOTAL NEW:          ~12,460 tokens
SAVINGS:            ~87%
```

---

## 8. Sequence Diagram — Full Pipeline

```
User    SM      BA      SA      DEV     QA      DevOps   Memory
 │       │       │       │       │       │       │        │
 │──────▶│       │       │       │       │       │        │
 │ "KSA-X"      │       │       │       │       │        │
 │       │──────▶│       │       │       │       │        │
 │       │ Phase1│       │       │       │       │        │
 │       │       │───────────────────────────────────────▶│
 │       │       │ mem_ingest_file(BRD.md) ~80tk          │
 │       │       │◀──────────────────────────────────────│
 │       │◀──────│       │       │       │       │        │
 │       │ BRD✅ │       │       │       │       │        │
 │       │──────▶│       │       │       │       │        │
 │       │ Phase2│       │       │       │       │        │
 │       │       │───────────────────────────────────────▶│
 │       │       │ mem_search("BRD requirements") ~1500tk │
 │       │       │◀──────────────────────────────────────│
 │       │       │ [writes FSD.md]                        │
 │       │       │───────────────────────────────────────▶│
 │       │       │ mem_ingest_file(FSD.md) ~80tk          │
 │       │◀──────│       │       │       │       │        │
 │       │ FSD✅ │       │       │       │       │        │
 │       │───────────────▶       │       │       │        │
 │       │ Phase3│       │       │       │       │        │
 │       │       │       │───────────────────────────────▶│
 │       │       │       │ mem_search("requirements")     │
 │       │       │       │ mem_search("use cases")        │
 │       │       │       │◀──────────────────────────────│
 │       │       │       │ [writes TDD.md]                │
 │       │       │       │───────────────────────────────▶│
 │       │       │       │ mem_ingest_file(TDD.md) ~80tk  │
 │       │◀──────────────│       │       │       │        │
 │       │ TDD✅ │       │       │       │       │        │
 │       │───────────────────────────────▶       │        │
 │       │ Phase4│       │       │       │       │        │
 │       │       │       │       │       │───────────────▶│
 │       │       │       │       │       │ mem_search(AC)  │
 │       │       │       │       │       │ mem_search(UC)  │
 │       │       │       │       │       │◀──────────────│
 │       │       │       │       │       │ [writes STP+STC]
 │       │       │       │       │       │───────────────▶│
 │       │       │       │       │       │ mem_ingest_file │
 │       │◀──────────────────────────────│       │        │
 │       │ STP✅ │       │       │       │       │        │
 │       │───────────────────────▶       │       │        │
 │       │ Phase5│       │       │       │       │        │
 │       │       │       │       │───────────────────────▶│
 │       │       │       │       │ mem_search("API")      │
 │       │       │       │       │ code_search("pattern") │
 │       │       │       │       │◀──────────────────────│
 │       │       │       │       │ [implements code]      │
 │       │◀──────────────────────│       │       │        │
 │       │ Code✅│       │       │       │       │        │
 │       │───────────────────────────────────────▶        │
 │       │ Phase7│       │       │       │       │        │
 │       │       │       │       │       │       │───────▶│
 │       │       │       │       │       │       │mem_search
 │       │       │       │       │       │       │◀──────│
 │       │       │       │       │       │       │[DPG+RLN]
 │       │       │       │       │       │       │───────▶│
 │       │       │       │       │       │       │ingest  │
 │       │◀──────────────────────────────────────│        │
 │◀──────│       │       │       │       │       │        │
 │ Done! │       │       │       │       │       │        │
```

---

## 9. Quy tắc vàng

1. **KHÔNG BAO GIỜ** dùng `readFile(skipPruning=true)` + `kb_ingest(content=FULL)` cho documents
2. **LUÔN** dùng `mem_ingest_file(file_path)` sau khi tạo document (~80 tokens)
3. **LUÔN** dùng `mem_search(query)` trước khi readFile (~1500 tokens vs ~6000)
4. **CHỈ** readFile khi mem_search trả empty (document chưa ingest)
5. **Phân biệt**: `kb_*` cho Jira/remote, `mem_*` cho local, `code_*` cho code analysis
