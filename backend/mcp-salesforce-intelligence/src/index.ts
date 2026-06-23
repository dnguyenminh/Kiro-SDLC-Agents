/**
 * mcp-salesforce-intelligence — Public API
 * Shared library for Salesforce code intelligence utilities.
 * NOT an MCP server — consumed by mcp-code-intelligence-nodejs and kiro-sdlc-agents.
 */

// Core utilities
export { SfdxDetector } from './shared/sfdx-detector.js';
export type { SfdxProject } from './shared/types.js';

// SF relationship types
export {
  SF_RELATIONSHIP_KINDS,
  isSfRelationship,
  getSfRelationshipLabel,
  type SfRelationshipKind,
} from './sf-relationship-types.js';

// SF metadata types
export {
  SfMetadataType,
  detectMetadataType,
  getMetadataTypeLabel,
  SF_FILE_EXTENSIONS,
} from './sf-metadata-types.js';

// SF indexing options
export {
  buildSfIndexingOptions,
  type SfIndexingOptions,
  type SfdxStats,
} from './sf-indexing-options.js';

// Apex grammar loader
export {
  loadApexGrammar,
  getApexWasmPath,
  isApexGrammarAvailable,
} from './apex-grammar-loader.js';
