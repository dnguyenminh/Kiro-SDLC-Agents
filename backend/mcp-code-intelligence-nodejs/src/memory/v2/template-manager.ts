/**
 * KSA-73: Template Enforcement Engine.
 */

import type Database from 'better-sqlite3';

export class TemplateManager {
  constructor(private readonly db: Database.Database) {}

  execute(args: Record<string, unknown>): string {
    const action = (args.action as string) ?? 'list';

    if (action === 'create') return this.createTemplate(args);
    if (action === 'validate') return this.validateEntry(args);
    return JSON.stringify(this.listTemplates(), null, 2);
  }

  private createTemplate(args: Record<string, unknown>): string {
    const name = args.name as string ?? '';
    const type = args.type as string ?? '';
    const sectionsStr = args.required_sections as string ?? '';
    if (!name || !type) return 'Error: name and type required';
    const sections = sectionsStr.split(',').map(s => s.trim()).filter(Boolean);
    const schema = JSON.stringify({ required_sections: sections });
    this.db.prepare(
      'INSERT OR REPLACE INTO content_templates (name, type, schema_json, required_sections) VALUES (?, ?, ?, ?)'
    ).run(name, type, schema, sectionsStr);
    return JSON.stringify({ created: name, type, required_sections: sections });
  }

  private validateEntry(args: Record<string, unknown>): string {
    const entryId = args.entry_id as number;
    if (!entryId) return 'Error: entry_id required for validate';
    const entry = this.db.prepare('SELECT * FROM knowledge_entries WHERE id = ?').get(entryId) as any;
    if (!entry) return `Error: entry ${entryId} not found`;
    const template = this.db.prepare('SELECT * FROM content_templates WHERE type = ?').get(entry.type) as any;
    if (!template) return JSON.stringify({ entry_id: entryId, valid: true, message: 'No template for type' });

    const sections = (template.required_sections as string).split(',').map((s: string) => s.trim()).filter(Boolean);
    const violations = sections.filter(s => !entry.content.toLowerCase().includes(s.toLowerCase()));
    const isValid = violations.length === 0;
    this.db.prepare('INSERT OR REPLACE INTO template_validations (entry_id, template_id, is_valid, violations) VALUES (?, ?, ?, ?)').run(entryId, template.id, isValid ? 1 : 0, JSON.stringify(violations));
    return JSON.stringify({ entry_id: entryId, valid: isValid, violations, template: template.name });
  }

  private listTemplates(): object[] {
    return this.db.prepare('SELECT id, name, type, required_sections, created_at FROM content_templates ORDER BY name').all() as object[];
  }
}
