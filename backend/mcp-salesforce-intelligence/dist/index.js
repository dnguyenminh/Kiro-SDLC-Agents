"use strict";
/**
 * mcp-salesforce-intelligence — Public API
 * Shared library for Salesforce code intelligence utilities.
 * NOT an MCP server — consumed by mcp-code-intelligence-nodejs and kiro-sdlc-agents.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isApexGrammarAvailable = exports.getApexWasmPath = exports.loadApexGrammar = exports.buildSfIndexingOptions = exports.SF_FILE_EXTENSIONS = exports.getMetadataTypeLabel = exports.detectMetadataType = exports.SfMetadataType = exports.getSfRelationshipLabel = exports.isSfRelationship = exports.SF_RELATIONSHIP_KINDS = exports.SfdxDetector = void 0;
// Core utilities
var sfdx_detector_js_1 = require("./shared/sfdx-detector.js");
Object.defineProperty(exports, "SfdxDetector", { enumerable: true, get: function () { return sfdx_detector_js_1.SfdxDetector; } });
// SF relationship types
var sf_relationship_types_js_1 = require("./sf-relationship-types.js");
Object.defineProperty(exports, "SF_RELATIONSHIP_KINDS", { enumerable: true, get: function () { return sf_relationship_types_js_1.SF_RELATIONSHIP_KINDS; } });
Object.defineProperty(exports, "isSfRelationship", { enumerable: true, get: function () { return sf_relationship_types_js_1.isSfRelationship; } });
Object.defineProperty(exports, "getSfRelationshipLabel", { enumerable: true, get: function () { return sf_relationship_types_js_1.getSfRelationshipLabel; } });
// SF metadata types
var sf_metadata_types_js_1 = require("./sf-metadata-types.js");
Object.defineProperty(exports, "SfMetadataType", { enumerable: true, get: function () { return sf_metadata_types_js_1.SfMetadataType; } });
Object.defineProperty(exports, "detectMetadataType", { enumerable: true, get: function () { return sf_metadata_types_js_1.detectMetadataType; } });
Object.defineProperty(exports, "getMetadataTypeLabel", { enumerable: true, get: function () { return sf_metadata_types_js_1.getMetadataTypeLabel; } });
Object.defineProperty(exports, "SF_FILE_EXTENSIONS", { enumerable: true, get: function () { return sf_metadata_types_js_1.SF_FILE_EXTENSIONS; } });
// SF indexing options
var sf_indexing_options_js_1 = require("./sf-indexing-options.js");
Object.defineProperty(exports, "buildSfIndexingOptions", { enumerable: true, get: function () { return sf_indexing_options_js_1.buildSfIndexingOptions; } });
// Apex grammar loader
var apex_grammar_loader_js_1 = require("./apex-grammar-loader.js");
Object.defineProperty(exports, "loadApexGrammar", { enumerable: true, get: function () { return apex_grammar_loader_js_1.loadApexGrammar; } });
Object.defineProperty(exports, "getApexWasmPath", { enumerable: true, get: function () { return apex_grammar_loader_js_1.getApexWasmPath; } });
Object.defineProperty(exports, "isApexGrammarAvailable", { enumerable: true, get: function () { return apex_grammar_loader_js_1.isApexGrammarAvailable; } });
//# sourceMappingURL=index.js.map