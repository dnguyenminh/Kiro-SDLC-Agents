"use strict";
/**
 * GitDiffProvider — Git diff resolution
 * KSA-252
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitDiffProvider = void 0;
const child_process_1 = require("child_process");
class GitDiffProvider {
    workspaceRoot;
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }
    async getDiff() {
        try {
            const unstaged = (0, child_process_1.execSync)('git diff', { cwd: this.workspaceRoot, encoding: 'utf8', maxBuffer: 1024 * 1024 });
            const staged = (0, child_process_1.execSync)('git diff --staged', { cwd: this.workspaceRoot, encoding: 'utf8', maxBuffer: 1024 * 1024 });
            const parts = [];
            if (staged.trim())
                parts.push('=== Staged Changes ===\n' + staged);
            if (unstaged.trim())
                parts.push('=== Unstaged Changes ===\n' + unstaged);
            return parts.length > 0 ? parts.join('\n\n') : 'No changes detected.';
        }
        catch (err) {
            return `[Git error: ${err.message}]`;
        }
    }
}
exports.GitDiffProvider = GitDiffProvider;
//# sourceMappingURL=GitDiffProvider.js.map