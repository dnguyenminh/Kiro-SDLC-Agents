/**
 * Memory module barrel — exports all public APIs.
 */
export { MemoryEngine } from './memory-engine.js';
export { MemoryToolDispatcher } from './tool-dispatcher.js';
export { MEMORY_TOOL_DEFINITIONS } from './tool-definitions.js';
export { EmbeddingService, EmbeddingFactory } from './embedding/index.js';
export { typesForRole } from './role-filter.js';
export { tierBoostFactor } from './tier-boost.js';
export { DecisionMemory } from './decision.js';
export { ErrorPatternMemory } from './error-pattern.js';
export { AgentHandoffMemory } from './handoff.js';
export { MemSyncCode } from './sync-code.js';
export { AutoCaptureHook } from './auto-capture.js';
export { CoreMemoryManager } from './core-memory.js';
export { EntityRepository } from './entity-repo.js';
export { ConversationRepository } from './conversation-repo.js';
export { ConversationSummarizer } from './conversation-summarizer.js';
export { extractStructuredMap } from './structured-map-extractor.js';
export * from './capture-filter.js';
export * from './graph-analytics.js';
export * from './graph-traversal.js';
export { IngestGraphLinker, RELATION_SIBLING, RELATION_DERIVED_FROM } from './ingest-graph-linker.js';
export { ChunkingStrategy, FixedSizeChunker, SemanticChunker, TextChunk } from './chunking-strategy.js';
export { parseMarkdown, parsePlainText, ParsedDocument, DocumentSection } from './document-parser.js';
//# sourceMappingURL=index.d.ts.map