#!/usr/bin/env node
/**
 * sf-kb-indexer MCP Server — Indexes Salesforce metadata into Knowledge Base.
 * Exposes 4 tools via stdio JSON-RPC 2.0.
 */

import { ServerBase } from '../../shared/server-base.js';
import { SfToolError } from '../../shared/errors.js';
import type { ToolDefinition } from '../../shared/types.js';
import { handleIndexProject } from './tools/index-project.js';
import { handleIndexFile } from './tools/index-file.js';
import { handleKbSearch } from './tools/kb-search.js';
import { handleKbSync } from './tools/kb-sync.js';

const TOOLS: ToolDefinition[] = [
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

class SfKbIndexerServer extends ServerBase {
  constructor() {
    super('sf-kb-indexer', TOOLS);
  }

  protected async dispatchTool(name: string, args: Record<string, unknown>): Promise<string> {
    console.error(`[sf-kb-indexer] INFO: Tool call ${name}(${JSON.stringify(args).substring(0, 150)})`);
    try {
      switch (name) {
        case 'sf_index_project': return await handleIndexProject(args, this.workspace);
        case 'sf_index_file': return await handleIndexFile(args, this.workspace);
        case 'sf_kb_search': return await handleKbSearch(args, this.workspace);
        case 'sf_kb_sync': return await handleKbSync(args, this.workspace);
        default: return JSON.stringify({ error: 'UNKNOWN', message: `Unknown tool: ${name}` });
      }
    } catch (err) {
      if (err instanceof SfToolError) return err.toJSON();
      console.error(`[sf-kb-indexer] ERROR: Unexpected error in ${name}:`, err);
      return JSON.stringify({ error: 'INTERNAL', message: `Internal error: ${(err as Error).message}` });
    }
  }
}

const server = new SfKbIndexerServer();
server.start().catch((err) => {
  console.error('[sf-kb-indexer] Fatal error:', err);
  process.exit(1);
});
