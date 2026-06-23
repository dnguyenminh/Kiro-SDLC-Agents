/**
 * KSA-159: Git Service — wraps git log for file history.
 */
import { GitCommit } from './types.js';
export declare class GitService {
    private workspaceRoot;
    constructor(workspaceRoot: string);
    /** Get recent commit history for a file. */
    getFileHistory(filePath: string, limit?: number): GitCommit[];
    /** Check if git is available in the workspace. */
    isAvailable(): boolean;
}
