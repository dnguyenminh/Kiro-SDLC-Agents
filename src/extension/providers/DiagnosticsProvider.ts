/**
 * DiagnosticsProvider — Problems/diagnostics resolution
 * KSA-252
 */

import type { DiagnosticItem } from '../../shared/protocol';

interface ExtensionContext {
  getDiagnostics(): Array<{ file: string; line: number; severity: string; message: string; source?: string }>;
}

export class DiagnosticsProvider {
  private context: ExtensionContext;

  constructor(context: ExtensionContext) {
    this.context = context;
  }

  getAll(): DiagnosticItem[] {
    try {
      const raw = this.context.getDiagnostics();
      return raw.map(d => ({
        file: d.file,
        line: d.line,
        severity: d.severity as 'error' | 'warning' | 'info',
        message: d.message,
        source: d.source,
      }));
    } catch {
      return [];
    }
  }
}
