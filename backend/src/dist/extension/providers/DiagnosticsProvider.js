"use strict";
/**
 * DiagnosticsProvider — Problems/diagnostics resolution
 * KSA-252
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticsProvider = void 0;
class DiagnosticsProvider {
    context;
    constructor(context) {
        this.context = context;
    }
    getAll() {
        try {
            const raw = this.context.getDiagnostics();
            return raw.map(d => ({
                file: d.file,
                line: d.line,
                severity: d.severity,
                message: d.message,
                source: d.source,
            }));
        }
        catch {
            return [];
        }
    }
}
exports.DiagnosticsProvider = DiagnosticsProvider;
//# sourceMappingURL=DiagnosticsProvider.js.map