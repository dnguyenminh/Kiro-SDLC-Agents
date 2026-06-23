import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { FileHasher } from '../../src/shared/file-hasher.js';

describe('FileHasher', () => {
  const hasher = new FileHasher();

  it('should hash content deterministically', () => {
    const hash1 = hasher.hashContent('hello world');
    const hash2 = hasher.hashContent('hello world');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different content', () => {
    const hash1 = hasher.hashContent('hello');
    const hash2 = hasher.hashContent('world');
    expect(hash1).not.toBe(hash2);
  });

  it('should produce 64-char hex string (SHA-256)', () => {
    const hash = hasher.hashContent('test');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('should hash a file', () => {
    const filePath = path.resolve(__dirname, '../fixtures/sfdx-project/sfdx-project.json');
    const hash = hasher.hashFile(filePath);
    expect(hash).toHaveLength(64);
  });
});
