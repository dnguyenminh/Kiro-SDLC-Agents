---
inclusion: always
---

# Code Intelligence System — Agent Instructions

## Mục đích

Code Intelligence System index toàn bộ source code và tạo ra markdown analysis files để AI agents hiểu codebase mà không cần đọc từng file.

## File Locations

| File | Mô tả |
|------|--------|
| `.analysis/code-intelligence/index-config.json` | Config (extensions, excludes) |
| `.analysis/code-intelligence/index-metadata.json` | Metadata (timestamps, stats) |
| `.analysis/code-intelligence/project-structure.md` | Tổng quan project |
| `.analysis/code-intelligence/modules/*.md` | Per-module analysis |
| `.analysis/code-intelligence/kb-payloads.json` | KB ingestion payloads |

## Cách chạy Indexer — Auto-detect Script

**Agents PHẢI dùng logic sau để chọn script phù hợp với môi trường:**

```
1. Kiểm tra Python:  python --version
   → Nếu có: cd .analysis/code-intelligence/scripts/python && python main.py <root>

2. Kiểm tra Java:    java --version
   → Nếu có: cd .analysis/code-intelligence/scripts/java && run.bat <root>  (Windows)
              cd .analysis/code-intelligence/scripts/java && ./run.sh <root> (Linux/Mac)

3. Kiểm tra Node.js: node --version
   → Nếu có: cd .analysis/code-intelligence/scripts/nodejs && npm install && npx tsx src/full-indexer.ts <root>

4. Windows (PowerShell luôn có):
   → powershell -ExecutionPolicy Bypass -File .analysis/code-intelligence/scripts/powershell/full-indexer.ps1 -RootDir <root>

5. Linux/Mac (Bash luôn có):
   → bash .analysis/code-intelligence/scripts/bash/full-indexer.sh <root>

6. Fallback (không có gì):
   → Agent tự index bằng built-in tools (readCode, listDirectory, grep_search)
```

### Quy tắc chọn script

| Ưu tiên | Điều kiện | Script |
|---------|-----------|--------|
| 1 | Dự án Python + có Python | `python/main.py` |
| 2 | Dự án Java/Kotlin + có JDK | `java/run.bat` hoặc `java/run.sh` |
| 3 | Dự án Node.js + có Node | `nodejs/` (chính xác nhất) |
| 4 | Có Python (bất kỳ dự án nào) | `python/main.py` |
| 5 | Windows, không có Python/Java/Node | `powershell/full-indexer.ps1` |
| 6 | Linux/Mac, không có Python/Java/Node | `bash/full-indexer.sh` |

### Command chạy nhanh (copy-paste)

**Python (recommended — cross-platform, zero dependency):**
```bash
python .analysis/code-intelligence/scripts/python/main.py .
```

**Java (cho JVM projects):**
```bash
# Windows
.analysis\code-intelligence\scripts\java\run.bat .
# Linux/Mac
bash .analysis/code-intelligence/scripts/java/run.sh .
```

**PowerShell (Windows native):**
```powershell
powershell -ExecutionPolicy Bypass -File .analysis\code-intelligence\scripts\powershell\full-indexer.ps1 -RootDir .
```

**Bash (Linux/Mac native):**
```bash
bash .analysis/code-intelligence/scripts/bash/full-indexer.sh .
```

**Node.js (most accurate parser):**
```bash
cd .analysis/code-intelligence/scripts/nodejs && npm install && npx tsx src/full-indexer.ts ../../../
```

## Khi nào cần chạy Index

| Trigger | Action |
|---------|--------|
| Lần đầu setup dự án | Full index |
| Sau khi DEV agent implement code (Phase 5) | Full index |
| Khi SA agent cần đọc codebase (Phase 3) | Verify index fresh (< 24h) |
| Khi hook `code-index-full` trigger | Full index |
| Khi file được tạo/sửa/xóa (hooks) | Incremental (nếu có) hoặc full |

## Output Format

Tất cả scripts (Python, Java, PowerShell, Bash, Node.js) tạo ra **cùng output format**:

### project-structure.md
```markdown
# Project Structure — {name}
**Last Updated:** {ISO timestamp}
**Project Type:** {gradle-kotlin | npm-typescript | python | ...}

## Modules
| Module | Purpose | Language | Framework | Dependencies | Source Files |
```

### modules/{name}.md
```markdown
# Module Analysis — {name}
**Last Updated:** {ISO timestamp}
**Language:** {lang} | **Framework:** {fw}

## Key Classes
| Class | Visibility | Responsibility |

## Public API Surface
- `functionName(params): returnType`

## Detected Patterns
- **diStyle**: {none | field injection | constructor injection}
- **errorHandling**: {try-catch | Result type | exception handler}
- **naming**: {*Controller, *Service, *Repository}
- **logging**: {SLF4J | Log4j | logging}
- **testing**: {JUnit | pytest | kotest | Jest}
```

## Logging Format

```
[Code-Index] INFO: {action} — {details}
[Code-Index] ERROR: {error-type} — {file-path} — {error-message}
```

## Agent Usage

**SA agent (Phase 3):** Đọc `project-structure.md` + `modules/*.md` TRƯỚC khi thiết kế TDD.
**BA agent (Phase 2):** Đọc `project-structure.md` khi tạo FSD để hiểu tech context.
**DEV agent (Phase 5):** Chạy full index SAU khi implement xong để cập nhật cho agents khác.
**SM agent:** Verify index tồn tại và fresh trước khi invoke SA/DEV.
