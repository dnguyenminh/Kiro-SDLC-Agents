/**
 * KSA-75: File Attachments for knowledge entries.
 */

import * as fs from 'fs';
import * as path from 'path';
import type Database from 'better-sqlite3';

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
  '.pdf': 'application/pdf', '.md': 'text/markdown', '.txt': 'text/plain',
  '.json': 'application/json', '.drawio': 'application/xml',
};

export class AttachmentManager {
  constructor(private readonly db: Database.Database) {}

  execute(args: Record<string, unknown>): string {
    const action = (args.action as string) ?? 'list';

    if (action === 'attach') return this.attach(args);
    if (action === 'remove') return this.remove(args);
    if (action === 'search') return this.searchByType(args);
    return this.listAttachments(args);
  }

  private attach(args: Record<string, unknown>): string {
    const entryId = args.entry_id as number;
    const filePath = args.file_path as string ?? '';
    if (!entryId || !filePath) return 'Error: entry_id and file_path required';
    const desc = args.description as string ?? null;
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_MAP[ext] ?? 'application/octet-stream';
    let fileSize = 0;
    try { fileSize = fs.statSync(filePath).size; } catch { /* file may not exist locally */ }
    const info = this.db.prepare(
      'INSERT INTO entry_attachments (entry_id, file_path, file_name, mime_type, file_size, description) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(entryId, filePath, fileName, mime, fileSize, desc);
    return JSON.stringify({ id: info.lastInsertRowid, entry_id: entryId, file_name: fileName, mime_type: mime });
  }

  private remove(args: Record<string, unknown>): string {
    const attId = args.attachment_id as number;
    if (!attId) return 'Error: attachment_id required';
    this.db.prepare('DELETE FROM entry_attachments WHERE id = ?').run(attId);
    return JSON.stringify({ deleted: attId });
  }

  private searchByType(args: Record<string, unknown>): string {
    const mime = args.mime_prefix as string ?? 'image/';
    const rows = this.db.prepare(
      'SELECT id, entry_id, file_name, mime_type, file_size FROM entry_attachments WHERE mime_type LIKE ? ORDER BY attached_at DESC LIMIT 50'
    ).all(`${mime}%`);
    return JSON.stringify(rows, null, 2);
  }

  private listAttachments(args: Record<string, unknown>): string {
    const entryId = args.entry_id as number;
    if (!entryId) return 'Error: entry_id required for list';
    const rows = this.db.prepare(
      'SELECT id, file_path, file_name, mime_type, file_size, description, attached_at FROM entry_attachments WHERE entry_id = ? ORDER BY attached_at'
    ).all(entryId);
    return JSON.stringify(rows, null, 2);
  }
}
