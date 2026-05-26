"""
KSA-178: Grammar Registry — Manages tree-sitter grammar loading and caching.
Maps file extensions to language parsers, lazy-loads grammars on first use.
Port of mcp-code-intelligence-nodejs/src/parsers/grammar-registry.ts.
"""

from __future__ import annotations

import importlib
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from tree_sitter import Language, Parser

from .types import ILanguageParser


@dataclass
class LanguageConfig:
    id: str
    extensions: list[str]
    grammar_path: str  # Path to .so/.dll shared library
    parser_module: str  # Python module path for the language parser class


@dataclass
class GrammarRegistryConfig:
    languages: list[LanguageConfig] = field(default_factory=list)
    grammar_dir: str = ""


class GrammarRegistry:
    """Manages tree-sitter grammar loading and language parser instantiation."""

    def __init__(self, config: GrammarRegistryConfig) -> None:
        self._config = config
        self._parsers: dict[str, Parser] = {}
        self._language_parsers: dict[str, ILanguageParser] = {}
        self._extension_map: dict[str, str] = {}
        self._unavailable: set[str] = set()
        self._initialized = False
        self._build_extension_map()

    def initialize(self) -> None:
        """Initialize tree-sitter runtime. Must be called before parsing."""
        if self._initialized:
            return
        self._initialized = True

    def get_parser(self, file_path: str) -> ILanguageParser | None:
        """Get a parser for a file path based on extension. Returns None if unsupported."""
        if not self._initialized:
            self.initialize()

        ext = os.path.splitext(file_path)[1].lower()
        lang_id = self._extension_map.get(ext)

        if not lang_id or lang_id in self._unavailable:
            return None

        if lang_id in self._language_parsers:
            return self._language_parsers[lang_id]

        return self._load_parser(lang_id)

    def get_language_id(self, file_path: str) -> str | None:
        """Get language ID for a file extension."""
        ext = os.path.splitext(file_path)[1].lower()
        return self._extension_map.get(ext)

    def list_languages(self) -> list[dict[str, Any]]:
        """List all registered languages."""
        return [
            {
                "id": lang.id,
                "extensions": lang.extensions,
                "available": lang.id not in self._unavailable,
            }
            for lang in self._config.languages
        ]

    def is_available(self, lang_id: str) -> bool:
        """Check if a language grammar is available."""
        return (
            lang_id not in self._unavailable
            and any(l.id == lang_id for l in self._config.languages)
        )

    def _load_parser(self, lang_id: str) -> ILanguageParser | None:
        lang_config = next(
            (c for c in self._config.languages if c.id == lang_id), None
        )
        if not lang_config:
            return None

        try:
            grammar_path = os.path.join(self._config.grammar_dir, lang_config.grammar_path)

            if not os.path.exists(grammar_path):
                self._unavailable.add(lang_id)
                return None

            language = Language(grammar_path, lang_id)
            parser = Parser()
            parser.set_language(language)
            self._parsers[lang_id] = parser

            # Dynamically import the language parser module
            module = importlib.import_module(lang_config.parser_module)
            parser_class = module.Parser  # Each module exports a Parser class
            lang_parser: ILanguageParser = parser_class(parser, lang_id)
            self._language_parsers[lang_id] = lang_parser

            return lang_parser
        except Exception as e:
            import sys
            print(f"[grammar-registry] Failed to load {lang_id}: {e}", file=sys.stderr)
            self._unavailable.add(lang_id)
            return None

    def _build_extension_map(self) -> None:
        for lang in self._config.languages:
            for ext in lang.extensions:
                self._extension_map[ext] = lang.id


def load_grammar_config(config_path: str) -> GrammarRegistryConfig:
    """Load grammar registry config from JSON file."""
    import json

    with open(config_path, "r") as f:
        data = json.load(f)

    languages = [
        LanguageConfig(
            id=lang["id"],
            extensions=lang["extensions"],
            grammar_path=lang.get("grammarPath", ""),
            parser_module=lang.get("parserModule", ""),
        )
        for lang in data.get("languages", [])
    ]

    return GrammarRegistryConfig(
        languages=languages,
        grammar_dir=str(Path(config_path).parent),
    )
