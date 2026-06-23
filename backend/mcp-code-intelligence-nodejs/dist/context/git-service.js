"use strict";
/**
 * KSA-159: Git Service — wraps git log for file history.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitService = void 0;
const child_process_1 = require("child_process");
class GitService {
    workspaceRoot;
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }
    /** Get recent commit history for a file. */
    getFileHistory(filePath, limit = 5) {
        try {
            const output = (0, child_process_1.execSync)(`git log --oneline --follow -n ${limit} -- "${filePath}"`, { cwd: this.workspaceRoot, encoding: 'utf-8', timeout: 5000 });
            return output.trim().split('\n').filter(Boolean).map(line => {
                const spaceIdx = line.indexOf(' ');
                return {
                    hash: line.substring(0, spaceIdx),
                    message: line.substring(spaceIdx + 1)
                };
            });
        }
        catch {
            return []; // Git not available or file not tracked
        }
    }
    /** Check if git is available in the workspace. */
    isAvailable() {
        try {
            (0, child_process_1.execSync)('git rev-parse --is-inside-work-tree', {
                cwd: this.workspaceRoot,
                encoding: 'utf-8',
                timeout: 2000
            });
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.GitService = GitService;
//# sourceMappingURL=git-service.js.map