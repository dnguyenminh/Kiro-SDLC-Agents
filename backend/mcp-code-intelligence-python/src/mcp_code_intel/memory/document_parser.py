"""Document parsing — extracts structured content from various formats."""

import re
from dataclasses import dataclass, field


@dataclass
class DocumentSection:
    """A section within a document."""
    heading: str
    content: str
    level: int


@dataclass
class ParsedDocument:
    """Parsed document with metadata."""
    title: str
    content: str
    sections: list[DocumentSection]
    metadata: dict[str, str] = field(default_factory=dict)


def parse_markdown(text: str, source: str = "") -> ParsedDocument:
    """Parse markdown text into structured document."""
    lines = text.split("\n")
    title = _extract_title(lines)
    sections = _extract_sections(lines)
    metadata = {"source": source, "format": "markdown"}
    return ParsedDocument(title, text, sections, metadata)


def parse_plain_text(text: str, source: str = "") -> ParsedDocument:
    """Parse plain text (no structure)."""
    metadata = {"source": source, "format": "text"}
    section = DocumentSection("Content", text, 1)
    return ParsedDocument(source, text, [section], metadata)


def _extract_title(lines: list[str]) -> str:
    """Extract first H1 heading as title."""
    for line in lines:
        if line.startswith("# "):
            return line.removeprefix("# ").strip()
    return "Untitled"


def _extract_sections(lines: list[str]) -> list[DocumentSection]:
    """Split lines into heading/content sections."""
    sections: list[DocumentSection] = []
    current_heading = ""
    current_level = 0
    content_lines: list[str] = []

    for line in lines:
        match = re.match(r"^(#{1,6})\s+(.+)", line)
        if match:
            if content_lines or current_heading:
                sections.append(DocumentSection(
                    current_heading,
                    "\n".join(content_lines).strip(),
                    current_level,
                ))
                content_lines = []
            current_level = len(match.group(1))
            current_heading = match.group(2)
        else:
            content_lines.append(line)

    if content_lines or current_heading:
        sections.append(DocumentSection(
            current_heading,
            "\n".join(content_lines).strip(),
            current_level,
        ))
    return sections
