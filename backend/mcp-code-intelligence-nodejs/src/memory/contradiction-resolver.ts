/**
 * ContradictionResolver — Detects and resolves conflicting information in KB.
 *
 * Implements 3 strategies from Invalid-Info_in-KB.md:
 * 1. Metadata/Status — marks entries as SUPERSEDED when newer info contradicts
 * 2. LLM Consolidation — optional LLM validation before returning results (off if no LLM)
 * 3. Graph SUPERSEDES — creates SUPERSEDES edges in knowledge graph
 *
 * Usage:
 * - On ingest: detectAndResolve(newEntryId) → checks for contradictions
 * - On search: filterSuperseded(results) → removes invalid entries from results
 */

import type Database from 'better-sqlite3';
import type { GraphRepository } from './graph-repo.js';
import type { SearchResult, KnowledgeEntry } from './models.js';

// --- Configuration ---

export interface ContradictionConfig {
  /** Enable strategy 1: metadata status marking */
  enableStatusMarking: boolean;
  /** Enable strategy 2: LLM consolidation on search results */
  enableLlmConsolidation: boolean;
  /** Enable strategy 3: SUPERSEDES graph edges */
  enableGraphSupersedes: boolean;
  /** Similarity threshold for entity overlap detection (0-1) */
  entityOverlapThreshold: number;
  /** LLM endpoint URL (strategy 2 only works if this is set) */
  llmEndpoint?: string;
  /** LLM API key */
  llmApiKey?: string;
  /** LLM model name */
  llmModel?: string;
}

const DEFAULT_CONFIG: ContradictionConfig = {
  enableStatusMarking: true,
  enableLlmConsolidation: false, // Off by default — requires LLM config
  enableGraphSupersedes: true,
  entityOverlapThreshold: 0.5,
};

// --- Contradiction signals (keywords indicating supersession) ---

const SUPERSESSION_SIGNALS = [
  // Vietnamese
  'hủy bỏ', 'hủy', 'bãi bỏ', 'thay thế', 'không còn', 'đã xóa',
  'cập nhật lại', 'sửa lại', 'thay đổi', 'chuyển sang', 'dừng',
  'ngừng', 'loại bỏ', 'deprecated', 'đã cũ', 'không dùng nữa',
  // English
  'cancel', 'cancelled', 'revoke', 'revoked', 'supersede', 'superseded',
  'replace', 'replaced', 'override', 'overridden', 'deprecate',
  'no longer', 'removed', 'deleted', 'instead of', 'changed to',
  'updated to', 'migrated to', 'switched to', 'stop using',
  'do not use', 'obsolete', 'invalid', 'was wrong', 'correction',
];

// --- Types ---

export interface ContradictionDetection {
  newEntryId: number;
  conflictingEntryIds: number[];
  signal: string;
  confidence: number;
}

export interface ResolutionResult {
  detected: ContradictionDetection[];
  resolved: number;
  supersededEntries: number[];
  edgesCreated: number;
}

export interface LlmConsolidationResult {
  originalCount: number;
  filteredCount: number;
  removedIds: number[];
  consolidatedResults: SearchResult[];
}

// --- Main Class ---

export class ContradictionResolver {
  private readonly db: Database.Database;
  private readonly graphRepo: GraphRepository;
  private config: ContradictionConfig;

  constructor(db: Database.Database, graphRepo: GraphRepository, config?: Partial<ContradictionConfig>) {
    this.db = db;
    this.graphRepo = graphRepo;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Strategy 2 auto-disable: if no LLM endpoint configured, disable LLM consolidation
    if (!this.config.llmEndpoint) {
      this.config.enableLlmConsolidation = false;
    }

    this.ensureSchema();
  }

  /** Update configuration at runtime. */
  updateConfig(partial: Partial<ContradictionConfig>): void {
    this.config = { ...this.config, ...partial };
    if (!this.config.llmEndpoint) {
      this.config.enableLlmConsolidation = false;
    }
  }

  /** Get current config (for diagnostics). */
  getConfig(): ContradictionConfig {
    return { ...this.config };
  }

  // =========================================================================
  // STRATEGY 1: Metadata/Status Marking
  // =========================================================================

  /**
   * On ingest: detect if new entry contradicts existing entries.
   * If contradiction found: mark old entries as SUPERSEDED.
   */
  detectAndResolve(newEntryId: number): ResolutionResult {
    const result: ResolutionResult = {
      detected: [],
      resolved: 0,
      supersededEntries: [],
      edgesCreated: 0,
    };

    const newEntry = this.getEntry(newEntryId);
    if (!newEntry) return result;

    // Check if new entry contains supersession signals
    const signal = this.detectSupersessionSignal(newEntry.content);
    if (!signal) return result;

    // Find entries that share entities with this new entry
    const conflicting = this.findConflictingEntries(newEntry, newEntryId);
    if (conflicting.length === 0) return result;

    const detection: ContradictionDetection = {
      newEntryId,
      conflictingEntryIds: conflicting.map(e => e.id),
      signal,
      confidence: this.computeConfidence(newEntry, conflicting, signal),
    };
    result.detected.push(detection);

    // Only resolve if confidence is high enough
    if (detection.confidence >= 0.6) {
      for (const old of conflicting) {
        // Strategy 1: Mark as superseded
        if (this.config.enableStatusMarking) {
          this.markSuperseded(old.id, newEntryId, signal);
          result.supersededEntries.push(old.id);
        }

        // Strategy 3: Create SUPERSEDES edge in graph
        if (this.config.enableGraphSupersedes) {
          if (!this.graphRepo.edgeExists(newEntryId, old.id, 'SUPERSEDES')) {
            this.graphRepo.addEdge({
              source_id: newEntryId,
              target_id: old.id,
              relation: 'SUPERSEDES',
              weight: detection.confidence,
              metadata: JSON.stringify({ signal, detected_at: new Date().toISOString() }),
            });
            result.edgesCreated++;
          }
        }
      }
      result.resolved = conflicting.length;
    }

    // Log detection to audit (even if below threshold — for audit trail)
    this.logResolution(result);

    return result;
  }

  // =========================================================================
  // STRATEGY 2: LLM Consolidation (on search results)
  // =========================================================================

  /**
   * Post-search: consolidate results using LLM to remove contradictions.
   * Returns filtered results. If LLM not configured, returns original results unchanged.
   */
  async consolidateWithLlm(results: SearchResult[], query: string): Promise<LlmConsolidationResult> {
    if (!this.config.enableLlmConsolidation || !this.config.llmEndpoint) {
      return {
        originalCount: results.length,
        filteredCount: results.length,
        removedIds: [],
        consolidatedResults: results,
      };
    }

    try {
      const prompt = this.buildConsolidationPrompt(results, query);
      const llmResponse = await this.callLlm(prompt);
      const invalidIds = this.parseLlmResponse(llmResponse, results);

      const filtered = results.filter(r => !invalidIds.has(r.entry.id));

      return {
        originalCount: results.length,
        filteredCount: filtered.length,
        removedIds: [...invalidIds],
        consolidatedResults: filtered,
      };
    } catch (err) {
      // LLM failure -> return original results (graceful degradation)
      process.stderr.write(`[contradiction] LLM consolidation failed: ${err}\n`);
      return {
        originalCount: results.length,
        filteredCount: results.length,
        removedIds: [],
        consolidatedResults: results,
      };
    }
  }

  // =========================================================================
  // STRATEGY 3: Graph-based SUPERSEDES filtering (on search results)
  // =========================================================================

  /**
   * Post-search: filter out entries that have been superseded via graph edges.
   * An entry is removed if another entry in the result set has a SUPERSEDES edge to it.
   */
  filterSuperseded(results: SearchResult[]): SearchResult[] {
    if (!this.config.enableGraphSupersedes && !this.config.enableStatusMarking) {
      return results;
    }

    const supersededIds = new Set<number>();

    // Check validity_status (Strategy 1)
    if (this.config.enableStatusMarking) {
      for (const r of results) {
        const status = this.getValidityStatus(r.entry.id);
        if (status === 'SUPERSEDED') {
          supersededIds.add(r.entry.id);
        }
      }
    }

    // Check SUPERSEDES edges (Strategy 3)
    if (this.config.enableGraphSupersedes) {
      for (const r of results) {
        const supersedingEdges = this.getSupersedingEdges(r.entry.id);
        if (supersedingEdges.length > 0) {
          // This entry has been superseded by another entry
          // Only filter if the superseding entry is still active
          for (const edge of supersedingEdges) {
            const supersedingStatus = this.getValidityStatus(edge.source_id);
            if (supersedingStatus !== 'SUPERSEDED') {
              supersededIds.add(r.entry.id);
              break;
            }
          }
        }
      }
    }

    return results.filter(r => !supersededIds.has(r.entry.id));
  }

  // =========================================================================
  // Public utility methods
  // =========================================================================

  /** Manually mark an entry as superseded (for API/tool exposure). */
  manualSupersede(oldEntryId: number, newEntryId: number, reason?: string): void {
    this.markSuperseded(oldEntryId, newEntryId, reason ?? 'manual');
    if (this.config.enableGraphSupersedes) {
      if (!this.graphRepo.edgeExists(newEntryId, oldEntryId, 'SUPERSEDES')) {
        this.graphRepo.addEdge({
          source_id: newEntryId,
          target_id: oldEntryId,
          relation: 'SUPERSEDES',
          weight: 1.0,
          metadata: JSON.stringify({ signal: reason ?? 'manual', detected_at: new Date().toISOString() }),
        });
      }
    }
  }

  /** Revalidate an entry (undo supersession). */
  revalidate(entryId: number): void {
    this.db.prepare(
      "UPDATE knowledge_entries SET validity_status = 'ACTIVE', superseded_by = NULL, superseded_at = NULL, updated_at = datetime('now') WHERE id = ?"
    ).run(entryId);
  }

  /** Get contradiction stats for diagnostics. */
  getStats(): { totalSuperseded: number; totalActive: number; supersededEdges: number } {
    const superseded = (this.db.prepare(
      "SELECT COUNT(*) as cnt FROM knowledge_entries WHERE validity_status = 'SUPERSEDED'"
    ).get() as { cnt: number }).cnt;
    const active = (this.db.prepare(
      "SELECT COUNT(*) as cnt FROM knowledge_entries WHERE validity_status = 'ACTIVE' OR validity_status IS NULL"
    ).get() as { cnt: number }).cnt;
    const edges = (this.db.prepare(
      "SELECT COUNT(*) as cnt FROM knowledge_graph_edges WHERE relation = 'SUPERSEDES'"
    ).get() as { cnt: number }).cnt;
    return { totalSuperseded: superseded, totalActive: active, supersededEdges: edges };
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  private ensureSchema(): void {
    // Add validity_status column if not exists
    try {
      this.db.prepare(
        "ALTER TABLE knowledge_entries ADD COLUMN validity_status TEXT DEFAULT 'ACTIVE'"
      ).run();
    } catch { /* column already exists */ }

    try {
      this.db.prepare(
        'ALTER TABLE knowledge_entries ADD COLUMN superseded_by INTEGER DEFAULT NULL'
      ).run();
    } catch { /* column already exists */ }

    try {
      this.db.prepare(
        'ALTER TABLE knowledge_entries ADD COLUMN superseded_at TEXT DEFAULT NULL'
      ).run();
    } catch { /* column already exists */ }

    // Index for fast filtering
    try {
      this.db.prepare(
        'CREATE INDEX IF NOT EXISTS idx_ke_validity ON knowledge_entries(validity_status)'
      ).run();
    } catch { /* index already exists */ }
  }

  private getEntry(id: number): KnowledgeEntry | undefined {
    return this.db.prepare('SELECT * FROM knowledge_entries WHERE id = ?').get(id) as KnowledgeEntry | undefined;
  }

  private detectSupersessionSignal(content: string): string | null {
    const lower = content.toLowerCase();
    for (const signal of SUPERSESSION_SIGNALS) {
      if (lower.includes(signal)) return signal;
    }
    return null;
  }

  private findConflictingEntries(newEntry: KnowledgeEntry, newEntryId: number): KnowledgeEntry[] {
    // Extract entities from the new entry's structured_map
    const newEntities = this.extractEntities(newEntryId);
    if (newEntities.length === 0) {
      // Fallback: use summary/content overlap (FTS match)
      return this.findBySimilarContent(newEntry, newEntryId);
    }

    // Find entries that share entities with the new entry
    const candidates: KnowledgeEntry[] = [];
    for (const entity of newEntities) {
      const rows = this.db.prepare(`
        SELECT DISTINCT ke.* FROM knowledge_entries ke
        JOIN entity_index ei ON ke.id = ei.entry_id
        WHERE ei.entity_name = ? AND ke.id != ?
        AND (ke.validity_status = 'ACTIVE' OR ke.validity_status IS NULL)
        AND ke.archived_at IS NULL
        ORDER BY ke.created_at DESC
        LIMIT 20
      `).all(entity, newEntryId) as KnowledgeEntry[];
      candidates.push(...rows);
    }

    // Deduplicate
    const seen = new Set<number>();
    return candidates.filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }

  private findBySimilarContent(newEntry: KnowledgeEntry, newEntryId: number): KnowledgeEntry[] {
    // Use FTS to find entries with similar summary (top 10, excluding self)
    const sanitized = newEntry.summary.replace(/[^\w\s]/g, ' ').trim().slice(0, 60);
    if (!sanitized) return [];

    try {
      const rows = this.db.prepare(`
        SELECT ke.* FROM knowledge_fts
        JOIN knowledge_entries ke ON knowledge_fts.rowid = ke.id
        WHERE knowledge_fts MATCH ? AND ke.id != ?
        AND (ke.validity_status = 'ACTIVE' OR ke.validity_status IS NULL)
        ORDER BY rank
        LIMIT 10
      `).all(sanitized, newEntryId) as KnowledgeEntry[];
      return rows;
    } catch {
      return [];
    }
  }

  private extractEntities(entryId: number): string[] {
    try {
      const rows = this.db.prepare(
        'SELECT entity_name FROM entity_index WHERE entry_id = ?'
      ).all(entryId) as Array<{ entity_name: string }>;
      return rows.map(r => r.entity_name);
    } catch {
      return [];
    }
  }

  private computeConfidence(
    newEntry: KnowledgeEntry,
    conflicting: KnowledgeEntry[],
    signal: string
  ): number {
    let confidence = 0.5; // base

    // Boost if signal is strong (explicit cancel/replace words)
    const strongSignals = ['hủy bỏ', 'cancel', 'replace', 'supersede', 'deprecated', 'obsolete', 'revoke'];
    if (strongSignals.some(s => signal.includes(s))) {
      confidence += 0.2;
    }

    // Boost if new entry is more recent than all conflicting
    const newDate = new Date(newEntry.created_at).getTime();
    const allOlder = conflicting.every(e => new Date(e.created_at).getTime() < newDate);
    if (allOlder) confidence += 0.15;

    // Boost if same source
    const sameSource = conflicting.some(e => e.source && e.source === newEntry.source);
    if (sameSource) confidence += 0.1;

    // Boost if same type
    const sameType = conflicting.some(e => e.type === newEntry.type);
    if (sameType) confidence += 0.05;

    return Math.min(confidence, 1.0);
  }

  private markSuperseded(oldEntryId: number, newEntryId: number, _signal: string): void {
    this.db.prepare(`
      UPDATE knowledge_entries
      SET validity_status = 'SUPERSEDED', superseded_by = ?, superseded_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(newEntryId, oldEntryId);
  }

  private getValidityStatus(entryId: number): string {
    const row = this.db.prepare(
      'SELECT validity_status FROM knowledge_entries WHERE id = ?'
    ).get(entryId) as { validity_status: string | null } | undefined;
    return row?.validity_status ?? 'ACTIVE';
  }

  private getSupersedingEdges(targetId: number): Array<{ source_id: number }> {
    return this.db.prepare(
      "SELECT source_id FROM knowledge_graph_edges WHERE target_id = ? AND relation = 'SUPERSEDES'"
    ).all(targetId) as Array<{ source_id: number }>;
  }

  private logResolution(result: ResolutionResult): void {
    if (result.detected.length === 0) return;
    try {
      const operation = result.resolved > 0 ? 'CONTRADICTION_RESOLVED' : 'CONTRADICTION_DETECTED';
      this.db.prepare(
        `INSERT INTO memory_audit (operation, details, created_at) VALUES (?, ?, datetime('now'))`
      ).run(operation, JSON.stringify({
        superseded: result.supersededEntries,
        edges_created: result.edgesCreated,
        detections: result.detected.map(d => ({
          new_entry: d.newEntryId,
          signal: d.signal,
          confidence: d.confidence,
          conflicting: d.conflictingEntryIds,
        })),
      }));
    } catch { /* audit must not break resolution */ }
  }

  // --- LLM helpers (Strategy 2) ---

  private buildConsolidationPrompt(results: SearchResult[], query: string): string {
    const entries = results.map(r => (
      `[Entry #${r.entry.id}] (created: ${r.entry.created_at})\n${r.entry.content.slice(0, 300)}`
    )).join('\n---\n');

    return `You are a knowledge base validator. Given the user query and multiple KB entries retrieved, identify any entries that contain OUTDATED, CONTRADICTED, or SUPERSEDED information.

User Query: "${query}"

Retrieved Entries:
${entries}

Instructions:
- Compare entries for contradictions (e.g., "Do X" vs "Cancel X")
- If two entries contradict, the NEWER one (by created_at) is correct
- Return a JSON array of entry IDs that should be REMOVED (the outdated ones)
- If no contradictions, return an empty array []

Response (JSON array of IDs to remove):`;
  }

  private async callLlm(prompt: string): Promise<string> {
    if (!this.config.llmEndpoint) throw new Error('No LLM endpoint configured');

    const response = await fetch(this.config.llmEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.llmApiKey ? { 'Authorization': `Bearer ${this.config.llmApiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.config.llmModel ?? 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 200,
      }),
    });

    if (!response.ok) throw new Error(`LLM API error: ${response.status}`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? '[]';
  }

  private parseLlmResponse(response: string, results: SearchResult[]): Set<number> {
    try {
      // Extract JSON array from response
      const match = response.match(/\[[\d,\s]*\]/);
      if (!match) return new Set();
      const ids = JSON.parse(match[0]) as number[];
      // Validate that IDs are actually in results
      const validIds = new Set(results.map(r => r.entry.id));
      return new Set(ids.filter(id => validIds.has(id)));
    } catch {
      return new Set();
    }
  }
}
