/**
 * TerminalProvider — Terminal output capture
 * KSA-252
 */

interface ExtensionContext {
  getTerminalOutput(lines?: number): string;
}

export class TerminalProvider {
  private context: ExtensionContext;

  constructor(context: ExtensionContext) {
    this.context = context;
  }

  getOutput(lines?: number): string {
    try {
      return this.context.getTerminalOutput(lines || 100);
    } catch {
      return '[No terminal output available]';
    }
  }
}
