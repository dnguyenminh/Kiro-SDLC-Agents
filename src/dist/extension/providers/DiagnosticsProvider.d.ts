/**
 * DiagnosticsProvider — Problems/diagnostics resolution
 * KSA-252
 */
import type { DiagnosticItem } from '../../shared/protocol';
interface ExtensionContext {
    getDiagnostics(): Array<{
        file: string;
        line: number;
        severity: string;
        message: string;
        source?: string;
    }>;
}
export declare class DiagnosticsProvider {
    private context;
    constructor(context: ExtensionContext);
    getAll(): DiagnosticItem[];
}
export {};
//# sourceMappingURL=DiagnosticsProvider.d.ts.map