"""KSA-162: CLI Command Detector."""
from __future__ import annotations
from .. import EntryPoint, EntryType, Confidence, SymbolInput

CLI_PATTERNS = [
    ("commander", ".command("), ("yargs", ".command("),
    ("click", "@click.command"), ("argparse", "add_subparsers"),
    ("cobra", "cobra.Command"), ("clap", "#[command"),
]


class CLIDetector:
    def detect(self, symbols: list[SymbolInput], source: str) -> list[EntryPoint]:
        framework = next((p for p in CLI_PATTERNS if p[0] in source), None)
        if not framework:
            return []
        results = []
        for sym in symbols:
            decs = sym.decorators or []
            is_cli = (any("command" in d or "cli" in d for d in decs) or
                      "command" in sym.name or "cmd" in sym.name or sym.name.startswith("cli_"))
            if is_cli:
                results.append(EntryPoint(
                    symbol_id=sym.id, symbol_name=sym.name,
                    file_path=sym.file_path, start_line=sym.start_line,
                    entry_type=EntryType.CLI_COMMAND, framework=framework[0],
                    event_name=sym.name, confidence=Confidence.Medium,
                ))
        return results
