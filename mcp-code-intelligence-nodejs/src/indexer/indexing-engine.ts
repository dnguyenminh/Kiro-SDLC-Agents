/**
 * Indexing Engine — Full scan and incremental indexing.
 * Coordinates file scanning, symbol extraction, and database updates.
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import { DatabaseManager } from '../db/database-manager.js';
import { AppConfig } from '../config.js';
import { scanWorkspace, scanSingleFile, ScannedFile } from '../scanner/file-scanner.js';
import { extractSymbols, ExtractedSymbol } from '../scanner/signature-extractor.js';
import { detectPatterns, inferModulePurpose } from '../scanner/pattern-detector.js';
import { FileWatcher } from './file-watcher.js';

export class IndexingEngine {
  private db: Database.Database;
  private config: AppConfig;
  private watcher: FileWatcher | null = null;
  private running = false;
  private indexing = false;

  constructor(dbManager: DatabaseManager, config: AppConfig) {
    this.db = dbManager.getDb();
    this.config = config;
  }

  /** Start background indexing: full scan then watch. */
  async startBackgroundIndexing(): Promise<void> {
    this.running = true;
    await this.runFullIndex();
    this.startWatcher();
  }

  /** Run a full workspace index. */
  async runFullIndex(): Promise<void> {
    if (this.indexing) return;
    this.indexing = true;
    console.error('[indexer] Starting full index...');

    try {
      const files = scanWorkspace(this.config);
      console.error(`[indexer] Found ${files.length} files to index`);
      this.indexFiles(files);
      this.updateModules();
      this.detectAndStorePatterns(new Map());
      console.error('[indexer] Full index complete');
    } finally {
      this.indexing = false;
    }
  }

  /** Index a single file (for incremental updates). */
  indexSingleFile(filePath: string): void {
    const file = scanSingleFile(filePath, this.config.workspace);
    if (!file) return;
    if (this.isFileUnchanged(file)) return;
    this.upsertFile(file);
  }

  /** Remove a file from the index. */
  removeFile(filePath: string): void {
    const relativePath = filePath.replace(/\\/g, '/');
    this.db.prepare('DELETE FROM files WHERE relative_path = ?').run(relativePath);
  }

  /** Check if indexer is currently running. */
  isRunning(): boolean {
    return this.indexing;
  }

  /** Stop the indexer and file watcher. */
  stop(): void {
    this.running = false;
    if (this.watcher) {
      this.watcher.stop();
      this.watcher = null;
    }
  }

  private indexFiles(files: ScannedFile[]): void {
    const insertFile = this.db.prepare(`
      INSERT OR REPLACE INTO files (path, relative_path, language, module, content_hash, size_bytes, line_count, last_indexed)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    const deleteSymbols = this.db.prepare('DELETE FROM symbols WHERE file_id = ?');
    const insertSymbol = this.db.prepare(`
      INSERT INTO symbols (file_id, name, kind, signature, start_line, end_line, parent_symbol, visibility, doc_comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((files: ScannedFile[]) => {
      for (const file of files) {
        if (this.isFileUnchanged(file)) continue;
        const module = detectModule(file.relativePath);
        const info = insertFile.run(
          file.absolutePath, file.relativePath, file.language,
          module, file.contentHash, file.sizeBytes, file.lineCount
        );
        const fileId = info.lastInsertRowid as number;
        deleteSymbols.run(fileId);
        this.indexFileSymbols(file, fileId, insertSymbol);
      }
    });

    transaction(files);
  }

  private indexFileSymbols(
    file: ScannedFile, fileId: number, insertStmt: Database.Statement
  ): void {
    try {
      const content = fs.readFileSync(file.absolutePath, 'utf-8');
      const symbols = extractSymbols(content, file.language);
      for (const sym of symbols) {
        insertStmt.run(
          fileId, sym.name, sym.kind, sym.signature,
          sym.startLine, sym.endLine, sym.parentSymbol,
          sym.visibility, sym.docComment
        );
      }
    } catch (err) {
      console.error(`[indexer] Error indexing ${file.relativePath}:`, err);
    }
  }

  private isFileUnchanged(file: ScannedFile): boolean {
    const row = this.db.prepare(
      'SELECT content_hash FROM files WHERE relative_path = ?'
    ).get(file.relativePath) as { content_hash: string } | undefined;
    return row?.content_hash === file.contentHash;
  }

  private upsertFile(file: ScannedFile): void {
    const module = detectModule(file.relativePath);
    const info = this.db.prepare(`
      INSERT OR REPLACE INTO files (path, relative_path, language, module, content_hash, size_bytes, line_count, last_indexed)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(file.absolutePath, file.relativePath, file.language, module, file.contentHash, file.sizeBytes, file.lineCount);

    const fileId = info.lastInsertRowid as number;
    this.db.prepare('DELETE FROM symbols WHERE file_id = ?').run(fileId);
    const insertSymbol = this.db.prepare(`
      INSERT INTO symbols (file_id, name, kind, signature, start_line, end_line, parent_symbol, visibility, doc_comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.indexFileSymbols(file, fileId, insertSymbol);
  }

  private updateModules(): void {
    this.db.exec('DELETE FROM modules');
    const rows = this.db.prepare(`
      SELECT module, language, COUNT(*) as file_count,
             (SELECT COUNT(*) FROM symbols WHERE file_id IN (SELECT id FROM files WHERE module = f.module)) as symbol_count
      FROM files f
      WHERE module IS NOT NULL
      GROUP BY module
    `).all() as { module: string; language: string; file_count: number; symbol_count: number }[];

    const insert = this.db.prepare(`
      INSERT INTO modules (name, root_path, language, file_count, symbol_count)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const row of rows) {
      insert.run(row.module, row.module, row.language, row.file_count, row.symbol_count);
    }
  }

  private detectAndStorePatterns(moduleImports: Map<string, string[]>): void {
    const startMs = Date.now();
    const modules = this.db.prepare('SELECT name FROM modules').all() as { name: string }[];
    const updateStmt = this.db.prepare(`
      UPDATE modules SET di_style = ?, error_handling = ?, naming_convention = ?,
      logging_framework = ?, testing_framework = ?, purpose = ? WHERE name = ?
    `);

    const transaction = this.db.transaction(() => {
      for (const { name } of modules) {
        try {
          const symbols = this.db.prepare(
            'SELECT name, kind, signature, visibility FROM symbols WHERE file_id IN (SELECT id FROM files WHERE module = ?)'
          ).all(name) as ExtractedSymbol[];
          const classes = symbols.filter(s => s.kind === 'class' || s.kind === 'interface');
          const functions = symbols.filter(s => s.kind === 'function' || s.kind === 'method');
          const imports = moduleImports.get(name) ?? [];
          const patterns = detectPatterns(classes, functions, imports);
          const purpose = inferModulePurpose(name, classes, []);
          updateStmt.run(
            patterns.diStyle, patterns.errorHandling, patterns.naming,
            patterns.logging, patterns.testing, purpose, name
          );
        } catch (err) {
          console.error(`[indexer] Pattern detection failed for ${name}:`, err);
        }
      }
    });
    transaction();
    console.error(`[indexer] Pattern detection: ${Date.now() - startMs}ms`);
  }

  private startWatcher(): void {
    if (!this.config.watchEnabled || !this.running) return;
    this.watcher = new FileWatcher(this.config, (filePath, event) => {
      if (event === 'unlink') {
        this.removeFile(filePath);
      } else {
        this.indexSingleFile(filePath);
      }
    });
    this.watcher.start();
  }
}

function detectModule(relativePath: string): string {
  const parts = relativePath.split('/');
  if (parts.length >= 2 && parts[0] === 'src') return parts[1];
  if (parts.length >= 1) return parts[0];
  return 'root';
}
