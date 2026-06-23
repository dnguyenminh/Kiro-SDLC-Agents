/**
 * SHA-256 file hashing for incremental indexing.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';

export class FileHasher {
  /** Compute SHA-256 hash of a file */
  hashFile(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.hashContent(content);
  }

  /** Compute SHA-256 hash of string content */
  hashContent(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
  }
}
