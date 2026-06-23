/**
 * KSA-191: Salesforce metadata type enum and file-path detection.
 * Used to classify files by their SF metadata type.
 */
/**
 * Salesforce metadata type enum.
 */
export declare enum SfMetadataType {
    ApexClass = "ApexClass",
    ApexTrigger = "ApexTrigger",
    Flow = "Flow",
    CustomObject = "CustomObject",
    CustomField = "CustomField",
    LwcComponent = "LwcComponent",
    AuraComponent = "AuraComponent"
}
/**
 * Map of file extensions/patterns to their metadata type.
 */
export declare const SF_FILE_EXTENSIONS: Record<string, SfMetadataType>;
/**
 * Detect the SF metadata type from a file path.
 * Returns null if the file is not a recognized SF metadata type.
 */
export declare function detectMetadataType(filePath: string): SfMetadataType | null;
/**
 * Get human-readable label for a metadata type.
 */
export declare function getMetadataTypeLabel(type: SfMetadataType): string;
//# sourceMappingURL=sf-metadata-types.d.ts.map