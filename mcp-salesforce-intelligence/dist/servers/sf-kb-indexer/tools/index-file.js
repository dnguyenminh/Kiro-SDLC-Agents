"use strict";
/**
 * sf_index_file tool — Index a single metadata file into KB.
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
exports.indexFileSchema = void 0;
exports.handleIndexFile = handleIndexFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const zod_1 = require("zod");
const errors_js_1 = require("../../../shared/errors.js");
const kb_client_js_1 = require("../../../shared/kb-client.js");
const parse_apex_js_1 = require("../../sf-parser/tools/parse-apex.js");
const parse_flow_js_1 = require("../../sf-parser/tools/parse-flow.js");
const parse_object_js_1 = require("../../sf-parser/tools/parse-object.js");
const parse_lwc_js_1 = require("../../sf-parser/tools/parse-lwc.js");
exports.indexFileSchema = zod_1.z.object({
    file_path: zod_1.z.string().min(1, 'file_path is required'),
});
async function handleIndexFile(args, workspace) {
    const parsed = exports.indexFileSchema.safeParse(args);
    if (!parsed.success)
        return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });
    const { file_path } = parsed.data;
    const resolved = path.resolve(workspace, file_path);
    if (!resolved.startsWith(path.normalize(workspace)))
        throw new errors_js_1.SfToolError('SF-001', `Path traversal detected: ${file_path}`);
    if (!fs.existsSync(resolved))
        throw errors_js_1.Errors.fileNotFound(file_path);
    const kbClient = new kb_client_js_1.KBClient(workspace);
    let payload = null;
    if (file_path.endsWith('.cls') || file_path.endsWith('.trigger')) {
        const data = JSON.parse(await (0, parse_apex_js_1.handleParseApex)({ file_path }, workspace));
        if (!data.error)
            payload = { content: `## ${data.name} (${data.type})\n\n**File:** ${data.file_path}\n**Methods:** ${data.methods.length}`, type: 'CONTEXT', tags: `salesforce, ApexClass, ${data.name}`, summary: `${data.name} — ${data.type}` };
    }
    else if (file_path.endsWith('.flow-meta.xml')) {
        const data = JSON.parse(await (0, parse_flow_js_1.handleParseFlow)({ file_path }, workspace));
        if (!data.error)
            payload = { content: `## ${data.name} (Flow)\n\n**File:** ${data.file_path}\n**Type:** ${data.type}`, type: 'CONTEXT', tags: `salesforce, Flow, ${data.name}`, summary: `${data.name} — flow` };
    }
    else if (file_path.endsWith('.object-meta.xml')) {
        const data = JSON.parse(await (0, parse_object_js_1.handleParseObject)({ file_path }, workspace));
        if (!data.error)
            payload = { content: `## ${data.name} (CustomObject)\n\n**File:** ${data.file_path}\n**Fields:** ${data.fields.length}`, type: 'CONTEXT', tags: `salesforce, CustomObject, ${data.name}`, summary: `${data.name} — object` };
    }
    else {
        const data = JSON.parse(await (0, parse_lwc_js_1.handleParseLwc)({ file_path }, workspace));
        if (!data.error)
            payload = { content: `## ${data.name} (LWC)\n\n**File:** ${data.file_path}`, type: 'CONTEXT', tags: `salesforce, LWC, ${data.name}`, summary: `${data.name} — LWC` };
    }
    if (payload) {
        const success = await kbClient.ingest(payload);
        return JSON.stringify({ status: success ? 'success' : 'kb_unavailable', file_path, kb_ingested: success });
    }
    return JSON.stringify({ status: 'skipped', file_path, reason: 'Could not parse file' });
}
//# sourceMappingURL=index-file.js.map