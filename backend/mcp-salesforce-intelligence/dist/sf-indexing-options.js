"use strict";
/**
 * KSA-191: SFDX-specific indexing configuration.
 * Provides options for how the indexer should handle SFDX project scanning.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSfIndexingOptions = buildSfIndexingOptions;
const sf_metadata_types_js_1 = require("./sf-metadata-types.js");
/**
 * Build SFDX indexing options from a detected project.
 * @param projectRoot - SFDX project root directory
 * @param packageDirectories - directories from sfdx-project.json
 */
function buildSfIndexingOptions(projectRoot, packageDirectories) {
    return {
        isSfdx: true,
        packageDirectories: packageDirectories.length > 0 ? packageDirectories : ['force-app'],
        projectRoot,
        includeTypes: [
            sf_metadata_types_js_1.SfMetadataType.ApexClass,
            sf_metadata_types_js_1.SfMetadataType.ApexTrigger,
            sf_metadata_types_js_1.SfMetadataType.Flow,
            sf_metadata_types_js_1.SfMetadataType.CustomObject,
            sf_metadata_types_js_1.SfMetadataType.CustomField,
            sf_metadata_types_js_1.SfMetadataType.LwcComponent,
            sf_metadata_types_js_1.SfMetadataType.AuraComponent,
        ],
        excludePatterns: [
            '**/node_modules/**',
            '**/.sfdx/**',
            '**/.sf/**',
        ],
    };
}
//# sourceMappingURL=sf-indexing-options.js.map