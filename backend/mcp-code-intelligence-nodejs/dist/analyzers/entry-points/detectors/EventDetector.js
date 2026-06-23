"use strict";
/**
 * KSA-162: Event/MQ/Scheduled Handler Detector.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventDetector = void 0;
const EVENT_INDICATORS = [
    { pattern: '@EventHandler', type: 'EVENT_HANDLER' },
    { pattern: '@Scheduled', type: 'SCHEDULED' },
    { pattern: '@Cron', type: 'SCHEDULED' },
    { pattern: 'on_event', type: 'EVENT_HANDLER' },
    { pattern: '.on(', type: 'EVENT_HANDLER' },
    { pattern: '.subscribe(', type: 'EVENT_HANDLER' },
    { pattern: '@RabbitListener', type: 'EVENT_HANDLER' },
    { pattern: '@KafkaListener', type: 'EVENT_HANDLER' },
    { pattern: '@SqsListener', type: 'EVENT_HANDLER' },
    { pattern: 'setInterval', type: 'SCHEDULED' },
    { pattern: 'cron.schedule', type: 'SCHEDULED' },
];
class EventDetector {
    /** Detect event/scheduled handlers. */
    detect(symbols, source) {
        const results = [];
        for (const sym of symbols) {
            const decorators = sym.decorators ?? [];
            const symContext = this.getContext(source, sym.startLine);
            for (const indicator of EVENT_INDICATORS) {
                const found = decorators.some(d => d.includes(indicator.pattern)) ||
                    symContext.includes(indicator.pattern);
                if (found) {
                    const eventName = this.extractEventName(decorators, symContext, indicator.pattern);
                    results.push({
                        symbol_id: sym.id, symbol_name: sym.name,
                        file_path: sym.filePath, start_line: sym.startLine,
                        entry_type: indicator.type, framework: null,
                        http_method: null, route_path: null, full_route: null,
                        middleware: [], has_auth: false, controller: null,
                        event_name: eventName ?? sym.name, confidence: 'Medium',
                    });
                    break; // One entry per symbol
                }
            }
        }
        return results;
    }
    extractEventName(decorators, context, pattern) {
        for (const dec of decorators) {
            if (dec.includes(pattern)) {
                const match = dec.match(/['"`]([^'"`]+)['"`]/);
                if (match)
                    return match[1];
            }
        }
        const idx = context.indexOf(pattern);
        if (idx >= 0) {
            const after = context.slice(idx + pattern.length);
            const match = after.match(/['"`]([^'"`]+)['"`]/);
            if (match)
                return match[1];
        }
        return null;
    }
    getContext(source, startLine) {
        const lines = source.split('\n');
        const start = Math.max(0, startLine - 2);
        const end = Math.min(lines.length, startLine + 3);
        return lines.slice(start, end).join('\n');
    }
}
exports.EventDetector = EventDetector;
//# sourceMappingURL=EventDetector.js.map