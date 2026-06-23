"use strict";
/**
 * sf_scan_project tool — Scan SFDX project structure and list all components.
 * Implements UC-5, BR-18 through BR-20.
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
exports.scanProjectSchema = void 0;
exports.handleScanProject = handleScanProject;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const zod_1 = require("zod");
const errors_js_1 = require("../../../shared/errors.js");
const sfdx_detector_js_1 = require("../../../shared/sfdx-detector.js");
exports.scanProjectSchema = zod_1.z.object({
    project_path: zod_1.z.string().min(1, 'project_path is required'),
});
async function handleScanProject(args, workspace) {
    const parsed = exports.scanProjectSchema.safeParse(args);
    if (!parsed.success) {
        return JSON.stringify({ error: 'SF-002', message: parsed.error.issues[0].message });
    }
    const { project_path } = parsed.data;
    const resolved = path.resolve(workspace, project_path);
    if (!resolved.startsWith(path.normalize(workspace))) {
        throw new errors_js_1.SfToolError('SF-001', `Path traversal detected: ${project_path}`);
    }
    const detector = new sfdx_detector_js_1.SfdxDetector();
    const project = detector.detect(resolved);
    if (!project) {
        throw errors_js_1.Errors.notSfdxProject(project_path);
    }
    const components = scanComponents(project.root, project.packageDirectories);
    const summary = {
        apex_classes: 0, apex_triggers: 0, flows: 0,
        objects: 0, lwc_components: 0, other: 0, total: components.length,
    };
    for (const comp of components) {
        switch (comp.type) {
            case 'ApexClass':
            case 'ApexInterface':
            case 'ApexEnum':
                summary.apex_classes++;
                break;
            case 'ApexTrigger':
                summary.apex_triggers++;
                break;
            case 'Flow':
                summary.flows++;
                break;
            case 'CustomObject':
                summary.objects++;
                break;
            case 'LWC':
                summary.lwc_components++;
                break;
            default:
                summary.other++;
                break;
        }
    }
    const result = {
        project_path: project.root,
        sfdx_config: project.config,
        package_directories: project.packageDirectories,
        components,
        summary,
    };
    return JSON.stringify(result);
}
function scanComponents(projectRoot, packageDirs) {
    const components = [];
    for (const pkgDir of packageDirs) {
        const pkgPath = path.join(projectRoot, pkgDir);
        if (!fs.existsSync(pkgPath))
            continue;
        scanDirectory(pkgPath, 'classes', '.cls', 'ApexClass', components, projectRoot);
        scanDirectory(pkgPath, 'triggers', '.trigger', 'ApexTrigger', components, projectRoot);
        scanDirectory(pkgPath, 'flows', '.flow-meta.xml', 'Flow', components, projectRoot);
        scanObjectsDirectory(pkgPath, components, projectRoot);
        scanLwcDirectory(pkgPath, components, projectRoot);
    }
    return components;
}
function scanDirectory(basePath, subDir, ext, type, components, projectRoot) {
    const searchPaths = findDirectories(basePath, subDir);
    for (const dirPath of searchPaths) {
        if (!fs.existsSync(dirPath))
            continue;
        const files = fs.readdirSync(dirPath).filter(f => f.endsWith(ext));
        for (const file of files) {
            const name = file.replace(ext, '').replace('-meta.xml', '');
            const filePath = path.relative(projectRoot, path.join(dirPath, file));
            components.push({ name, type, file_path: filePath.replace(/\\/g, '/') });
        }
    }
}
function scanObjectsDirectory(basePath, components, projectRoot) {
    const searchPaths = findDirectories(basePath, 'objects');
    for (const dirPath of searchPaths) {
        if (!fs.existsSync(dirPath))
            continue;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const filePath = path.relative(projectRoot, path.join(dirPath, entry.name));
                components.push({ name: entry.name, type: 'CustomObject', file_path: filePath.replace(/\\/g, '/') });
            }
            else if (entry.name.endsWith('.object-meta.xml')) {
                const name = entry.name.replace('.object-meta.xml', '');
                const filePath = path.relative(projectRoot, path.join(dirPath, entry.name));
                components.push({ name, type: 'CustomObject', file_path: filePath.replace(/\\/g, '/') });
            }
        }
    }
}
function scanLwcDirectory(basePath, components, projectRoot) {
    const searchPaths = findDirectories(basePath, 'lwc');
    for (const dirPath of searchPaths) {
        if (!fs.existsSync(dirPath))
            continue;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('__')) {
                const filePath = path.relative(projectRoot, path.join(dirPath, entry.name));
                components.push({ name: entry.name, type: 'LWC', file_path: filePath.replace(/\\/g, '/') });
            }
        }
    }
}
function findDirectories(basePath, targetName) {
    const results = [];
    const walk = (dir, depth) => {
        if (depth > 5)
            return;
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    if (entry.name === targetName) {
                        results.push(path.join(dir, entry.name));
                    }
                    else if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                        walk(path.join(dir, entry.name), depth + 1);
                    }
                }
            }
        }
        catch { /* skip unreadable */ }
    };
    walk(basePath, 0);
    return results;
}
//# sourceMappingURL=scan-project.js.map