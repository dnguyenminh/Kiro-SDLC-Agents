/**
 * File Scanner — Traverses workspace, respects .gitignore, detects language.
 * Produces a list of scannable files with metadata.
 */
import { AppConfig } from '../config.js';
export interface ScannedFile {
    absolutePath: string;
    relativePath: string;
    language: string;
    contentHash: string;
    sizeBytes: number;
    lineCount: number;
}
/** Scan workspace and return list of indexable files. */
export declare function scanWorkspace(config: AppConfig): ScannedFile[];
/** Scan a single file and return metadata. */
export declare function scanSingleFile(filePath: string, workspace: string): ScannedFile | null;
/** Detect language from file extension. */
export declare function detectLanguage(filePath: string): string | null;
//# sourceMappingURL=file-scanner.d.ts.map