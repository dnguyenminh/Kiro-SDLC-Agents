/**
 * KSA-155: File Resolver - resolves import paths to indexed file paths.
 * Handles relative imports, bare specifiers, and extension resolution.
 */
import Database from 'better-sqlite3';
export declare class FileResolver {
    private indexedFiles;
    private workspaceRoot;
    private static readonly EXTENSIONS;
    private static readonly STDLIB_MODULES;
    constructor(db: Database.Database, workspaceRoot: string);
    private loadIndexedFiles;
    /** Resolve an input file path to a canonical indexed path. */
    resolveFile(input: string): string | null;
    /** Resolve an import target relative to a source file. */
    resolveImportTarget(sourceFile: string, target: string): string | null;
    /** Check if a target is an external (non-project) dependency. */
    isExternal(target: string): boolean;
    /** Refresh the indexed files set (call after re-indexing). */
    refresh(db: Database.Database): void;
    private findWithExtensions;
}
//# sourceMappingURL=file-resolver.d.ts.map