/**
 * mcp-salesforce-intelligence — Public API
 * Shared library for Salesforce code intelligence utilities.
 * NOT an MCP server — consumed by mcp-code-intelligence-nodejs and kiro-sdlc-agents.
 */
export { SfdxDetector } from './shared/sfdx-detector.js';
export type { SfdxProject } from './shared/types.js';
export { SF_RELATIONSHIP_KINDS, isSfRelationship, getSfRelationshipLabel, type SfRelationshipKind, } from './sf-relationship-types.js';
export { SfMetadataType, detectMetadataType, getMetadataTypeLabel, SF_FILE_EXTENSIONS, } from './sf-metadata-types.js';
export { buildSfIndexingOptions, type SfIndexingOptions, type SfdxStats, } from './sf-indexing-options.js';
export { loadApexGrammar, getApexWasmPath, isApexGrammarAvailable, } from './apex-grammar-loader.js';
//# sourceMappingURL=index.d.ts.map