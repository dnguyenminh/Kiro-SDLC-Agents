/**
 * SFDX project detection utility.
 * Detects sfdx-project.json and resolves package directories.
 */
import type { SfdxProject } from './types.js';
export declare class SfdxDetector {
    /**
     * Detect SFDX project at given path.
     * Checks for sfdx-project.json at root and one level deep.
     */
    detect(searchPath: string): SfdxProject | null;
    /**
     * Check if path contains a valid SFDX project.
     */
    isValidSfdxProject(projectPath: string): boolean;
    /**
     * Extract package directories from sfdx-project.json config.
     */
    getPackageDirectories(config: any): string[];
    private buildProject;
}
//# sourceMappingURL=sfdx-detector.d.ts.map