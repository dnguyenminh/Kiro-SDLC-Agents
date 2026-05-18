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
export function parseMarkdown(text: string, source = ''): ParsedDocument {
  const lines = text.split('\n');
  const title = extractTitle(lines);
  const sections = extractSections(lines);
  const metadata = { source, format: 'markdown' };
  return { title, content: text, sections, metadata };
}

/** Parse plain text (no structure). */
export function parsePlainText(text: string, source = ''): ParsedDocument {
  const metadata = { source, format: 'text' };
  const section: DocumentSection = { heading: 'Content', content: text, level: 1 };
  return { title: source, content: text, sections: [section], metadata };
}

function extractTitle(lines: string[]): string {
  const h1 = lines.find(l => l.startsWith('# '));
  return h1 ? h1.replace(/^# /, '').trim() : 'Untitled';
}

function extractSections(lines: string[]): DocumentSection[] {
  const sections: DocumentSection[] = [];
  let currentHeading = '';
  let currentLevel = 0;
  const contentLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)/);
    if (match) {
      if (contentLines.length > 0 || currentHeading) {
        sections.push({ heading: currentHeading, content: contentLines.join('\n').trim(), level: currentLevel });
        contentLines.length = 0;
      }
      currentLevel = match[1].length;
      currentHeading = match[2];
    } else {
      contentLines.push(line);
    }
  }
  if (contentLines.length > 0 || currentHeading) {
    sections.push({ heading: currentHeading, content: contentLines.join('\n').trim(), level: currentLevel });
  }
  return sections;
}
