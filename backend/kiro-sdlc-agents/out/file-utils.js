"use strict";
/**
 * File system utilities — recursive copy operations for injection.
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
exports.copyDirRecursive = copyDirRecursive;
exports.copyDirFiltered = copyDirFiltered;
exports.copySelectedItems = copySelectedItems;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const SKIP_DIRS = ["node_modules", "__pycache__", "out", "dist", ".git"];
/** Copy directory recursively, overwriting existing files. */
function copyDirRecursive(source, target) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
        const srcPath = path.join(source, entry.name);
        const tgtPath = path.join(target, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.includes(entry.name)) {
                continue;
            }
            copyDirRecursive(srcPath, tgtPath);
        }
        else {
            fs.copyFileSync(srcPath, tgtPath);
        }
    }
}
/** Copy directory recursively, skipping paths in skipPaths set. */
function copyDirFiltered(config) {
    const { source, target, workspaceRoot, skipPaths } = config;
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
        const srcPath = path.join(source, entry.name);
        const tgtPath = path.join(target, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.includes(entry.name)) {
                continue;
            }
            copyDirFiltered({ source: srcPath, target: tgtPath, workspaceRoot, skipPaths });
        }
        else {
            const rel = path.relative(workspaceRoot, tgtPath).replace(/\\/g, "/");
            if (skipPaths.has(rel)) {
                continue;
            }
            fs.copyFileSync(srcPath, tgtPath);
        }
    }
}
/** Copy only specific items from source directory. */
function copySelectedItems(source, target, items) {
    fs.mkdirSync(target, { recursive: true });
    for (const item of items) {
        const srcPath = path.join(source, item);
        const tgtPath = path.join(target, item);
        if (!fs.existsSync(srcPath)) {
            continue;
        }
        if (fs.statSync(srcPath).isDirectory()) {
            copyDirRecursive(srcPath, tgtPath);
        }
        else {
            fs.mkdirSync(path.dirname(tgtPath), { recursive: true });
            fs.copyFileSync(srcPath, tgtPath);
        }
    }
}
//# sourceMappingURL=file-utils.js.map