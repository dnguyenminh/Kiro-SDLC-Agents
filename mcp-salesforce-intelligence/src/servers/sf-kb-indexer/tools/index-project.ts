/**
 * sf_index_project tool — Full project indexing with KB ingestion and graph building.
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { Errors, SfToolError } from '../../../shared/errors.js';
import { SfdxDetector } from '../../../shared/sfdx-detector.js';
import { FileHasher } from '../../../shared/file-hasher.js';
import { IndexStateManager } from '../../../shared/index-state.js';
import { KBClient } from '../../../shared/kb-client.js';
import { GraphBuilder } from '../../sf-graph/graph/graph-builder.js';
import { GraphCache } from '../../sf-graph/graph/graph-cache.js';
import { handleParseApex } from '../../sf-parser/tools/parse-apex.js';
import { handleParseFlow } from '../../sf-parser/tools/parse-flow.js';
import { handleParseObject } from '../../sf-parser/tools/parse-object.js';
import { handleParseLwc } from '../../sf-parser/tools/parse-lwc.js';
import type { ApexParseResult, FlowParseResult, ObjectParseResult, LWCParseResult, MetadataType, KBPayload } from '../../../shared/types.js';

export const indexProjectSchema = z.object({
  project_path: z.string().min(1, 'project_path is required'),
  force: z.boolean().optional().default(false),
});

let indexingInProgress = false;

export async function handleIndexProject(args: Record<string, unknown>, workspace: string): Promise<string> {
  const parsed = indexProjectSchema.safeParse(args);
  if (!parsed.success) return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });
  if (indexingInProgress) throw Errors.alreadyIndexing();

  const { project_path, force } = parsed.data;
  const resolved = path.resolve(workspace, project_path);
  if (!resolved.startsWith(path.normalize(workspace))) throw new SfToolError('SF-001', `Path traversal detected: ${project_path}`);

  const detector = new SfdxDetector();
  const project = detector.detect(resolved);
  if (!project) throw Errors.notSfdxProject(project_path);

  indexingInProgress = true;
  const startTime = Date.now();

  try {
    const hasher = new FileHasher();
    const stateManager = new IndexStateManager(project.root);
    const kbClient = new KBClient(workspace);
    if (!force) stateManager.load();

    const files = scanAllFiles(project.root, project.packageDirectories);
    const fileInfos = files.map(f => ({ path: f.relativePath, hash: hasher.hashFile(f.absolutePath) }));
    const changes = force
      ? { added: fileInfos.map(f => f.path), modified: [], deleted: [], unchanged: [] }
      : stateManager.getChangedFiles(fileInfos);

    const toProcess = [...changes.added, ...changes.modified];
    const apexResults: ApexParseResult[] = [];
    const flowResults: FlowParseResult[] = [];
    const objectResults: ObjectParseResult[] = [];
    const lwcResults: LWCParseResult[] = [];
    const errors: Array<{ file: string; error: string }> = [];
    let parsedOk = 0;

    for (const relPath of toProcess) {
      try {
        const result = await parseFile(relPath, project.root);
        if (result) {
          parsedOk++;
          const fileHash = fileInfos.find(f => f.path === relPath)?.hash ?? '';
          stateManager.updateFileHash(relPath, fileHash, result.type, result.name);
          if (result.kind === 'apex') apexResults.push(result.data);
          else if (result.kind === 'flow') flowResults.push(result.data);
          else if (result.kind === 'object') objectResults.push(result.data);
          else if (result.kind === 'lwc') lwcResults.push(result.data);
        }
      } catch (err) { errors.push({ file: relPath, error: (err as Error).message }); }
    }

    // Build graph from all results
    const graphBuilder = new GraphBuilder();
    const graph = graphBuilder.buildFromParseResults({ apex: apexResults, flows: flowResults, objects: objectResults, lwc: lwcResults });
    const graphCache = new GraphCache(project.root);
    graphCache.save(graph);

    // KB ingestion
    const kbPayloads = buildKBPayloads(apexResults, flowResults, objectResults, lwcResults);
    const kbResult = kbPayloads.length > 0 ? await kbClient.batchIngest(kbPayloads) : { ingested: 0, failed: 0 };

    stateManager.save();
    for (const d of changes.deleted) stateManager.removeFile(d);
    if (changes.deleted.length > 0) stateManager.save();

    const timeMs = Date.now() - startTime;
    return JSON.stringify({
      project_path: project.root, status: errors.length === 0 ? 'success' : 'partial',
      summary: { total_files: files.length, parsed_ok: parsedOk, errors: errors.length, skipped_unchanged: changes.unchanged.length, time_ms: timeMs, kb_entries_created: kbResult.ingested, graph_nodes: graph.nodeCount, graph_edges: graph.edgeCount },
      by_type: { apex_classes: apexResults.filter(a => a.type !== 'trigger').length, apex_triggers: apexResults.filter(a => a.type === 'trigger').length, flows: flowResults.length, objects: objectResults.length, lwc_components: lwcResults.length, other: 0 },
      errors: errors.slice(0, 20),
    });
  } finally { indexingInProgress = false; }
}

interface ParsedFile { kind: 'apex' | 'flow' | 'object' | 'lwc'; type: MetadataType; name: string; data: any; }

async function parseFile(relPath: string, projectRoot: string): Promise<ParsedFile | null> {
  if (relPath.endsWith('.cls') || relPath.endsWith('.trigger')) {
    const data = JSON.parse(await handleParseApex({ file_path: relPath }, projectRoot));
    if (data.error) return null;
    return { kind: 'apex', type: data.type === 'trigger' ? 'ApexTrigger' : 'ApexClass', name: data.name, data };
  }
  if (relPath.endsWith('.flow-meta.xml')) {
    const data = JSON.parse(await handleParseFlow({ file_path: relPath }, projectRoot));
    if (data.error) return null;
    return { kind: 'flow', type: 'Flow', name: data.name, data };
  }
  if (relPath.endsWith('.object-meta.xml')) {
    const data = JSON.parse(await handleParseObject({ file_path: relPath }, projectRoot));
    if (data.error) return null;
    return { kind: 'object', type: 'CustomObject', name: data.name, data };
  }
  return null;
}

function buildKBPayloads(apex: ApexParseResult[], flows: FlowParseResult[], objects: ObjectParseResult[], lwc: LWCParseResult[]): KBPayload[] {
  const payloads: KBPayload[] = [];
  for (const a of apex) {
    const methods = a.methods.map(m => `- \`${m.name}(${m.parameters.map(p => p.type + ' ' + p.name).join(', ')}): ${m.return_type}\``).join('\n');
    payloads.push({ content: `## ${a.name} (${a.type})\n\n**File:** ${a.file_path}\n**Modifiers:** ${a.modifiers.join(', ')}\n\n### Methods\n${methods || '(none)'}\n\n### Dependencies\n- References: ${a.dependencies.referenced_classes.slice(0, 10).join(', ')}\n- DML: ${a.dependencies.dml_operations.join(', ')}`, type: 'CONTEXT', tags: `salesforce, ApexClass, ${a.name}`, summary: `${a.name} — ${a.type} with ${a.methods.length} methods` });
  }
  for (const f of flows) {
    payloads.push({ content: `## ${f.name} (Flow)\n\n**File:** ${f.file_path}\n**Type:** ${f.type}\n**Elements:** ${f.elements.length}`, type: 'CONTEXT', tags: `salesforce, Flow, ${f.name}`, summary: `${f.name} — ${f.type} flow` });
  }
  for (const o of objects) {
    payloads.push({ content: `## ${o.name} (CustomObject)\n\n**File:** ${o.file_path}\n**Fields:** ${o.fields.length}\n**Relationships:** ${o.relationships.length}`, type: 'CONTEXT', tags: `salesforce, CustomObject, ${o.name}`, summary: `${o.name} — ${o.fields.length} fields` });
  }
  for (const l of lwc) {
    payloads.push({ content: `## ${l.name} (LWC)\n\n**File:** ${l.file_path}\n**Apex:** ${l.apex_calls.join(', ')}\n**Children:** ${l.child_components.join(', ')}`, type: 'CONTEXT', tags: `salesforce, LWC, ${l.name}`, summary: `${l.name} — LWC component` });
  }
  return payloads;
}

interface ScannedFile { relativePath: string; absolutePath: string; }

function scanAllFiles(projectRoot: string, packageDirs: string[]): ScannedFile[] {
  const files: ScannedFile[] = [];
  for (const pkgDir of packageDirs) {
    const pkgPath = path.join(projectRoot, pkgDir);
    if (fs.existsSync(pkgPath)) walkDir(pkgPath, projectRoot, files);
  }
  return files;
}

function walkDir(dir: string, projectRoot: string, files: ScannedFile[]): void {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walkDir(fullPath, projectRoot, files);
      } else if (entry.name.endsWith('.cls') || entry.name.endsWith('.trigger') || entry.name.endsWith('.flow-meta.xml') || entry.name.endsWith('.object-meta.xml')) {
        files.push({ relativePath: path.relative(projectRoot, fullPath).replace(/\\/g, '/'), absolutePath: fullPath });
      }
    }
  } catch { /* skip */ }
}
