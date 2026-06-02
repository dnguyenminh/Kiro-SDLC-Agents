/**
 * Unit tests for SfdxDetector.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SfdxDetector } from '../../src/shared/sfdx-detector.js';

// Mock fs module
vi.mock('fs');

describe('SfdxDetector', () => {
  let detector: SfdxDetector;

  beforeEach(() => {
    detector = new SfdxDetector();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isValidSfdxProject', () => {
    it('should return true when sfdx-project.json exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      expect(detector.isValidSfdxProject('/path/to/project')).toBe(true);
    });

    it('should return false when sfdx-project.json does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(detector.isValidSfdxProject('/path/to/project')).toBe(false);
    });
  });

  describe('getPackageDirectories', () => {
    it('should extract paths from packageDirectories array', () => {
      const config = {
        packageDirectories: [
          { path: 'force-app', default: true },
          { path: 'src-app' },
        ],
      };
      expect(detector.getPackageDirectories(config)).toEqual(['force-app', 'src-app']);
    });

    it('should default to force-app when config is null', () => {
      expect(detector.getPackageDirectories(null)).toEqual(['force-app']);
    });

    it('should default to force-app when packageDirectories is not an array', () => {
      expect(detector.getPackageDirectories({ packageDirectories: 'invalid' })).toEqual(['force-app']);
    });

    it('should handle string entries in packageDirectories', () => {
      const config = { packageDirectories: ['force-app', 'unpackaged'] };
      const result = detector.getPackageDirectories(config);
      expect(result).toContain('force-app');
    });
  });

  describe('detect', () => {
    it('should detect SFDX project at root', () => {
      vi.mocked(fs.existsSync).mockImplementation((p: any) => {
        return String(p).endsWith('sfdx-project.json');
      });
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        packageDirectories: [{ path: 'force-app', default: true }],
        namespace: '',
        sourceApiVersion: '58.0',
      }));

      const result = detector.detect('/workspace');
      expect(result).not.toBeNull();
      expect(result!.root).toBe('/workspace');
      expect(result!.packageDirectories).toContain('force-app');
    });

    it('should return null when no SFDX project found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readdirSync).mockReturnValue([]);

      const result = detector.detect('/workspace');
      expect(result).toBeNull();
    });
  });
});
