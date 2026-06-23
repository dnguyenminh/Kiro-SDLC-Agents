"use strict";
/**
 * Tool registration and dispatch — provides both SDK registration and raw dispatch.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = registerTools;
exports.getToolDefinitions = getToolDefinitions;
exports.dispatchTool = dispatchTool;
exports.initOrchestration = initOrchestration;
exports.initMemoryDispatcher = initMemoryDispatcher;
exports.getMemoryDispatcherInstance = getMemoryDispatcherInstance;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const query_layer_js_1 = require("../query/query-layer.js");
const code_search_js_1 = require("./code-search.js");
const code_symbols_js_1 = require("./code-symbols.js");
const code_context_js_1 = require("./code-context.js");
const code_modules_js_1 = require("./code-modules.js");
const code_index_status_js_1 = require("./code-index-status.js");
const stream_write_file_js_1 = require("./stream-write-file.js");
const code_kb_export_js_1 = require("./code-kb-export.js");
const drawio_tool_js_1 = require("./drawio-tool.js");
const drawio_export_png_js_1 = require("./drawio-export-png.js");
const call_graph_tools_js_1 = require("./call-graph-tools.js");
const dependency_tools_js_1 = require("./dependency-tools.js");
const impact_tools_js_1 = require("./impact-tools.js");
const code_traverse_js_1 = require("./code-traverse.js");
const index_js_1 = require("../memory/index.js");
const ComplexityTool_js_1 = require("../analyzers/complexity/ComplexityTool.js");
const EntryPointTool_js_1 = require("../analyzers/entry-points/EntryPointTool.js");
const GraphAnalysisTools_js_1 = require("../analyzers/graph-analysis/GraphAnalysisTools.js");
const ai_context_tools_js_1 = require("./ai-context-tools.js");
const SimilarityTools_js_1 = require("../analyzers/similarity/SimilarityTools.js");
/** Register all 7 MCP tools on the server instance (SDK mode). */
function registerTools(server, dbManager, indexer, workspace) {
    const queryLayer = new query_layer_js_1.QueryLayer(dbManager);
    (0, code_search_js_1.registerCodeSearch)(server, queryLayer);
    (0, code_symbols_js_1.registerCodeSymbols)(server, queryLayer);
    (0, code_context_js_1.registerCodeContext)(server, queryLayer, workspace);
    (0, code_modules_js_1.registerCodeModules)(server, queryLayer);
    (0, code_index_status_js_1.registerCodeIndexStatus)(server, queryLayer, indexer);
    (0, stream_write_file_js_1.registerStreamWriteFile)(server, workspace);
    (0, code_kb_export_js_1.registerCodeKbExport)(server, queryLayer, workspace);
    console.error('[tools] Registered 12 MCP tools (7 core + 5 graph)');
}
/** Get tool definitions for tools/list response (raw mode). */
function getToolDefinitions() {
    const defs = [...TOOL_DEFINITIONS, ...index_js_1.MEMORY_TOOL_DEFINITIONS];
    if (orchestrationEngine) {
        defs.push(...orchestrationEngine.metaToolDispatcher.getDefinitions());
    }
    // Conditionally include drawio_export_png only if a renderer is available
    if ((0, drawio_export_png_js_1.isExportPngAvailable)(orchestrationEngine)) {
        defs.push(drawio_export_png_js_1.DRAWIO_EXPORT_PNG_DEFINITION);
    }
    return defs;
}
/** Log code_search to analytics via memory dispatcher. */
function logCodeSearchAnalytics(args, result) {
    try {
        const dispatcher = getMemoryDispatcherInstance();
        if (!dispatcher)
            return;
        const query = args.query ?? '';
        const match = result.match(/(\d+) results/);
        const count = match ? parseInt(match[1], 10) : 0;
        dispatcher.logSearchAnalytics(query, count);
    }
    catch { /* analytics must not break search */ }
}
/** Dispatch a tool call and return result text (raw mode). */
async function dispatchTool(name, args, dbManager, indexer, workspace) {
    // Try orchestration meta-tools first (find_tools, execute_dynamic_tool, etc.)
    if (orchestrationEngine) {
        const orchResult = await orchestrationEngine.metaToolDispatcher.dispatch(name, args);
        if (orchResult !== null)
            return orchResult;
    }
    // Try memory tools
    const memResult = getMemoryDispatcher(dbManager, workspace).dispatch(name, args);
    if (memResult !== null)
        return memResult;
    const queryLayer = new query_layer_js_1.QueryLayer(dbManager);
    return dispatchByName(name, args, queryLayer, indexer, workspace, dbManager);
}
let orchestrationEngine = null;
/** Wire orchestration engine into tool dispatch. */
function initOrchestration(engine) {
    orchestrationEngine = engine;
}
let memoryDispatcher = null;
/** Initialize memory dispatcher with engine and optional embedding. */
function initMemoryDispatcher(engine, workspace, embeddingService) {
    const v1 = new index_js_1.MemoryToolDispatcher(engine, workspace, embeddingService);
    const db = engine.db || engine.getDb?.() || null;
    const { MemoryToolDispatcherV2 } = require('../memory/tool-dispatcher-v2.js');
    const { MemoryToolDispatcherConsolidated } = require('../memory/tool-dispatcher-consolidated.js');
    const v2 = db ? new MemoryToolDispatcherV2(db) : null;
    const consolidated = new MemoryToolDispatcherConsolidated(v1, v2);
    // Inject ConversationRepository + Summarizer deps
    if (db) {
        const convRepo = new index_js_1.ConversationRepository(db);
        const knowledgeRepo = engine.knowledge || null;
        const summarizer = knowledgeRepo
            ? new index_js_1.ConversationSummarizer(convRepo, knowledgeRepo)
            : null;
        consolidated.setConversationDeps(convRepo, summarizer);
    }
    memoryDispatcher = consolidated;
}
/** Get the initialized memory dispatcher (for tool-call ingest hook). */
function getMemoryDispatcherInstance() {
    return memoryDispatcher;
}
function getMemoryDispatcher(dbManager, workspace) {
    if (!memoryDispatcher) {
        const engine = new index_js_1.MemoryEngine(dbManager.getDb());
        engine.startSession('mcp-client');
        memoryDispatcher = new index_js_1.MemoryToolDispatcher(engine, workspace, null);
    }
    return memoryDispatcher;
}
async function dispatchByName(name, args, queryLayer, indexer, workspace, dbManager) {
    switch (name) {
        case 'code_search': {
            const result = handleCodeSearch(args, queryLayer);
            logCodeSearchAnalytics(args, result);
            return result;
        }
        case 'code_symbols':
            return handleCodeSymbols(args, queryLayer);
        case 'code_context':
            return handleCodeContext(args, queryLayer, workspace);
        case 'code_modules':
            return handleCodeModules(args, queryLayer);
        case 'code_index_status':
            return handleCodeIndexStatus(args, queryLayer, indexer);
        case 'stream_write_file':
            return handleStreamWriteFile(args, workspace);
        case 'code_kb_export':
            return handleCodeKbExport(args, queryLayer, workspace);
        case 'drawio_auto_layout':
            return (0, drawio_tool_js_1.handleDrawioLayout)(args, workspace);
        case 'drawio_export_png':
            return (0, drawio_export_png_js_1.handleDrawioExportPng)(args, workspace, orchestrationEngine);
        case 'code_callers':
            return (0, call_graph_tools_js_1.handleCodeCallers)(args, dbManager.getDb());
        case 'code_callees':
            return (0, call_graph_tools_js_1.handleCodeCallees)(args, dbManager.getDb());
        case 'code_dependencies':
            return (0, dependency_tools_js_1.handleCodeDependencies)(args, dbManager.getDb(), workspace);
        case 'code_impact':
            return (0, impact_tools_js_1.handleCodeImpact)(args, dbManager.getDb(), workspace);
        case 'code_traverse':
            return (0, code_traverse_js_1.handleCodeTraverse)(args, dbManager.getDb(), workspace);
        case 'complexity_analysis':
            return (0, ComplexityTool_js_1.handleComplexityTool)(args, dbManager.getDb());
        case 'find_entry_points':
            return (0, EntryPointTool_js_1.handleEntryPointTool)(args, dbManager.getDb());
        case 'find_circular_deps':
        case 'find_related_tests':
        case 'find_hot_paths':
        case 'find_dead_imports':
        case 'module_summary': {
            const result = (0, GraphAnalysisTools_js_1.handleGraphAnalysisTool)(name, args, dbManager.getDb());
            return result ?? `Unknown tool: ${name}`;
        }
        case 'get_ai_context':
            return (0, ai_context_tools_js_1.handleGetAIContext)(args, dbManager.getDb(), workspace);
        case 'get_edit_context':
            return (0, ai_context_tools_js_1.handleGetEditContext)(args, dbManager.getDb(), workspace);
        case 'get_curated_context':
            return (0, ai_context_tools_js_1.handleGetCuratedContext)(args, dbManager.getDb(), workspace, dbManager);
        case 'find_duplicates':
        case 'find_dead_code':
        case 'git_search':
        case 'git_index': {
            const simResult = (0, SimilarityTools_js_1.handleSimilarityTool)(name, args, dbManager.getDb(), workspace);
            return simResult ?? `Unknown tool: ${name}`;
        }
        default:
            return `Unknown tool: ${name}`;
    }
}
function handleCodeSearch(args, ql) {
    const query = args.query ?? '';
    const limit = args.limit ?? 20;
    const results = ql.searchCode(query, limit);
    if (results.length === 0)
        return `No results found for "${query}"`;
    const lines = [`Found ${results.length} results for "${query}":\n`];
    for (const r of results) {
        lines.push(`[${r.kind}] ${r.name}`);
        lines.push(`  File: ${r.filePath}:${r.startLine}`);
        if (r.signature)
            lines.push(`  Sig: ${r.signature.slice(0, 120)}`);
        lines.push('');
    }
    return lines.join('\n');
}
function handleCodeSymbols(args, ql) {
    const name = args.name;
    const file = args.file;
    const kind = args.kind;
    const limit = args.limit ?? 50;
    if (file) {
        const symbols = ql.getFileSymbols(file);
        if (symbols.length === 0)
            return `No symbols found in ${file}`;
        const lines = [`Symbols in ${file} (${symbols.length}):\n`];
        for (const s of symbols) {
            lines.push(`  L${s.startLine} [${s.kind}] ${s.name}`);
        }
        return lines.join('\n');
    }
    if (name) {
        const symbols = ql.findSymbols(name, kind, limit);
        if (symbols.length === 0)
            return `No symbols matching "${name}"`;
        const lines = [`Found ${symbols.length} symbols matching "${name}":\n`];
        for (const s of symbols) {
            lines.push(`[${s.kind}] ${s.name} - ${s.filePath}:${s.startLine}`);
        }
        return lines.join('\n');
    }
    return 'Provide either "name" or "file" parameter';
}
function handleCodeContext(args, ql, workspace) {
    const file = args.file;
    if (!file)
        return 'Parameter "file" is required';
    const fullPath = path.resolve(workspace, file);
    if (!fs.existsSync(fullPath))
        return `File not found: ${file}`;
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    const contextLines = args.contextLines ?? 5;
    const symbol = args.symbol;
    if (symbol) {
        const symbols = ql.getFileSymbols(file);
        const match = symbols.find(s => s.name === symbol);
        if (!match)
            return `Symbol "${symbol}" not found in ${file}`;
        const start = Math.max(0, match.startLine - 1 - contextLines);
        const end = Math.min(lines.length, match.endLine + contextLines);
        return formatLines(lines, start, end, file);
    }
    const startLine = args.startLine;
    const endLine = args.endLine;
    const start = Math.max(0, (startLine ?? 1) - 1 - contextLines);
    const end = Math.min(lines.length, (endLine ?? startLine ?? lines.length) + contextLines);
    return formatLines(lines, start, end, file);
}
function handleCodeModules(args, ql) {
    const name = args.name;
    const modules = ql.listModulesWithPatterns(name ?? null);
    if (modules.length === 0)
        return 'No modules indexed yet.';
    const lines = [`Modules (${modules.length}):\n`];
    for (const m of modules) {
        lines.push(`📦 ${m.name}`);
        lines.push(`   Path: ${m.rootPath}`);
        if (m.language)
            lines.push(`   Lang: ${m.language}`);
        lines.push(`   Files: ${m.fileCount} | Symbols: ${m.symbolCount}`);
        const patterns = formatPatternsRaw(m);
        if (patterns)
            lines.push(`   Patterns: ${patterns}`);
        if (m.purpose)
            lines.push(`   Purpose: ${m.purpose}`);
        lines.push('');
    }
    return lines.join('\n');
}
function formatPatternsRaw(m) {
    const parts = [];
    if (m.diStyle)
        parts.push(`DI=${m.diStyle}`);
    if (m.errorHandling)
        parts.push(`Errors=${m.errorHandling}`);
    if (m.namingConvention)
        parts.push(`Naming=${m.namingConvention}`);
    if (m.loggingFramework)
        parts.push(`Logging=${m.loggingFramework}`);
    if (m.testingFramework)
        parts.push(`Testing=${m.testingFramework}`);
    return parts.join(' | ');
}
async function handleCodeIndexStatus(args, ql, indexer) {
    if (args.reindex)
        await indexer.runFullIndex();
    const status = ql.getIndexStatus();
    const tsStats = indexer.getTreeSitterStats();
    const lines = [
        'Code Intelligence Index Status\n',
        `State: ${indexer.isRunning() ? 'Indexing...' : 'Idle'}`,
        `Parser: ${tsStats.ready ? `tree-sitter (${tsStats.languages.join(', ')})` : 'regex fallback'}`,
        `Files: ${status.totalFiles}`,
        `Symbols: ${status.totalSymbols}`,
        `Modules: ${status.totalModules}`,
        `Last indexed: ${status.lastIndexed ?? 'Never'}`,
        '', 'Languages:',
    ];
    for (const [lang, count] of Object.entries(status.languages)) {
        lines.push(`  ${lang}: ${count} files`);
    }
    if (tsStats.unavailableGrammars.length > 0) {
        lines.push('');
        lines.push(`⚠️ Unavailable grammars (WASM missing — using regex fallback): ${tsStats.unavailableGrammars.join(', ')}`);
    }
    return lines.join('\n');
}
function handleStreamWriteFile(args, workspace) {
    const rawPath = args.file_path;
    if (!rawPath)
        return '{"error":"file_path is required"}';
    const mode = args.mode ?? 'write';
    const content = args.content ?? '';
    const filePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(workspace, rawPath);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    const fileExists = fs.existsSync(filePath);
    const sizeBefore = fileExists ? fs.statSync(filePath).size : 0;
    if (fileExists && content === '') {
        return JSON.stringify({ file_path: filePath, bytes_written: 0, total_size: sizeBefore, mode: 'no-op' });
    }
    if (mode === 'create' && fileExists) {
        return JSON.stringify({ file_path: filePath, bytes_written: 0, total_size: sizeBefore, mode: 'error', message: 'File already exists' });
    }
    const encoding = args.encoding ?? 'utf-8';
    if (mode === 'append' && fileExists) {
        fs.appendFileSync(filePath, content, { encoding });
    }
    else {
        fs.writeFileSync(filePath, content, { encoding });
    }
    const totalSize = fs.statSync(filePath).size;
    return JSON.stringify({ file_path: filePath, bytes_written: totalSize - sizeBefore, total_size: totalSize, mode });
}
function handleCodeKbExport(args, ql, workspace) {
    const moduleName = args.module;
    const format = args.format ?? 'json';
    const modules = ql.listModulesWithPatterns(moduleName ?? null);
    if (modules.length === 0)
        return '[]';
    const projectName = path.basename(workspace);
    if (format === 'text') {
        const lines = [];
        for (const m of modules) {
            lines.push(`--- Code Index — ${m.name} ---`);
            lines.push(`Module: ${m.name}`);
            lines.push(`Language: ${m.language ?? 'unknown'}`);
            lines.push(`Purpose: ${m.purpose ?? 'unknown'}`);
            lines.push(`Files: ${m.fileCount}`);
            lines.push(`Symbols: ${m.symbolCount}`);
            lines.push('');
            lines.push('Patterns:');
            lines.push(`  DI Style: ${m.diStyle ?? 'unknown'}`);
            lines.push(`  Error Handling: ${m.errorHandling ?? 'unknown'}`);
            lines.push(`  Naming: ${m.namingConvention ?? 'unknown'}`);
            lines.push(`  Logging: ${m.loggingFramework ?? 'unknown'}`);
            lines.push(`  Testing: ${m.testingFramework ?? 'unknown'}`);
            lines.push(`Tags: code-index, ${m.name}, ${m.language ?? 'unknown'}`);
            lines.push(`Project: ${projectName}`);
            lines.push('');
        }
        return lines.join('\n');
    }
    // JSON format
    const payloads = modules.map(m => ({
        title: `Code Index — ${m.name}`,
        content: [
            `Module: ${m.name}`, `Language: ${m.language ?? 'unknown'}`,
            `Purpose: ${m.purpose ?? 'unknown'}`, `Files: ${m.fileCount}`,
            `Symbols: ${m.symbolCount}`, '',
            'Patterns:', `  DI Style: ${m.diStyle ?? 'unknown'}`,
            `  Error Handling: ${m.errorHandling ?? 'unknown'}`,
            `  Naming: ${m.namingConvention ?? 'unknown'}`,
            `  Logging: ${m.loggingFramework ?? 'unknown'}`,
            `  Testing: ${m.testingFramework ?? 'unknown'}`,
        ].join('\n'),
        tags: `code-index, ${m.name}, ${m.language ?? 'unknown'}`,
        project: projectName,
    }));
    return JSON.stringify(payloads, null, 2);
}
function formatLines(lines, start, end, file) {
    const numbered = lines
        .slice(start, end)
        .map((line, i) => `${String(start + i + 1).padStart(4)} | ${line}`);
    return `// ${file} [${start + 1}-${end}]\n${numbered.join('\n')}`;
}
const TOOL_DEFINITIONS = [
    {
        name: 'code_search',
        description: 'Full-text search across indexed code symbols (functions, classes, interfaces). Uses SQLite FTS5 with porter stemming.',
        inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search query (supports FTS5 syntax)' }, limit: { type: 'number', description: 'Max results (default 20)' } }, required: ['query'] },
    },
    {
        name: 'code_symbols',
        description: 'Find code symbols by name prefix or list symbols in a file.',
        inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Symbol name prefix' }, file: { type: 'string', description: 'File path' }, kind: { type: 'string', description: 'Filter by kind' }, limit: { type: 'number', description: 'Max results' } } },
    },
    {
        name: 'code_context',
        description: 'Get source code context around a symbol or line range.',
        inputSchema: { type: 'object', properties: { file: { type: 'string', description: 'Relative file path' }, symbol: { type: 'string', description: 'Symbol name' }, startLine: { type: 'number', description: 'Start line' }, endLine: { type: 'number', description: 'End line' }, contextLines: { type: 'number', description: 'Extra lines' } }, required: ['file'] },
    },
    {
        name: 'code_modules',
        description: 'List all discovered code modules with file counts and languages.',
        inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Filter by module name' } } },
    },
    {
        name: 'code_index_status',
        description: 'Get current indexing status: file count, symbol count, languages, last indexed time.',
        inputSchema: { type: 'object', properties: { reindex: { type: 'boolean', description: 'Trigger re-index' } } },
    },
    {
        name: 'stream_write_file',
        description: 'Write content directly to a file on disk. Modes: write (overwrite), append, create (fail if exists).',
        inputSchema: { type: 'object', properties: { file_path: { type: 'string', description: 'Path to file' }, content: { type: 'string', description: 'Text content' }, mode: { type: 'string', description: 'write, append, or create' }, encoding: { type: 'string', description: 'Encoding' } }, required: ['file_path'] },
    },
    {
        name: 'code_kb_export',
        description: 'Export code intelligence data as Knowledge Base payloads for ingestion.',
        inputSchema: { type: 'object', properties: { module: { type: 'string', description: 'Filter by module name' }, format: { type: 'string', description: 'Output format: json or text' } } },
    },
    drawio_tool_js_1.DRAWIO_TOOL_DEFINITION,
    ...call_graph_tools_js_1.CALL_GRAPH_TOOL_DEFINITIONS,
    ...dependency_tools_js_1.DEPENDENCY_TOOL_DEFINITIONS,
    ...impact_tools_js_1.IMPACT_TOOL_DEFINITIONS,
    ...code_traverse_js_1.TRAVERSE_TOOL_DEFINITIONS,
    ComplexityTool_js_1.COMPLEXITY_TOOL_DEFINITION,
    EntryPointTool_js_1.ENTRY_POINT_TOOL_DEFINITION,
    ...GraphAnalysisTools_js_1.GRAPH_ANALYSIS_TOOL_DEFINITIONS,
    ...ai_context_tools_js_1.AI_CONTEXT_TOOL_DEFINITIONS,
    ...SimilarityTools_js_1.SIMILARITY_TOOL_DEFINITIONS,
];
//# sourceMappingURL=register-tools.js.map