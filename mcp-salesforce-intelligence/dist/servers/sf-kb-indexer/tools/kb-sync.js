"use strict";
/**
 * sf_kb_sync tool — Sync index state, detect changes, and re-index only modified files.
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
exports.kbSyncSchema = void 0;
exports.handleKbSync = handleKbSync;
const path = __importStar(require("path"));
const zod_1 = require("zod");
const errors_js_1 = require("../../../shared/errors.js");
const sfdx_detector_js_1 = require("../../../shared/sfdx-detector.js");
const index_project_js_1 = require("./index-project.js");
exports.kbSyncSchema = zod_1.z.object({
    project_path: zod_1.z.string().min(1, 'project_path is required'),
});
async function handleKbSync(args, workspace) {
    const parsed = exports.kbSyncSchema.safeParse(args);
    if (!parsed.success)
        return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });
    const { project_path } = parsed.data;
    const resolved = path.resolve(workspace, project_path);
    if (!resolved.startsWith(path.normalize(workspace)))
        throw new errors_js_1.SfToolError('SF-001', `Path traversal detected: ${project_path}`);
    const detector = new sfdx_detector_js_1.SfdxDetector();
    const project = detector.detect(resolved);
    if (!project)
        throw errors_js_1.Errors.notSfdxProject(project_path);
    // Sync = incremental index (force=false)
    return (0, index_project_js_1.handleIndexProject)({ project_path, force: false }, workspace);
}
//# sourceMappingURL=kb-sync.js.map