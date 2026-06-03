/**
 * SHA-256 file hashing for incremental indexing.
 */
export declare class FileHasher {
    /** Compute SHA-256 hash of a file */
    hashFile(filePath: string): string;
    /** Compute SHA-256 hash of string content */
    hashContent(content: string): string;
}
//# sourceMappingURL=file-hasher.d.ts.map