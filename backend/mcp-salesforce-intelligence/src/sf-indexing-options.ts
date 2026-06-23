/**
 * KSA-191: SFDX-specific indexing configuration.
 * Provides options for how the indexer should handle SFDX project scanning.
 */

import { SfMetadataType } from './sf-metadata-types.js';

/**
 * SFDX indexing statistics returned after an index run.
 */
export interface SfdxStats {
  detected: boolean;
  projectRoot: string | null;
  packageDirectories: string[];
  stats: {
    apex_classes: number;
    apex_triggers: number;
    flows: number;
    objects: number;
    lwc_components: number;
  };
  lastIndexed: string | null;
  relationships: Record<string, number>;
}

/**
 * Options controlling how the indexer handles SFDX files.
 */
export interface SfIndexingOptions {
  /** Whether SFDX project was detected. */
  isSfdx: boolean;
  /** Package directories to scan (from sfdx-project.json). */
  packageDirectories: string[];
  /** Project root path. */
  projectRoot: string;
  /** Metadata types to include. Defaults to all. */
  includeTypes: SfMetadataType[];
  /** File patterns to exclude from SF indexing. */
  excludePatterns: string[];
}

/**
 * Build SFDX indexing options from a detected project.
 * @param projectRoot - SFDX project root directory
 * @param packageDirectories - directories from sfdx-project.json
 */
export function buildSfIndexingOptions(
  projectRoot: string,
  packageDirectories: string[],
): SfIndexingOptions {
  return {
    isSfdx: true,
    packageDirectories: packageDirectories.length > 0 ? packageDirectories : ['force-app'],
    projectRoot,
    includeTypes: [
      SfMetadataType.ApexClass,
      SfMetadataType.ApexTrigger,
      SfMetadataType.Flow,
      SfMetadataType.CustomObject,
      SfMetadataType.CustomField,
      SfMetadataType.LwcComponent,
      SfMetadataType.AuraComponent,
    ],
    excludePatterns: [
      '**/node_modules/**',
      '**/.sfdx/**',
      '**/.sf/**',
    ],
  };
}
