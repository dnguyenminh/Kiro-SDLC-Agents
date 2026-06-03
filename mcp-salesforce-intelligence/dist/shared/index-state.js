"use strict";
/**
 * Index state persistence — tracks file hashes for incremental indexing.
 * Stored as .sf-index-state.json in the project root.
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
exports.IndexStateManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const STATE_FILENAME = '.sf-index-state.json';
const STATE_VERSION = 1;
class IndexStateManager {
    statePath;
    state;
    constructor(projectRoot) {
        this.statePath = path.join(projectRoot, STATE_FILENAME);
        this.state = this.createEmpty(projectRoot);
    }
    /** Load state from disk. Returns empty state if file missing or corrupted. */
    load() {
        try {
            if (!fs.existsSync(this.statePath)) {
                return this.state;
            }
            const content = fs.readFileSync(this.statePath, 'utf-8');
            const parsed = JSON.parse(content);
            if (parsed.version !== STATE_VERSION) {
                console.error('[index-state] Version mismatch, resetting state');
                return this.state;
            }
            this.state = parsed;
            return this.state;
        }
        catch (err) {
            console.error('[index-state] Failed to load state, resetting:', err.message);
            return this.state;
        }
    }
    /** Save current state to disk */
    save() {
        try {
            this.state.last_indexed = new Date().toISOString();
            this.state.total_files = Object.keys(this.state.files).length;
            fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8');
        }
        catch (err) {
            console.error('[index-state] Failed to save state:', err.message);
        }
    }
    /** Compare current files against stored hashes to find changes */
    getChangedFiles(currentFiles) {
        const added = [];
        const modified = [];
        const unchanged = [];
        const currentPaths = new Set(currentFiles.map(f => f.path));
        for (const file of currentFiles) {
            const existing = this.state.files[file.path];
            if (!existing) {
                added.push(file.path);
            }
            else if (existing.hash !== file.hash) {
                modified.push(file.path);
            }
            else {
                unchanged.push(file.path);
            }
        }
        // Files in state but not in current = deleted
        const deleted = Object.keys(this.state.files).filter(p => !currentPaths.has(p));
        return { added, modified, deleted, unchanged };
    }
    /** Update hash entry for a single file */
    updateFileHash(filePath, hash, type, name) {
        this.state.files[filePath] = {
            hash,
            indexed_at: new Date().toISOString(),
            type,
            name,
        };
    }
    /** Remove a file from state */
    removeFile(filePath) {
        delete this.state.files[filePath];
    }
    /** Get current state */
    getState() {
        return this.state;
    }
    /** Reset state to empty */
    reset(projectPath) {
        this.state = this.createEmpty(projectPath);
    }
    createEmpty(projectPath) {
        return {
            version: STATE_VERSION,
            project_path: projectPath,
            last_indexed: '',
            total_files: 0,
            files: {},
        };
    }
}
exports.IndexStateManager = IndexStateManager;
//# sourceMappingURL=index-state.js.map