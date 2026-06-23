/**
 * Document parsing — extracts structured content from various formats.
 */
/** A section within a document. */
export interface DocumentSection {
    heading: string;
    content: string;
    level: number;
}
/** Parsed document with metadata. */
export interface ParsedDocument {
    title: string;
    content: string;
    sections: DocumentSection[];
    metadata: Record<string, string>;
}
/** Parse markdown text into structured document. */
export declare function parseMarkdown(text: string, source?: string): ParsedDocument;
/** Parse plain text (no structure). */
export declare function parsePlainText(text: string, source?: string): ParsedDocument;
//# sourceMappingURL=document-parser.d.ts.map