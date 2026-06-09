/**
 * CurrentFileProvider — Active editor file resolution
 * KSA-252
 */

interface ExtensionContext {
  getActiveEditorPath(): string | null;
}

export class CurrentFileProvider {
  private context: ExtensionContext;

  constructor(context: ExtensionContext) {
    this.context = context;
  }

  getFileName(): string | null {
    try {
      return this.context.getActiveEditorPath();
    } catch {
      return null;
    }
  }
}
