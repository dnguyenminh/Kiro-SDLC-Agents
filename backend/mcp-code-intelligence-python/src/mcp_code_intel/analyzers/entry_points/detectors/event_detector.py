"""KSA-162: Event/Scheduled Handler Detector."""
from __future__ import annotations
import re
from .. import EntryPoint, EntryType, Confidence, SymbolInput

EVENT_INDICATORS = [
    ("@EventHandler", EntryType.EVENT_HANDLER), ("@Scheduled", EntryType.SCHEDULED),
    ("@Cron", EntryType.SCHEDULED), ("on_event", EntryType.EVENT_HANDLER),
    (".on(", EntryType.EVENT_HANDLER), (".subscribe(", EntryType.EVENT_HANDLER),
    ("@RabbitListener", EntryType.EVENT_HANDLER), ("@KafkaListener", EntryType.EVENT_HANDLER),
    ("@SqsListener", EntryType.EVENT_HANDLER), ("setInterval", EntryType.SCHEDULED),
    ("cron.schedule", EntryType.SCHEDULED),
]


class EventDetector:
    def detect(self, symbols: list[SymbolInput], source: str) -> list[EntryPoint]:
        results = []
        for sym in symbols:
            decs = sym.decorators or []
            ctx = self._get_context(source, sym.start_line)
            for pattern, entry_type in EVENT_INDICATORS:
                if any(pattern in d for d in decs) or pattern in ctx:
                    event_name = self._extract_event_name(decs, ctx, pattern) or sym.name
                    results.append(EntryPoint(
                        symbol_id=sym.id, symbol_name=sym.name,
                        file_path=sym.file_path, start_line=sym.start_line,
                        entry_type=entry_type, event_name=event_name,
                        confidence=Confidence.Medium,
                    ))
                    break
        return results

    def _extract_event_name(self, decs: list[str], ctx: str, pattern: str) -> str | None:
        for d in decs:
            if pattern in d:
                m = re.search(r"""['"`]([^'"`]+)['"`]""", d)
                if m: return m.group(1)
        idx = ctx.find(pattern)
        if idx >= 0:
            m = re.search(r"""['"`]([^'"`]+)['"`]""", ctx[idx + len(pattern):])
            if m: return m.group(1)
        return None

    def _get_context(self, source: str, start_line: int) -> str:
        lines = source.split("\n")
        return "\n".join(lines[max(0, start_line - 2):min(len(lines), start_line + 3)])
