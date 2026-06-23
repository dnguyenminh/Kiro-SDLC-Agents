/**
 * KSA-159: Git Service — wraps git log for file history.
 */
import { execSync } from 'child_process';
export class GitService {
    workspaceRoot;
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }
    /** Get recent commit history for a file. */
    getFileHistory(filePath, limit = 5) {
        try {
            const output = execSync(`git log --oneline --follow -n ${limit} -- "${filePath}"`, { cwd: this.workspaceRoot, encoding: 'utf-8', timeout: 5000 });
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
            execSync('git rev-parse --is-inside-work-tree', {
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
//# sourceMappingURL=git-service.js.map