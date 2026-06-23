/**
 * KSA-162: Main Function Detector — Detects main() entry points.
 */
export class MainDetector {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    /** Detect main entry points from source code. */
    detect(symbols, source, language) {
        const mainPattern = this.registry.getMainPattern(language);
        if (!mainPattern)
            return [];
        const results = [];
        // Check for main function in symbols
        for (const sym of symbols) {
            if (sym.name === 'main' || sym.name === '__main__') {
                results.push(this.createEntryPoint(sym));
            }
        }
        // Check source for language-specific main patterns
        if (results.length === 0 && source.includes(mainPattern.pattern)) {
            const lines = source.split('\n');
            const patternLine = lines.findIndex(l => l.includes(mainPattern.pattern));
            if (patternLine >= 0) {
                const closest = symbols.reduce((best, sym) => {
                    if (!best)
                        return sym;
                    const bestDist = Math.abs(best.startLine - patternLine);
                    const symDist = Math.abs(sym.startLine - patternLine);
                    return symDist < bestDist ? sym : best;
                }, null);
                if (closest) {
                    results.push(this.createEntryPoint(closest));
                }
            }
        }
        return results;
    }
    createEntryPoint(sym) {
        return {
            symbol_id: sym.id, symbol_name: sym.name,
            file_path: sym.filePath, start_line: sym.startLine,
            entry_type: 'MAIN', framework: null,
            http_method: null, route_path: null, full_route: null,
            middleware: [], has_auth: false, controller: null,
            event_name: null, confidence: 'High',
        };
    }
}
//# sourceMappingURL=MainDetector.js.map