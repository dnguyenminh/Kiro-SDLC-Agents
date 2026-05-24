"use strict";
/**
 * Document parsing — extracts structured content from various formats.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMarkdown = parseMarkdown;
exports.parsePlainText = parsePlainText;
/** Parse markdown text into structured document. */
function parseMarkdown(text, source = '') {
    const lines = text.split('\n');
    const title = extractTitle(lines);
    const sections = extractSections(lines);
    const metadata = { source, format: 'markdown' };
    return { title, content: text, sections, metadata };
}
/** Parse plain text (no structure). */
function parsePlainText(text, source = '') {
    const metadata = { source, format: 'text' };
    const section = { heading: 'Content', content: text, level: 1 };
    return { title: source, content: text, sections: [section], metadata };
}
function extractTitle(lines) {
    const h1 = lines.find(l => l.startsWith('# '));
    return h1 ? h1.replace(/^# /, '').trim() : 'Untitled';
}
function extractSections(lines) {
    const sections = [];
    let currentHeading = '';
    let currentLevel = 0;
    const contentLines = [];
    for (const line of lines) {
        const match = line.match(/^(#{1,6})\s+(.+)/);
        if (match) {
            if (contentLines.length > 0 || currentHeading) {
                sections.push({ heading: currentHeading, content: contentLines.join('\n').trim(), level: currentLevel });
                contentLines.length = 0;
            }
            currentLevel = match[1].length;
            currentHeading = match[2];
        }
        else {
            contentLines.push(line);
        }
    }
    if (contentLines.length > 0 || currentHeading) {
        sections.push({ heading: currentHeading, content: contentLines.join('\n').trim(), level: currentLevel });
    }
    return sections;
}
//# sourceMappingURL=document-parser.js.map