#!/usr/bin/env node
"use strict";
/**
 * sf-parser MCP Server — Parses Salesforce metadata (Apex, Flow, Object, LWC).
 * Exposes 5 tools via stdio JSON-RPC 2.0.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const server_base_js_1 = require("../../shared/server-base.js");
const errors_js_1 = require("../../shared/errors.js");
const parse_apex_js_1 = require("./tools/parse-apex.js");
const parse_flow_js_1 = require("./tools/parse-flow.js");
const parse_object_js_1 = require("./tools/parse-object.js");
const parse_lwc_js_1 = require("./tools/parse-lwc.js");
const scan_project_js_1 = require("./tools/scan-project.js");
const TOOLS = [
    {
        name: 'sf_parse_apex',
        description: 'Parse a single Apex class (.cls) or trigger (.trigger) file. Returns class structure, methods, properties, dependencies, and DML/SOQL operations.',
        inputSchema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Path to .cls or .trigger file' },
                include_body: { type: 'boolean', description: 'Include method body source', default: false },
            },
            required: ['file_path'],
        },
    },
    {
        name: 'sf_parse_flow',
        description: 'Parse a Salesforce Flow metadata XML file. Returns flow elements, variables, connectors, and dependencies.',
        inputSchema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Path to .flow-meta.xml file' },
            },
            required: ['file_path'],
        },
    },
    {
        name: 'sf_parse_object',
        description: 'Parse a CustomObject metadata file or directory. Returns fields, relationships, validation rules.',
        inputSchema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Path to .object-meta.xml or object directory' },
            },
            required: ['file_path'],
        },
    },
    {
        name: 'sf_parse_lwc',
        description: 'Parse a Lightning Web Component directory. Returns imports, public properties, wire adapters, apex calls, child components, and events.',
        inputSchema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Path to LWC component directory or single file' },
            },
            required: ['file_path'],
        },
    },
    {
        name: 'sf_scan_project',
        description: 'Scan an SFDX project and list all metadata components (classes, triggers, flows, objects, LWC).',
        inputSchema: {
            type: 'object',
            properties: {
                project_path: { type: 'string', description: 'Path to SFDX project root' },
            },
            required: ['project_path'],
        },
    },
];
class SfParserServer extends server_base_js_1.ServerBase {
    constructor() {
        super('sf-parser', TOOLS);
    }
    async dispatchTool(name, args) {
        console.error(`[sf-parser] INFO: Tool call ${name}(${JSON.stringify(args).substring(0, 150)})`);
        try {
            switch (name) {
                case 'sf_parse_apex': return await (0, parse_apex_js_1.handleParseApex)(args, this.workspace);
                case 'sf_parse_flow': return await (0, parse_flow_js_1.handleParseFlow)(args, this.workspace);
                case 'sf_parse_object': return await (0, parse_object_js_1.handleParseObject)(args, this.workspace);
                case 'sf_parse_lwc': return await (0, parse_lwc_js_1.handleParseLwc)(args, this.workspace);
                case 'sf_scan_project': return await (0, scan_project_js_1.handleScanProject)(args, this.workspace);
                default: return JSON.stringify({ error: 'UNKNOWN', message: `Unknown tool: ${name}` });
            }
        }
        catch (err) {
            if (err instanceof errors_js_1.SfToolError) {
                return err.toJSON();
            }
            console.error(`[sf-parser] ERROR: Unexpected error in ${name}:`, err);
            return JSON.stringify({ error: 'INTERNAL', message: `Internal error: ${err.message}` });
        }
    }
}
const server = new SfParserServer();
server.start().catch((err) => {
    console.error('[sf-parser] Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map