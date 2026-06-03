"use strict";
/**
 * sf_index_project tool — Full project indexing with KB ingestion and graph building.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexProjectSchema = void 0;
exports.handleIndexProject = handleIndexProject;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const zod_1 = require("zod");
const errors_js_1 = require("../../../shared/errors.js");
const sfdx_detector_js_1 = require("../../../shared/sfdx-detector.js");
const file_hasher_js_1 = require("../../../shared/file-hasher.js");
const index_state_js_1 = require("../../../shared/index-state.js");
const kb_client_js_1 = require("../../../shared/kb-client.js");
const graph_builder_js_1 = require("../../sf-graph/graph/graph-builder.js");
const graph_cache_js_1 = require("../../sf-graph/graph/graph-cache.js");
const parse_apex_js_1 = require("../../sf-parser/tools/parse-apex.js");
const parse_flow_js_1 = require("../../sf-parser/tools/parse-flow.js");
const parse_object_js_1 = require("../../sf-parser/tools/parse-object.js");
exports.indexProjectSchema = zod_1.z.object({
    project_path: zod_1.z.string().min(1, 'project_path is required'),
    force: zod_1.z.boolean().optional().default(false),
});
let indexingInProgress = false;
async function handleIndexProject(args, workspace) {
    const parsed = exports.indexProjectSchema.safeParse(args);
    if (!parsed.success)
        return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });
    if (indexingInProgress)
        throw errors_js_1.Errors.alreadyIndexing();
    const { project_path, force } = parsed.data;
    const resolved = path.resolve(workspace, project_path);
    if (!resolved.startsWith(path.normalize(workspace)))
        throw new errors_js_1.SfToolError('SF-001', `Path traversal detected: ${project_path}`);
    const detector = new sfdx_detector_js_1.SfdxDetector();
    const project = detector.detect(resolved);
    if (!project)
        throw errors_js_1.Errors.notSfdxProject(project_path);
    indexingInProgress = true;
    const startTime = Date.now();
    try {
        const hasher = new file_hasher_js_1.FileHasher();
        const stateManager = new index_state_js_1.IndexStateManager(project.root);
        const kbClient = new kb_client_js_1.KBClient(workspace);
        if (!force)
            stateManager.load();
        const files = scanAllFiles(project.root, project.packageDirectories);
        const fileInfos = files.map(f => ({ path: f.relativePath, hash: hasher.hashFile(f.absolutePath) }));
        const changes = force
            ? { added: fileInfos.map(f => f.path), modified: [], deleted: [], unchanged: [] }
            : stateManager.getChangedFiles(fileInfos);
        const toProcess = [...changes.added, ...changes.modified];
        const apexResults = [];
        const flowResults = [];
        const objectResults = [];
        const lwcResults = [];
        const errors = [];
        let parsedOk = 0;
        for (const relPath of toProcess) {
            try {
                const result = await parseFile(relPath, project.root);
                if (result) {
                    parsedOk++;
                    const fileHash = fileInfos.find(f => f.path === relPath)?.hash ?? '';
                    stateManager.updateFileHash(relPath, fileHash, result.type, result.name);
                    if (result.kind === 'apex')
                        apexResults.push(result.data);
                    else if (result.kind === 'flow')
                        flowResults.push(result.data);
                    else if (result.kind === 'object')
                        objectResults.push(result.data);
                    else if (result.kind === 'lwc')
                        lwcResults.push(result.data);
                }
            }
            catch (err) {
                errors.push({ file: relPath, error: err.message });
            }
        }
        // Build graph from all results
        const graphBuilder = new graph_builder_js_1.GraphBuilder();
        const graph = graphBuilder.buildFromParseResults({ apex: apexResults, flows: flowResults, objects: objectResults, lwc: lwcResults });
        const graphCache = new graph_cache_js_1.GraphCache(project.root);
        graphCache.save(graph);
        // KB ingestion
        const kbPayloads = buildKBPayloads(apexResults, flowResults, objectResults, lwcResults);
        const kbResult = kbPayloads.length > 0 ? await kbClient.batchIngest(kbPayloads) : { ingested: 0, failed: 0 };
        stateManager.save();
        for (const d of changes.deleted)
            stateManager.removeFile(d);
        if (changes.deleted.length > 0)
            stateManager.save();
        const timeMs = Date.now() - startTime;
        return JSON.stringify({
            project_path: project.root, status: errors.length === 0 ? 'success' : 'partial',
            summary: { total_files: files.length, parsed_ok: parsedOk, errors: errors.length, skipped_unchanged: changes.unchanged.length, time_ms: timeMs, kb_entries_created: kbResult.ingested, graph_nodes: graph.nodeCount, graph_edges: graph.edgeCount },
            by_type: { apex_classes: apexResults.filter(a => a.type !== 'trigger').length, apex_triggers: apexResults.filter(a => a.type === 'trigger').length, flows: flowResults.length, objects: objectResults.length, lwc_components: lwcResults.length, other: 0 },
            errors: errors.slice(0, 20),
        });
    }
    finally {
        indexingInProgress = false;
    }
}
async function parseFile(relPath, projectRoot) {
    if (relPath.endsWith('.cls') || relPath.endsWith('.trigger')) {
        const data = JSON.parse(await (0, parse_apex_js_1.handleParseApex)({ file_path: relPath }, projectRoot));
        if (data.error)
            return null;
        return { kind: 'apex', type: data.type === 'trigger' ? 'ApexTrigger' : 'ApexClass', name: data.name, data };
    }
    if (relPath.endsWith('.flow-meta.xml')) {
        const data = JSON.parse(await (0, parse_flow_js_1.handleParseFlow)({ file_path: relPath }, projectRoot));
        if (data.error)
            return null;
        return { kind: 'flow', type: 'Flow', name: data.name, data };
    }
    if (relPath.endsWith('.object-meta.xml')) {
        const data = JSON.parse(await (0, parse_object_js_1.handleParseObject)({ file_path: relPath }, projectRoot));
        if (data.error)
            return null;
        return { kind: 'object', type: 'CustomObject', name: data.name, data };
    }
    return null;
}
function buildKBPayloads(apex, flows, objects, lwc) {
    const payloads = [];
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
function scanAllFiles(projectRoot, packageDirs) {
    const files = [];
    for (const pkgDir of packageDirs) {
        const pkgPath = path.join(projectRoot, pkgDir);
        if (fs.existsSync(pkgPath))
            walkDir(pkgPath, projectRoot, files);
    }
    return files;
}
function walkDir(dir, projectRoot, files) {
    try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                walkDir(fullPath, projectRoot, files);
            }
            else if (entry.name.endsWith('.cls') || entry.name.endsWith('.trigger') || entry.name.endsWith('.flow-meta.xml') || entry.name.endsWith('.object-meta.xml')) {
                files.push({ relativePath: path.relative(projectRoot, fullPath).replace(/\\/g, '/'), absolutePath: fullPath });
            }
        }
    }
    catch { /* skip */ }
}
//# sourceMappingURL=index-project.js.map