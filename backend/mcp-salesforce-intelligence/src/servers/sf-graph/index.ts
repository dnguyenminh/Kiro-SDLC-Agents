#!/usr/bin/env node
/**
 * sf-graph MCP Server — Dependency graph queries and impact analysis.
 * Exposes 4 tools via stdio JSON-RPC 2.0.
 */

import { ServerBase } from '../../shared/server-base.js';
import { SfToolError, Errors } from '../../shared/errors.js';
import type { ToolDefinition } from '../../shared/types.js';
import { DependencyGraph } from './graph/dependency-graph.js';
import { GraphCache } from './graph/graph-cache.js';
import { handleDependencies } from './tools/dependencies.js';
import { handleDependents } from './tools/dependents.js';
import { handleImpactAnalysis } from './tools/impact-analysis.js';
import { handleGraphExport } from './tools/graph-export.js';

const TOOLS: ToolDefinition[] = [
  {
    name: 'sf_dependencies',
    description: 'Get forward dependencies of a Salesforce component (what it depends on).',
    inputSchema: {
      type: 'object',
      properties: {
        node_name: { type: 'string', description: 'Fully qualified component name' },
        depth: { type: 'number', description: 'Max traversal depth (default 3, max 10)', default: 3 },
        include_types: { type: 'array', items: { type: 'string' }, description: 'Filter by metadata types' },
      },
      required: ['node_name'],
    },
  },
  {
    name: 'sf_dependents',
    description: 'Get reverse dependencies (what depends on this component).',
    inputSchema: {
      type: 'object',
      properties: {
        node_name: { type: 'string', description: 'Fully qualified component name' },
        depth: { type: 'number', description: 'Max traversal depth (default 3, max 10)', default: 3 },
        include_types: { type: 'array', items: { type: 'string' }, description: 'Filter by metadata types' },
      },
      required: ['node_name'],
    },
  },
  {
    name: 'sf_impact_analysis',
    description: 'Analyze the impact of changing a component — shows all directly and indirectly affected components.',
    inputSchema: {
      type: 'object',
      properties: {
        node_name: { type: 'string', description: 'Component to analyze' },
        depth: { type: 'number', description: 'Max depth (default 3, capped at 10)', default: 3 },
      },
      required: ['node_name'],
    },
  },
  {
    name: 'sf_graph_export',
    description: 'Export the full dependency graph in JSON or DOT (Graphviz) format.',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['json', 'dot'], description: 'Output format', default: 'json' },
        include_types: { type: 'array', items: { type: 'string' }, description: 'Filter nodes by type' },
      },
    },
  },
];

class SfGraphServer extends ServerBase {
  private graph: DependencyGraph = new DependencyGraph();
  private graphCache: GraphCache | null = null;

  constructor() {
    super('sf-graph', TOOLS);
  }

  protected async onInitialize(): Promise<void> {
    if (this.workspace) {
      this.graphCache = new GraphCache(this.workspace);
      const cached = this.graphCache.load();
      if (cached) {
        this.graph = cached;
        console.error(`[sf-graph] Loaded graph from cache: ${this.graph.nodeCount} nodes, ${this.graph.edgeCount} edges`);
      } else {
        console.error('[sf-graph] No graph cache found. Run sf_index_project first.');
      }
    }
  }

  protected async dispatchTool(name: string, args: Record<string, unknown>): Promise<string> {
    console.error(`[sf-graph] INFO: Tool call ${name}(${JSON.stringify(args).substring(0, 150)})`);
    try {
      if (this.graph.isEmpty && name !== 'sf_graph_export') {
        if (this.graphCache) {
          const cached = this.graphCache.load();
          if (cached) this.graph = cached;
        }
        if (this.graph.isEmpty) throw Errors.noGraph();
      }

      switch (name) {
        case 'sf_dependencies': return await handleDependencies(args, this.graph);
        case 'sf_dependents': return await handleDependents(args, this.graph);
        case 'sf_impact_analysis': return await handleImpactAnalysis(args, this.graph);
        case 'sf_graph_export': return await handleGraphExport(args, this.graph);
        default: return JSON.stringify({ error: 'UNKNOWN', message: `Unknown tool: ${name}` });
      }
    } catch (err) {
      if (err instanceof SfToolError) return err.toJSON();
      console.error(`[sf-graph] ERROR: Unexpected error in ${name}:`, err);
      return JSON.stringify({ error: 'INTERNAL', message: `Internal error: ${(err as Error).message}` });
    }
  }
}

const server = new SfGraphServer();
server.start().catch((err) => {
  console.error('[sf-graph] Fatal error:', err);
  process.exit(1);
});
