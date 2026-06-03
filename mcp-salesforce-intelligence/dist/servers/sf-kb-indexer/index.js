#!/usr/bin/env node
"use strict";
/**
 * sf-kb-indexer MCP Server — Indexes Salesforce metadata into Knowledge Base.
 * Exposes 4 tools via stdio JSON-RPC 2.0.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const server_base_js_1 = require("../../shared/server-base.js");
const errors_js_1 = require("../../shared/errors.js");
const index_project_js_1 = require("./tools/index-project.js");
const index_file_js_1 = require("./tools/index-file.js");
const kb_search_js_1 = require("./tools/kb-search.js");
const kb_sync_js_1 = require("./tools/kb-sync.js");
const TOOLS = [
    {
        name: 'sf_index_project',
        description: 'Index an entire SFDX project — parses all metadata, builds dependency graph, and ingests into Knowledge Base.',
        inputSchema: {
            type: 'object',
            properties: {
                project_path: { type: 'string', description: 'Path to SFDX project root' },
                force: { type: 'boolean', description: 'Force full re-index (ignore cached hashes)', default: false },
            },
            required: ['project_path'],
        },
    },
    {
        name: 'sf_index_file',
        description: 'Index a single metadata file into Knowledge Base.',
        inputSchema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Path to single metadata file' },
            },
            required: ['file_path'],
        },
    },
    {
        name: 'sf_kb_search',
        description: 'Search Knowledge Base for indexed Salesforce metadata components.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query' },
                metadata_type: { type: 'string', description: 'Filter: ApexClass, ApexTrigger, Flow, CustomObject, LWC' },
                limit: { type: 'number', description: 'Max results (max 50)', default: 10 },
            },
            required: ['query'],
        },
    },
    {
        name: 'sf_kb_sync',
        description: 'Sync KB with current project state — detects changes and re-indexes only modified files.',
        inputSchema: {
            type: 'object',
            properties: {
                project_path: { type: 'string', description: 'Path to SFDX project root' },
            },
            required: ['project_path'],
        },
    },
];
class SfKbIndexerServer extends server_base_js_1.ServerBase {
    constructor() {
        super('sf-kb-indexer', TOOLS);
    }
    async dispatchTool(name, args) {
        console.error(`[sf-kb-indexer] INFO: Tool call ${name}(${JSON.stringify(args).substring(0, 150)})`);
        try {
            switch (name) {
                case 'sf_index_project': return await (0, index_project_js_1.handleIndexProject)(args, this.workspace);
                case 'sf_index_file': return await (0, index_file_js_1.handleIndexFile)(args, this.workspace);
                case 'sf_kb_search': return await (0, kb_search_js_1.handleKbSearch)(args, this.workspace);
                case 'sf_kb_sync': return await (0, kb_sync_js_1.handleKbSync)(args, this.workspace);
                default: return JSON.stringify({ error: 'UNKNOWN', message: `Unknown tool: ${name}` });
            }
        }
        catch (err) {
            if (err instanceof errors_js_1.SfToolError)
                return err.toJSON();
            console.error(`[sf-kb-indexer] ERROR: Unexpected error in ${name}:`, err);
            return JSON.stringify({ error: 'INTERNAL', message: `Internal error: ${err.message}` });
        }
    }
}
const server = new SfKbIndexerServer();
server.start().catch((err) => {
    console.error('[sf-kb-indexer] Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map