"use strict";
/**
 * KSA-191: Salesforce metadata type enum and file-path detection.
 * Used to classify files by their SF metadata type.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SF_FILE_EXTENSIONS = exports.SfMetadataType = void 0;
exports.detectMetadataType = detectMetadataType;
exports.getMetadataTypeLabel = getMetadataTypeLabel;
/**
 * Salesforce metadata type enum.
 */
var SfMetadataType;
(function (SfMetadataType) {
    SfMetadataType["ApexClass"] = "ApexClass";
    SfMetadataType["ApexTrigger"] = "ApexTrigger";
    SfMetadataType["Flow"] = "Flow";
    SfMetadataType["CustomObject"] = "CustomObject";
    SfMetadataType["CustomField"] = "CustomField";
    SfMetadataType["LwcComponent"] = "LwcComponent";
    SfMetadataType["AuraComponent"] = "AuraComponent";
})(SfMetadataType || (exports.SfMetadataType = SfMetadataType = {}));
/**
 * Map of file extensions/patterns to their metadata type.
 */
exports.SF_FILE_EXTENSIONS = {
    '.cls': SfMetadataType.ApexClass,
    '.trigger': SfMetadataType.ApexTrigger,
    '.flow-meta.xml': SfMetadataType.Flow,
    '.object-meta.xml': SfMetadataType.CustomObject,
    '.field-meta.xml': SfMetadataType.CustomField,
    '.js-meta.xml': SfMetadataType.LwcComponent,
    '.component-meta.xml': SfMetadataType.AuraComponent,
};
/**
 * Detect the SF metadata type from a file path.
 * Returns null if the file is not a recognized SF metadata type.
 */
function detectMetadataType(filePath) {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    // Check compound extensions first (most specific)
    for (const [ext, type] of Object.entries(exports.SF_FILE_EXTENSIONS)) {
        if (ext.includes('-meta.xml') && normalized.endsWith(ext)) {
            return type;
        }
    }
    // Check simple extensions
    if (normalized.endsWith('.cls'))
        return SfMetadataType.ApexClass;
    if (normalized.endsWith('.trigger'))
        return SfMetadataType.ApexTrigger;
    // Path-based detection for LWC/Aura (when .js file inside lwc/ or aura/ dir)
    if (normalized.includes('/lwc/') && normalized.endsWith('.js')) {
        return SfMetadataType.LwcComponent;
    }
    if (normalized.includes('/aura/') && normalized.endsWith('.js')) {
        return SfMetadataType.AuraComponent;
    }
    return null;
}
/**
 * Human-readable labels for metadata types.
 */
const METADATA_LABELS = {
    [SfMetadataType.ApexClass]: 'Apex Class',
    [SfMetadataType.ApexTrigger]: 'Apex Trigger',
    [SfMetadataType.Flow]: 'Flow',
    [SfMetadataType.CustomObject]: 'Custom Object',
    [SfMetadataType.CustomField]: 'Custom Field',
    [SfMetadataType.LwcComponent]: 'Lightning Web Component',
    [SfMetadataType.AuraComponent]: 'Aura Component',
};
/**
 * Get human-readable label for a metadata type.
 */
function getMetadataTypeLabel(type) {
    return METADATA_LABELS[type] ?? type;
}
//# sourceMappingURL=sf-metadata-types.js.map