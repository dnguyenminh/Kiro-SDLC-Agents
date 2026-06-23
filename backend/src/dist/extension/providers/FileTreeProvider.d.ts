/**
 * FileTreeProvider — Workspace file and folder tree resolution
 * KSA-252
 */
import type { FileTreeNode, FolderTreeNode } from '../../shared/protocol';
export declare class FileTreeProvider {
    private workspaceRoot;
    constructor(workspaceRoot: string);
    getTree(maxDepth?: number): Promise<FileTreeNode[]>;
    getFolderTree(maxDepth?: number): Promise<FolderTreeNode[]>;
    readFiles(relativePaths: string[]): Promise<{
        path: string;
        content: string;
    }[]>;
    listFolder(folderPath: string): Promise<string[]>;
    private scanDir;
    private scanFolders;
}
//# sourceMappingURL=FileTreeProvider.d.ts.map