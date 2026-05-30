/**
 * Tool registration and dispatch — provides both SDK registration and raw dispatch.
 */

import * as fs from 'fs';
import * as path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DatabaseManager } from '../db/database-manager.js';
import { IndexingEngine } from '../indexer/indexing-engine.js';
import { QueryLayer } from '../query/query-layer.js';
import { registerCodeSearch } from './code-search.js';
import { registerCodeSymbols } from './code-symbols.js';
import { registerCodeContext } from './code-context.js';
import { registerCodeModules } from './code-modules.js';
import { registerCodeIndexStatus } from './code-index-status.js';
import { registerStreamWriteFile } from './stream-write-file.js';
import { registerCodeKbExport } from './code-kb-export.js';
import { handleDrawioLayout, DRAWIO_TOOL_DEFINITION } from './drawio-tool.js';
import { handleDrawioExportPng, DRAWIO_EXPORT_PNG_DEFINITION, isExportPngAvailable } from './drawio-export-png.js';
import { CALL_GRAPH_TOOL_DEFINITIONS, handleCodeCallers, handleCodeCallees } from './call-graph-tools.js';
import { DEPENDENCY_TOOL_DEFINITIONS, handleCodeDependencies } from './dependency-tools.js';
import { IMPACT_TOOL_DEFINITIONS, handleCodeImpact } from './impact-tools.js';
import { TRAVERSE_TOOL_DEFINITIONS, handleCodeTraverse } from './code-traverse.js';
import { MemoryEngine, MemoryToolDispatcher, MEMORY_TOOL_DEFINITIONS } from '../memory/index.js';
import { EmbeddingService } from '../memory/embedding/index.js';
import { OrchestrationEngine } from '../orchestration/engine.js';
import { COMPLEXITY_TOOL_DEFINITION, handleComplexityTool } from '../analyzers/complexity/ComplexityTool.js';
import { ENTRY_POINT_TOOL_DEFINITION, handleEntryPointTool } from '../analyzers/entry-points/EntryPointTool.js';
import { GRAPH_ANALYSIS_TOOL_DEFINITIONS, handleGraphAnalysisTool } from '../analyzers/graph-analysis/GraphAnalysisTools.js';
import { AI_CONTEXT_TOOL_DEFINITIONS, handleGetAIContext, handleGetEditContext, handleGetCuratedContext } from './ai-context-tools.js';
import { SIMILARITY_TOOL_DEFINITIONS, handleSimilarityTool } from '../analyzers/similarity/SimilarityTools.js';

/** Register all 7 MCP tools on the server instance (SDK mode). */
export function registerTools(
  server: McpServer,
  dbManager: DatabaseManager,
  indexer: IndexingEngine,
  workspace: string
): void {
  const queryLayer = new QueryLayer(dbManager);
  registerCodeSearch(server, queryLayer);
  registerCodeSymbols(server, queryLayer);
  registerCodeContext(server, queryLayer, workspace);
  registerCodeModules(server, queryLayer);
  registerCodeIndexStatus(server, queryLayer, indexer);
  registerStreamWriteFile(server, workspace);
  registerCodeKbExport(server, queryLayer, workspace);
  console.error('[tools] Registered 12 MCP tools (7 core + 5 graph)');
}

/** Get tool definitions for tools/list response (raw mode). */
export function getToolDefinitions(): object[] {
  const defs: object[] = [...TOOL_DEFINITIONS, ...MEMORY_TOOL_DEFINITIONS];
  if (orchestrationEngine) {
    defs.push(...orchestrationEngine.metaToolDispatcher.getDefinitions());
  }
  // Conditionally include drawio_export_png only if a renderer is available
  if (isExportPngAvailable(orchestrationEngine)) {
    defs.push(DRAWIO_EXPORT_PNG_DEFINITION);
  }
  return defs;
}

/** Log code_search to analytics via memory dispatcher. */
function logCodeSearchAnalytics(args: Record<string, unknown>, result: string): void {
  try {
    const dispatcher = getMemoryDispatcherInstance();
    if (!dispatcher) return;
    const query = (args.query as string) ?? '';
    const match = result.match(/(\d+) results/);
    const count = match ? parseInt(match[1], 10) : 0;
    dispatcher.logSearchAnalytics(query, count);
  } catch { /* analytics must not break search */ }
}

/** Dispatch a tool call and return result text (raw mode). */
export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  dbManager: DatabaseManager,
  indexer: IndexingEngine,
  workspace: string
): Promise<string> {
  // Try orchestration meta-tools first (find_tools, execute_dynamic_tool, etc.)
  if (orchestrationEngine) {
    const orchResult = await orchestrationEngine.metaToolDispatcher.dispatch(name, args);
    if (orchResult !== null) return orchResult;
  }

  // Try memory tools
  const memResult = getMemoryDispatcher(dbManager, workspace).dispatch(name, args);
  if (memResult !== null) return memResult;

  const queryLayer = new QueryLayer(dbManager);
  return dispatchByName(name, args, queryLayer, indexer, workspace, dbManager);
}

let orchestrationEngine: OrchestrationEngine | null = null;

/** Wire orchestration engine into tool dispatch. */
export function initOrchestration(engine: OrchestrationEngine): void {
  orchestrationEngine = engine;
}

let memoryDispatcher: MemoryToolDispatcher | null = null;

/** Initialize memory dispatcher with engine and optional embedding. */
export function initMemoryDispatcher(
  engine: MemoryEngine, workspace: string, embeddingService: EmbeddingService | null
): void {
  memoryDispatcher = new MemoryToolDispatcher(engine, workspace, embeddingService);
}

/** Get the initialized memory dispatcher (for tool-call ingest hook). */
export function getMemoryDispatcherInstance(): MemoryToolDispatcher | null {
  return memoryDispatcher;
}

function getMemoryDispatcher(dbManager: DatabaseManager, workspace: string): MemoryToolDispatcher {
  if (!memoryDispatcher) {
    const engine = new MemoryEngine(dbManager.getDb());
    engine.startSession('mcp-client');
    memoryDispatcher = new MemoryToolDispatcher(engine, workspace, null);
  }
  return memoryDispatcher;
}

async function dispatchByName(
  name: string,
  args: Record<string, unknown>,
  queryLayer: QueryLayer,
  indexer: IndexingEngine,
  workspace: string,
  dbManager: DatabaseManager
): Promise<string> {
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
      return handleDrawioLayout(args, workspace);
    case 'drawio_export_png':
      return handleDrawioExportPng(args, workspace, orchestrationEngine);
    case 'code_callers':
      return handleCodeCallers(args, dbManager.getDb());
    case 'code_callees':
      return handleCodeCallees(args, dbManager.getDb());
    case 'code_dependencies':
      return handleCodeDependencies(args, dbManager.getDb(), workspace);
    case 'code_impact':
      return handleCodeImpact(args, dbManager.getDb(), workspace);
    case 'code_traverse':
      return handleCodeTraverse(args, dbManager.getDb(), workspace);
    case 'complexity_analysis':
      return handleComplexityTool(args, dbManager.getDb());
    case 'find_entry_points':
      return handleEntryPointTool(args, dbManager.getDb());
    case 'find_circular_deps':
    case 'find_related_tests':
    case 'find_hot_paths':
    case 'find_dead_imports':
    case 'module_summary': {
      const result = handleGraphAnalysisTool(name, args, dbManager.getDb());
      return result ?? `Unknown tool: ${name}`;
    }
    case 'get_ai_context':
      return handleGetAIContext(args, dbManager.getDb(), workspace);
    case 'get_edit_context':
      return handleGetEditContext(args, dbManager.getDb(), workspace);
    case 'get_curated_context':
      return handleGetCuratedContext(args, dbManager.getDb(), workspace, dbManager);
    case 'find_duplicates':
    case 'find_dead_code':
    case 'git_search':
    case 'git_index': {
      const simResult = handleSimilarityTool(name, args, dbManager.getDb(), workspace);
      return simResult ?? `Unknown tool: ${name}`;
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

function handleCodeSearch(args: Record<string, unknown>, ql: QueryLayer): string {
  const query = (args.query as string) ?? '';
  const limit = (args.limit as number) ?? 20;
  const results = ql.searchCode(query, limit);
  if (results.length === 0) return `No results found for "${query}"`;
  const lines = [`Found ${results.length} results for "${query}":\n`];
  for (const r of results) {
    lines.push(`[${r.kind}] ${r.name}`);
    lines.push(`  File: ${r.filePath}:${r.startLine}`);
    if (r.signature) lines.push(`  Sig: ${r.signature.slice(0, 120)}`);
    lines.push('');
  }
  return lines.join('\n');
}

function handleCodeSymbols(args: Record<string, unknown>, ql: QueryLayer): string {
  const name = args.name as string | undefined;
  const file = args.file as string | undefined;
  const kind = args.kind as string | undefined;
  const limit = (args.limit as number) ?? 50;
  if (file) {
    const symbols = ql.getFileSymbols(file);
    if (symbols.length === 0) return `No symbols found in ${file}`;
    const lines = [`Symbols in ${file} (${symbols.length}):\n`];
    for (const s of symbols) {
      lines.push(`  L${s.startLine} [${s.kind}] ${s.name}`);
    }
    return lines.join('\n');
  }
  if (name) {
    const symbols = ql.findSymbols(name, kind, limit);
    if (symbols.length === 0) return `No symbols matching "${name}"`;
    const lines = [`Found ${symbols.length} symbols matching "${name}":\n`];
    for (const s of symbols) {
      lines.push(`[${s.kind}] ${s.name} - ${s.filePath}:${s.startLine}`);
    }
    return lines.join('\n');
  }
  return 'Provide either "name" or "file" parameter';
}

function handleCodeContext(
  args: Record<string, unknown>, ql: QueryLayer, workspace: string
): string {
  const file = args.file as string;
  if (!file) return 'Parameter "file" is required';
  const fullPath = path.resolve(workspace, file);
  if (!fs.existsSync(fullPath)) return `File not found: ${file}`;
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  const contextLines = (args.contextLines as number) ?? 5;
  const symbol = args.symbol as string | undefined;
  if (symbol) {
    const symbols = ql.getFileSymbols(file);
    const match = symbols.find(s => s.name === symbol);
    if (!match) return `Symbol "${symbol}" not found in ${file}`;
    const start = Math.max(0, match.startLine - 1 - contextLines);
    const end = Math.min(lines.length, match.endLine + contextLines);
    return formatLines(lines, start, end, file);
  }
  const startLine = args.startLine as number | undefined;
  const endLine = args.endLine as number | undefined;
  const start = Math.max(0, (startLine ?? 1) - 1 - contextLines);
  const end = Math.min(lines.length, (endLine ?? startLine ?? lines.length) + contextLines);
  return formatLines(lines, start, end, file);
}

function handleCodeModules(args: Record<string, unknown>, ql: QueryLayer): string {
  const name = args.name as string | undefined;
  const modules = ql.listModulesWithPatterns(name ?? null);
  if (modules.length === 0) return 'No modules indexed yet.';
  const lines = [`Modules (${modules.length}):\n`];
  for (const m of modules) {
    lines.push(`📦 ${m.name}`);
    lines.push(`   Path: ${m.rootPath}`);
    if (m.language) lines.push(`   Lang: ${m.language}`);
    lines.push(`   Files: ${m.fileCount} | Symbols: ${m.symbolCount}`);
    const patterns = formatPatternsRaw(m);
    if (patterns) lines.push(`   Patterns: ${patterns}`);
    if (m.purpose) lines.push(`   Purpose: ${m.purpose}`);
    lines.push('');
  }
  return lines.join('\n');
}

function formatPatternsRaw(m: any): string {
  const parts: string[] = [];
  if (m.diStyle) parts.push(`DI=${m.diStyle}`);
  if (m.errorHandling) parts.push(`Errors=${m.errorHandling}`);
  if (m.namingConvention) parts.push(`Naming=${m.namingConvention}`);
  if (m.loggingFramework) parts.push(`Logging=${m.loggingFramework}`);
  if (m.testingFramework) parts.push(`Testing=${m.testingFramework}`);
  return parts.join(' | ');
}

async function handleCodeIndexStatus(
  args: Record<string, unknown>, ql: QueryLayer, indexer: IndexingEngine
): Promise<string> {
  if (args.reindex) await indexer.runFullIndex();
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
  return lines.join('\n');
}

function handleStreamWriteFile(args: Record<string, unknown>, workspace: string): string {
  const rawPath = args.file_path as string;
  if (!rawPath) return '{"error":"file_path is required"}';
  const mode = (args.mode as string) ?? 'write';
  const content = (args.content as string) ?? '';
  const filePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(workspace, rawPath);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fileExists = fs.existsSync(filePath);
  const sizeBefore = fileExists ? fs.statSync(filePath).size : 0;
  if (fileExists && content === '') {
    return JSON.stringify({ file_path: filePath, bytes_written: 0, total_size: sizeBefore, mode: 'no-op' });
  }
  if (mode === 'create' && fileExists) {
    return JSON.stringify({ file_path: filePath, bytes_written: 0, total_size: sizeBefore, mode: 'error', message: 'File already exists' });
  }
  const encoding = (args.encoding as BufferEncoding) ?? 'utf-8';
  if (mode === 'append' && fileExists) {
    fs.appendFileSync(filePath, content, { encoding });
  } else {
    fs.writeFileSync(filePath, content, { encoding });
  }
  const totalSize = fs.statSync(filePath).size;
  return JSON.stringify({ file_path: filePath, bytes_written: totalSize - sizeBefore, total_size: totalSize, mode });
}

function handleCodeKbExport(
  args: Record<string, unknown>, ql: QueryLayer, workspace: string
): string {
  const moduleName = args.module as string | undefined;
  const format = (args.format as string) ?? 'json';
  const modules = ql.listModulesWithPatterns(moduleName ?? null);
  if (modules.length === 0) return '[]';
  const projectName = path.basename(workspace);

  if (format === 'text') {
    const lines: string[] = [];
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

function formatLines(lines: string[], start: number, end: number, file: string): string {
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
  DRAWIO_TOOL_DEFINITION,
  ...CALL_GRAPH_TOOL_DEFINITIONS,
  ...DEPENDENCY_TOOL_DEFINITIONS,
  ...IMPACT_TOOL_DEFINITIONS,
  ...TRAVERSE_TOOL_DEFINITIONS,
  COMPLEXITY_TOOL_DEFINITION,
  ENTRY_POINT_TOOL_DEFINITION,
  ...GRAPH_ANALYSIS_TOOL_DEFINITIONS,
  ...AI_CONTEXT_TOOL_DEFINITIONS,
  ...SIMILARITY_TOOL_DEFINITIONS,
];
