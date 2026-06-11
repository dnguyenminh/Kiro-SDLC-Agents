# Technical Design Document (TDD)

## MCP Code Intelligence — KSA-172: [Kotlin] Tree-sitter Core + Parsers

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-172 |
| Title | [Kotlin] Tree-sitter Core + Parsers |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-05-26 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-172.docx |
| Related BRD | BRD-v1-KSA-172.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-26 | SA Agent | Initial technical design |

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

The Kotlin Tree-sitter module follows a layered architecture:

```
┌─────────────────────────────────────────────────┐
│                  MCP Tool Layer                   │
│         (parse_file, get_symbols tools)          │
├─────────────────────────────────────────────────┤
│               Service Layer                      │
│    (ParserService, SymbolExtractionService)      │
├─────────────────────────────────────────────────┤
│                Core Layer                        │
│  (TreeSitterParser, AstConverter, ParserPool)    │
├─────────────────────────────────────────────────┤
│              JNI Bridge Layer                     │
│    (TreeSitterNative, GrammarLoader)             │
├─────────────────────────────────────────────────┤
│           Native Libraries (C)                   │
│  (libtree-sitter + language grammar .so/.dll)    │
└─────────────────────────────────────────────────┘
```

![Architecture](diagrams/architecture.png)

### 1.2 Design Principles

1. **Immutability**: AST nodes are immutable data classes after construction
2. **Thread Safety**: Parser pool pattern ensures no shared mutable state
3. **Lazy Initialization**: Grammars loaded on demand, not at startup
4. **Fail-Safe**: Parse errors produce partial results, never crash
5. **Platform Parity**: Output structure matches nodejs v2 exactly

---

## 2. Module Structure

### 2.1 Gradle Module Layout

```
mcp-code-intelligence-kotlin/
├── tree-sitter-core/              # This module (KSA-172)
│   ├── src/main/kotlin/
│   │   └── com/codeintel/treesitter/
│   │       ├── TreeSitterParser.kt        # Main parser interface
│   │       ├── TreeSitterParserImpl.kt    # Implementation
│   │       ├── ParserPool.kt             # Thread-safe parser pool
│   │       ├── GrammarRegistry.kt        # Language grammar management
│   │       ├── LanguageDetector.kt       # File extension mapping
│   │       ├── AstConverter.kt           # Tree → AstNode conversion
│   │       ├── SymbolExtractor.kt        # AST → Symbol extraction
│   │       ├── IncrementalParser.kt      # Incremental parse support
│   │       ├── model/
│   │       │   ├── AstNode.kt
│   │       │   ├── Symbol.kt
│   │       │   ├── ParseResult.kt
│   │       │   ├── Position.kt
│   │       │   └── InputEdit.kt
│   │       ├── jni/
│   │       │   ├── TreeSitterNative.kt   # JNI declarations
│   │       │   ├── NativeTree.kt         # JNI tree wrapper
│   │       │   └── NativeParser.kt       # JNI parser wrapper
│   │       ├── languages/
│   │       │   ├── LanguageConfig.kt     # Per-language extraction rules
│   │       │   ├── KotlinRules.kt
│   │       │   ├── TypeScriptRules.kt
│   │       │   ├── JavaRules.kt
│   │       │   └── ... (one per language)
│   │       └── exceptions/
│   │           ├── ParserInitializationException.kt
│   │           ├── GrammarNotFoundException.kt
│   │           └── UnsupportedLanguageException.kt
│   ├── src/main/resources/
│   │   └── grammars/                     # Bundled grammar files
│   │       ├── tree-sitter-typescript.so
│   │       ├── tree-sitter-kotlin.so
│   │       └── ...
│   ├── src/test/kotlin/
│   │   └── com/codeintel/treesitter/
│   │       ├── TreeSitterParserTest.kt
│   │       ├── SymbolExtractorTest.kt
│   │       ├── IncrementalParserTest.kt
│   │       ├── ParserPoolTest.kt
│   │       └── fixtures/                 # Shared test fixtures
│   └── build.gradle.kts
├── native/                               # Native library builds
│   ├── linux-x64/
│   ├── macos-arm64/
│   └── windows-x64/
└── build.gradle.kts                      # Root build
```

### 2.2 Component Diagram

![Component](diagrams/component.png)

---

## 3. Detailed Design

### 3.1 JNI Bridge Layer

#### 3.1.1 Native Declarations

```kotlin
// TreeSitterNative.kt
internal object TreeSitterNative {
    init {
        NativeLoader.loadLibrary("tree_sitter_jni")
    }

    // Parser lifecycle
    external fun parserNew(): Long                    // Returns pointer
    external fun parserDelete(parser: Long)
    external fun parserSetLanguage(parser: Long, language: Long): Boolean
    external fun parserParse(
        parser: Long,
        oldTree: Long,       // 0 for no old tree
        source: ByteArray,
        sourceLen: Int
    ): Long                                           // Returns tree pointer

    // Tree operations
    external fun treeRootNode(tree: Long): Long       // Returns node pointer
    external fun treeDelete(tree: Long)
    external fun treeEdit(tree: Long, edit: ByteArray)
    external fun treeGetChangedRanges(oldTree: Long, newTree: Long): Array<IntArray>

    // Node operations
    external fun nodeType(node: Long): String
    external fun nodeStartByte(node: Long): Int
    external fun nodeEndByte(node: Long): Int
    external fun nodeStartPoint(node: Long): IntArray  // [row, col]
    external fun nodeEndPoint(node: Long): IntArray
    external fun nodeChildCount(node: Long): Int
    external fun nodeChild(node: Long, index: Int): Long
    external fun nodeIsNamed(node: Long): Boolean
    external fun nodeFieldNameForChild(node: Long, index: Int): String?
    external fun nodeText(node: Long, source: ByteArray): String

    // Language loading
    external fun languageLoad(grammarPath: String): Long  // Returns language pointer
}
```

#### 3.1.2 Memory Management

```kotlin
// NativeTree.kt — RAII wrapper
class NativeTree(private var pointer: Long) : AutoCloseable {
    val isValid: Boolean get() = pointer != 0L

    fun rootNode(): Long {
        check(isValid) { "Tree already freed" }
        return TreeSitterNative.treeRootNode(pointer)
    }

    override fun close() {
        if (pointer != 0L) {
            TreeSitterNative.treeDelete(pointer)
            pointer = 0L
        }
    }
}
```

### 3.2 Parser Pool

```kotlin
class ParserPool(
    private val poolSize: Int = Runtime.getRuntime().availableProcessors()
) {
    private val available = ArrayBlockingQueue<NativeParser>(poolSize)
    private val created = AtomicInteger(0)

    init {
        repeat(poolSize) {
            available.offer(createParser())
            created.incrementAndGet()
        }
    }

    fun acquire(timeout: Duration = 5.seconds): NativeParser {
        return available.poll(timeout.inWholeMilliseconds, TimeUnit.MILLISECONDS)
            ?: throw ParseTimeoutException("No parser available within timeout")
    }

    fun release(parser: NativeParser) {
        parser.reset()
        available.offer(parser)
    }

    private fun createParser(): NativeParser {
        val ptr = TreeSitterNative.parserNew()
        return NativeParser(ptr)
    }

    fun close() {
        available.forEach { it.close() }
    }
}
```

### 3.3 Grammar Registry

```kotlin
class GrammarRegistry {
    private val grammars = ConcurrentHashMap<String, Long>()  // language → pointer
    private val grammarPaths = mapOf(
        "typescript" to "grammars/tree-sitter-typescript",
        "javascript" to "grammars/tree-sitter-javascript",
        "python" to "grammars/tree-sitter-python",
        "java" to "grammars/tree-sitter-java",
        "kotlin" to "grammars/tree-sitter-kotlin",
        "go" to "grammars/tree-sitter-go",
        "rust" to "grammars/tree-sitter-rust",
        "csharp" to "grammars/tree-sitter-c-sharp",
        "ruby" to "grammars/tree-sitter-ruby",
        "php" to "grammars/tree-sitter-php",
        "swift" to "grammars/tree-sitter-swift",
        "scala" to "grammars/tree-sitter-scala"
    )

    fun loadGrammar(language: String): Long {
        return grammars.computeIfAbsent(language) { lang ->
            val path = grammarPaths[lang]
                ?: throw GrammarNotFoundException("No grammar for: $lang")
            val resolvedPath = resolveGrammarPath(path)
            TreeSitterNative.languageLoad(resolvedPath)
        }
    }

    fun isLoaded(language: String): Boolean = grammars.containsKey(language)

    fun supportedLanguages(): List<String> = grammarPaths.keys.toList()

    private fun resolveGrammarPath(relativePath: String): String {
        // Resolve from resources or external path based on OS
        val os = System.getProperty("os.name").lowercase()
        val ext = when {
            os.contains("linux") -> ".so"
            os.contains("mac") || os.contains("darwin") -> ".dylib"
            os.contains("win") -> ".dll"
            else -> ".so"
        }
        return "$relativePath$ext"
    }
}
```

### 3.4 AST Converter

```kotlin
class AstConverter {
    fun convert(
        nativeTree: NativeTree,
        source: ByteArray,
        maxTextLength: Int = 1000
    ): AstNode {
        val rootPtr = nativeTree.rootNode()
        return convertNode(rootPtr, source, null, maxTextLength)
    }

    private fun convertNode(
        nodePtr: Long,
        source: ByteArray,
        fieldName: String?,
        maxTextLength: Int
    ): AstNode {
        val type = TreeSitterNative.nodeType(nodePtr)
        val startPoint = TreeSitterNative.nodeStartPoint(nodePtr)
        val endPoint = TreeSitterNative.nodeEndPoint(nodePtr)
        val startByte = TreeSitterNative.nodeStartByte(nodePtr)
        val endByte = TreeSitterNative.nodeEndByte(nodePtr)
        val isNamed = TreeSitterNative.nodeIsNamed(nodePtr)
        val childCount = TreeSitterNative.nodeChildCount(nodePtr)

        // Only include text for leaf nodes or small nodes
        val text = if (childCount == 0 || (endByte - startByte) <= maxTextLength) {
            TreeSitterNative.nodeText(nodePtr, source)
        } else null

        val children = (0 until childCount).map { i ->
            val childPtr = TreeSitterNative.nodeChild(nodePtr, i)
            val childField = TreeSitterNative.nodeFieldNameForChild(nodePtr, i)
            convertNode(childPtr, source, childField, maxTextLength)
        }

        return AstNode(
            type = type,
            text = text,
            startPosition = Position(startPoint[0], startPoint[1]),
            endPosition = Position(endPoint[0], endPoint[1]),
            startByte = startByte,
            endByte = endByte,
            isNamed = isNamed,
            fieldName = fieldName,
            children = children,
            isError = type == "ERROR"
        )
    }
}
```

### 3.5 Symbol Extractor

```kotlin
class SymbolExtractor(
    private val languageRules: Map<String, LanguageExtractionRules>
) {
    fun extract(ast: AstNode, language: String, filePath: String): List<Symbol> {
        val rules = languageRules[language]
            ?: throw UnsupportedLanguageException("No extraction rules for: $language")
        val symbols = mutableListOf<Symbol>()
        val scopeStack = ArrayDeque<String>()

        visit(ast, rules, symbols, scopeStack, filePath, language)
        return symbols
    }

    private fun visit(
        node: AstNode,
        rules: LanguageExtractionRules,
        symbols: MutableList<Symbol>,
        scopeStack: ArrayDeque<String>,
        filePath: String,
        language: String
    ) {
        val matchedRule = rules.match(node)
        var pushedScope = false

        if (matchedRule != null) {
            val symbol = matchedRule.extract(node, scopeStack.lastOrNull(), filePath, language)
            symbols.add(symbol)

            if (matchedRule.createsScope) {
                scopeStack.addLast(symbol.name)
                pushedScope = true
            }
        }

        for (child in node.children) {
            if (child.isNamed) {
                visit(child, rules, symbols, scopeStack, filePath, language)
            }
        }

        if (pushedScope) {
            scopeStack.removeLast()
        }
    }
}
```

### 3.6 Incremental Parser

```kotlin
class IncrementalParser(
    private val parserPool: ParserPool,
    private val grammarRegistry: GrammarRegistry,
    private val astConverter: AstConverter
) {
    private val treeCache = ConcurrentHashMap<String, CachedTree>()

    fun parseIncremental(
        filePath: String,
        edit: InputEdit,
        newSource: ByteArray,
        language: String
    ): ParseResult {
        val cached = treeCache[filePath]

        // Fallback conditions
        if (cached == null) {
            return fullParse(filePath, newSource, language)
        }

        val editRatio = (edit.newEndByte - edit.startByte).toFloat() / newSource.size
        if (editRatio > 0.3f) {
            return fullParse(filePath, newSource, language)
        }

        // Apply edit to cached tree
        val editBytes = encodeEdit(edit)
        TreeSitterNative.treeEdit(cached.treePointer, editBytes)

        // Re-parse with old tree
        val parser = parserPool.acquire()
        try {
            val grammarPtr = grammarRegistry.loadGrammar(language)
            TreeSitterNative.parserSetLanguage(parser.pointer, grammarPtr)

            val startTime = System.nanoTime()
            val newTreePtr = TreeSitterNative.parserParse(
                parser.pointer, cached.treePointer, newSource, newSource.size
            )
            val elapsed = (System.nanoTime() - startTime) / 1_000_000

            val newTree = NativeTree(newTreePtr)
            val ast = astConverter.convert(newTree, newSource)

            // Update cache
            cached.tree.close()
            treeCache[filePath] = CachedTree(newTree, newTreePtr)

            return ParseResult(newTree, ast, language, elapsed, ast.hasErrors(), countErrors(ast))
        } finally {
            parserPool.release(parser)
        }
    }

    private fun fullParse(filePath: String, source: ByteArray, language: String): ParseResult {
        // Delegate to main parser, cache result
        val parser = parserPool.acquire()
        try {
            val grammarPtr = grammarRegistry.loadGrammar(language)
            TreeSitterNative.parserSetLanguage(parser.pointer, grammarPtr)

            val startTime = System.nanoTime()
            val treePtr = TreeSitterNative.parserParse(parser.pointer, 0L, source, source.size)
            val elapsed = (System.nanoTime() - startTime) / 1_000_000

            val tree = NativeTree(treePtr)
            val ast = astConverter.convert(tree, source)

            treeCache[filePath]?.tree?.close()
            treeCache[filePath] = CachedTree(tree, treePtr)

            return ParseResult(tree, ast, language, elapsed, ast.hasErrors(), countErrors(ast))
        } finally {
            parserPool.release(parser)
        }
    }

    private data class CachedTree(val tree: NativeTree, val treePointer: Long)
}
```

---

## 4. Security Design

### 4.1 Input Validation

| Input | Validation | Rationale |
|-------|-----------|-----------|
| File path | Canonicalize, check within workspace | Prevent path traversal |
| Source bytes | Max size 50MB | Prevent OOM |
| Language ID | Whitelist of 12 supported | Prevent arbitrary grammar load |
| Edit ranges | Bounds check against source length | Prevent buffer overflow in native |

### 4.2 Native Code Safety

- JNI pointers validated before use (null check)
- Native exceptions caught at JNI boundary
- Memory freed in `finally` blocks (RAII pattern)
- No user-controlled data passed directly to native without validation

---

## 5. Error Handling

| Layer | Error Type | Handling Strategy |
|-------|-----------|-------------------|
| JNI | Native crash | Catch, wrap in `NativeLibraryException`, log stack |
| Parser | Syntax error | Return partial AST with ERROR nodes |
| Grammar | Load failure | `GrammarNotFoundException`, mark language unavailable |
| Pool | Timeout | `ParseTimeoutException` after 5s |
| Memory | OOM | Release resources, throw `ParseMemoryException` |
| File I/O | Not found | `FileNotFoundException` with path details |

---

## 6. Performance Design

### 6.1 Object Pooling

- Parser instances pooled (expensive to create due to JNI)
- Pool size = CPU cores (configurable)
- Acquire/release pattern with timeout

### 6.2 Memory Optimization

- Lazy text extraction (only for leaf nodes or small subtrees)
- AST node children as `List` (not `MutableList`) — no extra capacity
- Grammar pointers cached (never re-loaded)
- Tree cache for incremental parsing (LRU eviction at 1000 entries)

### 6.3 Concurrency

- `ConcurrentHashMap` for grammar registry and tree cache
- `ArrayBlockingQueue` for parser pool
- Immutable `AstNode` — safe to share across threads
- No locks on hot path (parse operation)

---

## 7. Testing Strategy

### 7.1 Unit Tests

| Test Class | Coverage |
|-----------|----------|
| `TreeSitterParserTest` | Init, parse, error handling |
| `GrammarRegistryTest` | Load, cache, missing grammar |
| `AstConverterTest` | Node conversion, text extraction |
| `SymbolExtractorTest` | All 12 languages, all symbol kinds |
| `IncrementalParserTest` | Edit, fallback, cache |
| `ParserPoolTest` | Acquire, release, timeout, concurrency |
| `LanguageDetectorTest` | Extension mapping, edge cases |

### 7.2 Integration Tests

- Parse real-world files from each language (stdlib samples)
- Cross-platform comparison with nodejs v2 output
- Concurrent parsing stress test (100 files, 10 threads)
- Memory leak detection (parse 10K files, check heap)

### 7.3 Performance Tests

- Benchmark: parse 10K LOC file (must < 500ms)
- Benchmark: batch parse 1000 files (must < 30s)
- Benchmark: incremental parse single char (must < 10ms)
- Benchmark: symbol extraction 1000 files (must < 3s)

---

## 8. Implementation Checklist

### Files to Create

| # | File | Purpose | Priority |
|---|------|---------|----------|
| 1 | `TreeSitterParser.kt` | Main interface | P0 |
| 2 | `TreeSitterParserImpl.kt` | Implementation | P0 |
| 3 | `jni/TreeSitterNative.kt` | JNI declarations | P0 |
| 4 | `jni/NativeTree.kt` | Tree RAII wrapper | P0 |
| 5 | `jni/NativeParser.kt` | Parser RAII wrapper | P0 |
| 6 | `ParserPool.kt` | Thread-safe pool | P0 |
| 7 | `GrammarRegistry.kt` | Grammar management | P0 |
| 8 | `AstConverter.kt` | Tree → AstNode | P0 |
| 9 | `SymbolExtractor.kt` | Symbol extraction | P0 |
| 10 | `IncrementalParser.kt` | Incremental support | P1 |
| 11 | `LanguageDetector.kt` | Extension mapping | P0 |
| 12 | `model/AstNode.kt` | Data model | P0 |
| 13 | `model/Symbol.kt` | Data model | P0 |
| 14 | `model/ParseResult.kt` | Data model | P0 |
| 15 | `model/Position.kt` | Data model | P0 |
| 16 | `model/InputEdit.kt` | Data model | P1 |
| 17 | `languages/LanguageConfig.kt` | Base extraction rules | P0 |
| 18 | `languages/KotlinRules.kt` | Kotlin-specific rules | P0 |
| 19 | `languages/TypeScriptRules.kt` | TS-specific rules | P0 |
| 20 | `languages/JavaRules.kt` | Java-specific rules | P0 |
| 21 | `exceptions/*.kt` | Exception classes | P0 |
| 22 | `build.gradle.kts` | Build config | P0 |
| 23 | Native JNI C code | JNI bridge implementation | P0 |

### Dependencies (build.gradle.kts)

```kotlin
dependencies {
    // No external Kotlin dependencies for core parsing
    // JNI native library loaded at runtime
    
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
    testImplementation("org.assertj:assertj-core:3.25.3")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.0")
    testImplementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.17.0")
}
```

---

## 9. Deployment Considerations

### 9.1 Native Library Distribution

- Bundle platform-specific natives in JAR (linux-x64, macos-arm64, windows-x64)
- Extract to temp directory on first load
- Verify SHA256 checksum after extraction
- Fallback: allow user to specify library path via system property

### 9.2 Grammar Distribution

- Bundle all 12 grammar files in resources
- Total size: ~15MB (all grammars combined)
- Alternative: download grammars on first use (configurable)

---

## 10. Appendix

### Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
| 3 | Class Diagram | [class-diagram.png](diagrams/class-diagram.png) | [class-diagram.drawio](diagrams/class-diagram.drawio) |
