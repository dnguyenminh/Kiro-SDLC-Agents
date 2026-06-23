/**
 * UX enhancement API routes — recommendations, graph analysis, help.
 * Port of Python ux_routes.py.
 */

import * as http from 'http';
import Database from 'better-sqlite3';
import { MemoryEngine } from '../memory/memory-engine.js';
import { RecommendationEngine } from './recommendation-engine.js';
import { GraphAnalyzer } from './graph-analyzer.js';

/** Static help content sections. */
const HELP_SECTIONS: Record<string, { title: string; content: string }> = {
  graph: {
    title: 'Knowledge Graph 3D',
    content: '## Đây là gì?\n\nTrang chủ hiển thị **Knowledge Graph 3D** — trực quan hóa tất cả entries và relationships trong KB.\n\n## Cách sử dụng\n\n- **Xoay**: Kéo chuột trái\n- **Zoom**: Scroll wheel\n- **Click node**: Xem chi tiết entry\n- **Search**: Gõ từ khóa + Enter\n- **Jump to cluster**: Chọn từ dropdown',
  },
  sessions: {
    title: 'Sessions',
    content: '## Sessions là gì?\n\nMỗi session = 1 phiên làm việc của agent. Ghi lại tất cả thao tác: ingest, search, delete.\n\n## Replay\n\nClick session → xem timeline → Play để replay từng event.',
  },
  browser: {
    title: 'Entry Browser',
    content: '## Duyệt Entries\n\nXem tất cả entries trong KB. Lọc theo:\n- **Tier**: WORKING, EPISODIC, SEMANTIC, PROCEDURAL\n- **Type**: DECISION, ARCHITECTURE, REQUIREMENT...\n- **Sort**: Newest, Most accessed, Confidence',
  },
  stream: {
    title: 'Live Stream',
    content: '## Real-time Events\n\nHiển thị events khi chúng xảy ra. Indicator xanh = đang kết nối.\n\n## Controls\n\n- **Pause**: Tạm dừng stream\n- **Sort**: Đổi thứ tự (newest/oldest first)\n- **Clear**: Xóa events hiện tại',
  },
  dashboard: {
    title: 'Health Dashboard',
    content: '## Tổng quan KB\n\nDashboard hiển thị metrics sức khỏe:\n- Tổng entries, edges, vectors\n- Quality score distribution\n- Stale entries cần review\n- Recommendations',
  },
  tags: {
    title: 'Tag Management',
    content: '## Tags\n\nQuản lý taxonomy tags cho entries.\n- Popular tags (sử dụng nhiều nhất)\n- Tag categories\n- Click tag để xem entries liên quan',
  },
  quality: {
    title: 'Quality Scores',
    content: '## Quality Scoring\n\nMỗi entry có quality score 0-100:\n- Content length & structure\n- Tags assigned\n- Relationships count\n- Confidence level\n\nScore < 40 = cần cải thiện.',
  },
  analytics: {
    title: 'Search Analytics',
    content: '## Analytics\n\nPhân tích search patterns:\n- Popular queries\n- Zero-result searches (content gaps)\n- Usage trends over time',
  },
};

/** Handle UX routes. Returns true if handled. */
export function handleUxRoute(
  req: http.IncomingMessage, url: URL, res: http.ServerResponse,
  engine: MemoryEngine | null, db: Database.Database | null
): boolean {
  const path = url.pathname.replace('/api/kb', '');
  const method = req.method ?? 'GET';

  if (method === 'GET') {
    if (path === '/dashboard') return handleDashboard(res, db);
    if (path === '/reminders') return handleReminders(url, res, db);
    if (path === '/recommendations') return handleRecommendations(url, res, db);
    if (path === '/graph/analysis') return handleGraphAnalysis(res, db);
    if (path === '/tags/popular') return handleTagsPopular(url, res, db);
    if (path === '/tags') return handleTagsTaxonomy(res, db);
    if (path === '/analytics') return handleAnalytics(res, db);
    if (path === '/suggestions') return handleSuggestions(url, res, db);
    if (path === '/quality') return handleQuality(res, db);
    if (path === '/quality/low') return handleQualityLow(url, res, db);
    if (path === '/citations/most') return handleCitationsMost(url, res, db);
    const helpMatch = path.match(/^\/help\/(\w+)$/);
    if (helpMatch) return handleHelp(helpMatch[1], res);
  }

  if (method === 'POST') {
    const autoTag = path.match(/^\/entries\/(\d+)\/auto-tag$/);
    if (autoTag) return handleAutoTag(parseInt(autoTag[1], 10), res, engine);
    const findRel = path.match(/^\/entries\/(\d+)\/find-related$/);
    if (findRel) return handleFindRelated(parseInt(findRel[1], 10), res, engine);
    const review = path.match(/^\/entries\/(\d+)\/review$/);
    if (review) return handleMarkReviewed(parseInt(review[1], 10), res, db);
  }

  return false;
}

function handleDashboard(res: http.ServerResponse, db: Database.Database | null): boolean {
  if (!db) { sendError(res, 503, 'Engine not initialized'); return true; }
  try {
    const totalEntries = (db.prepare("SELECT COUNT(*) as cnt FROM knowledge_entries").get() as any)?.cnt ?? 0;
    const qualityAvg = (db.prepare("SELECT AVG(confidence) as avg FROM knowledge_entries").get() as any)?.avg ?? 0;

    // Stale: entries not updated in 90+ days
    const staleCount = (db.prepare(
      "SELECT COUNT(*) as cnt FROM knowledge_entries WHERE updated_at < datetime('now', '-90 days')"
    ).get() as any)?.cnt ?? 0;

    // Unowned: entries without source
    const unownedCount = (db.prepare(
      "SELECT COUNT(*) as cnt FROM knowledge_entries WHERE source IS NULL OR source = ''"
    ).get() as any)?.cnt ?? 0;

    // Health score: weighted formula
    const qualityScore = Math.min(qualityAvg, 100);
    const staleRatio = totalEntries > 0 ? (1 - staleCount / totalEntries) * 100 : 0;
    const ownedRatio = totalEntries > 0 ? (1 - unownedCount / totalEntries) * 100 : 0;
    const healthScore = totalEntries === 0 ? 0 :
      Math.round(qualityScore * 0.4 + staleRatio * 0.3 + ownedRatio * 0.3);

    // Recommendations
    const recEngine = new RecommendationEngine(db);
    const recResult = recEngine.getRecommendations(5);
    const recommendations = Array.isArray(recResult) ? recResult : (recResult.recommendations || []);

    // Trends (last 7 days)
    const searchVolume: { date: string; count: number }[] = [];
    const ingestVolume: { date: string; count: number }[] = [];
    try {
      const searchRows = db.prepare(
        "SELECT DATE(searched_at) as date, COUNT(*) as count FROM search_log WHERE searched_at >= datetime('now', '-7 days') GROUP BY DATE(searched_at) ORDER BY date"
      ).all() as any[];
      searchRows.forEach(r => searchVolume.push({ date: r.date, count: r.count }));

      const ingestRows = db.prepare(
        "SELECT DATE(created_at) as date, COUNT(*) as count FROM memory_audit WHERE operation = 'INGEST' AND created_at >= datetime('now', '-7 days') GROUP BY DATE(created_at) ORDER BY date"
      ).all() as any[];
      ingestRows.forEach(r => ingestVolume.push({ date: r.date, count: r.count }));
    } catch { /* tables may not exist */ }

    sendJson(res, {
      health_score: healthScore,
      total_entries: totalEntries,
      quality_avg: qualityScore,
      stale_count: staleCount,
      unowned_count: unownedCount,
      recommendations,
      trends: { search_volume: searchVolume, ingest_volume: ingestVolume },
    });
  } catch (e: unknown) {
    sendError(res, 500, e instanceof Error ? e.message : 'Unknown error');
  }
  return true;
}

function handleReminders(url: URL, res: http.ServerResponse, db: Database.Database | null): boolean {
  if (!db) { sendError(res, 503, 'Engine not initialized'); return true; }
  try {
    const limit = parseInt(url.searchParams.get('limit') ?? '10', 10);
    // Entries not updated in 90+ days, ordered by staleness
    const rows = db.prepare(
      `SELECT id, summary, updated_at,
        CAST(julianday('now') - julianday(updated_at) AS INTEGER) as days_overdue
       FROM knowledge_entries
       WHERE updated_at < datetime('now', '-90 days')
       ORDER BY updated_at ASC
       LIMIT ?`
    ).all(limit) as any[];

    const entries = rows.map(r => ({
      id: r.id,
      summary: r.summary,
      last_reviewed: r.updated_at,
      days_overdue: r.days_overdue,
    }));
    sendJson(res, entries);
  } catch (e: unknown) {
    sendError(res, 500, e instanceof Error ? e.message : 'Unknown error');
  }
  return true;
}

function handleRecommendations(url: URL, res: http.ServerResponse, db: Database.Database | null): boolean {
  if (!db) { sendError(res, 503, 'Engine not initialized'); return true; }
  const limit = parseInt(url.searchParams.get('limit') ?? '10', 10);
  const engine = new RecommendationEngine(db);
  sendJson(res, engine.getRecommendations(limit));
  return true;
}

function handleGraphAnalysis(res: http.ServerResponse, db: Database.Database | null): boolean {
  if (!db) { sendError(res, 503, 'Engine not initialized'); return true; }
  const analyzer = new GraphAnalyzer(db);
  sendJson(res, analyzer.analyze());
  return true;
}

function handleHelp(section: string, res: http.ServerResponse): boolean {
  const content = HELP_SECTIONS[section];
  if (!content) { sendError(res, 404, `Section '${section}' not found`); return true; }
  sendJson(res, content);
  return true;
}

function handleAutoTag(entryId: number, res: http.ServerResponse, engine: MemoryEngine | null): boolean {
  if (!engine) { sendError(res, 503, 'Engine not initialized'); return true; }
  sendJson(res, { status: 'ok', entry_id: entryId, tags_added: [] });
  return true;
}

function handleFindRelated(entryId: number, res: http.ServerResponse, engine: MemoryEngine | null): boolean {
  if (!engine) { sendError(res, 503, 'Engine not initialized'); return true; }
  sendJson(res, { status: 'ok', entry_id: entryId, related: [] });
  return true;
}

function handleMarkReviewed(entryId: number, res: http.ServerResponse, db: Database.Database | null): boolean {
  if (!db) { sendError(res, 503, 'Engine not initialized'); return true; }
  try {
    db.prepare("UPDATE knowledge_entries SET updated_at = datetime('now') WHERE id = ?").run(entryId);
    sendJson(res, { status: 'ok', entry_id: entryId });
  } catch (e: unknown) {
    sendError(res, 500, e instanceof Error ? e.message : 'Unknown error');
  }
  return true;
}

function handleTagsPopular(url: URL, res: http.ServerResponse, db: Database.Database | null): boolean {
  if (!db) { sendError(res, 503, 'Engine not initialized'); return true; }
  try {
    const limit = parseInt(url.searchParams.get('limit') ?? '30', 10);
    // Tags are stored as comma-separated in knowledge_entries.tags column
    // We need to split and count them
    const rows = db.prepare(
      "SELECT tags FROM knowledge_entries WHERE tags IS NOT NULL AND tags != ''"
    ).all() as any[];

    const tagCounts: Record<string, number> = {};
    for (const row of rows) {
      const tags = (row.tags as string).split(',').map(t => t.trim()).filter(t => t);
      for (const tag of tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    const sorted = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, usage_count: count }));

    sendJson(res, sorted);
  } catch (e: unknown) {
    sendError(res, 500, e instanceof Error ? e.message : 'Unknown error');
  }
  return true;
}

function handleTagsTaxonomy(res: http.ServerResponse, db: Database.Database | null): boolean {
  if (!db) { sendError(res, 503, 'Engine not initialized'); return true; }
  try {
    // Check if tag_taxonomy table exists
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tag_taxonomy'"
    ).get();

    if (tableExists) {
      const rows = db.prepare(
        "SELECT id, tag, category, parent_tag FROM tag_taxonomy ORDER BY category, tag"
      ).all() as any[];
      const categories: Record<string, string[]> = {};
      for (const row of rows) {
        const cat = row.category || 'uncategorized';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(row.tag);
      }
      sendJson(res, { categories });
    } else {
      // Derive categories from entry types
      const rows = db.prepare(
        "SELECT tags FROM knowledge_entries WHERE tags IS NOT NULL AND tags != ''"
      ).all() as any[];

      const tagCounts: Record<string, number> = {};
      for (const row of rows) {
        const tags = (row.tags as string).split(',').map(t => t.trim()).filter(t => t);
        for (const tag of tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }

      // Group by first character or common prefixes
      const categories: Record<string, string[]> = {};
      for (const tag of Object.keys(tagCounts).sort()) {
        const cat = tag.includes(':') ? tag.split(':')[0] : 'general';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(tag);
      }
      sendJson(res, { categories });
    }
  } catch (e: unknown) {
    sendError(res, 500, e instanceof Error ? e.message : 'Unknown error');
  }
  return true;
}

function handleAnalytics(res: http.ServerResponse, db: Database.Database | null): boolean {
  if (!db) { sendError(res, 503, 'Engine not initialized'); return true; }
  try {
    const popular_queries: { query: string; count: number; avg_results: number }[] = [];
    const zero_results: { query: string; count: number }[] = [];
    const search_trend: { date: string; count: number }[] = [];

    // Check if search_log table exists (actual table name)
    const searchLogTable = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='search_log'"
    ).get();

    if (searchLogTable) {
      const popRows = db.prepare(
        "SELECT query, COUNT(*) as count, AVG(result_count) as avg_results FROM search_log GROUP BY query ORDER BY count DESC LIMIT 15"
      ).all() as any[];
      popRows.forEach(r => popular_queries.push({ query: r.query, count: r.count, avg_results: Math.round(r.avg_results || 0) }));

      const gapRows = db.prepare(
        "SELECT query, COUNT(*) as count FROM search_log WHERE result_count = 0 GROUP BY query ORDER BY count DESC LIMIT 15"
      ).all() as any[];
      gapRows.forEach(r => zero_results.push({ query: r.query, count: r.count }));

      const trendRows = db.prepare(
        "SELECT DATE(searched_at) as date, COUNT(*) as count FROM search_log WHERE searched_at >= datetime('now', '-30 days') GROUP BY DATE(searched_at) ORDER BY date"
      ).all() as any[];
      trendRows.forEach(r => search_trend.push({ date: r.date, count: r.count }));
    } else {
      // Fallback: use memory_audit for search operations
      try {
        const auditTable = db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='memory_audit'"
        ).get();
        if (auditTable) {
          const popRows = db.prepare(
            "SELECT details as query, COUNT(*) as count FROM memory_audit WHERE operation = 'SEARCH' AND details IS NOT NULL GROUP BY details ORDER BY count DESC LIMIT 15"
          ).all() as any[];
          popRows.forEach(r => popular_queries.push({ query: r.query, count: r.count, avg_results: 0 }));

          const trendRows = db.prepare(
            "SELECT DATE(created_at) as date, COUNT(*) as count FROM memory_audit WHERE operation = 'SEARCH' AND created_at >= datetime('now', '-30 days') GROUP BY DATE(created_at) ORDER BY date"
          ).all() as any[];
          trendRows.forEach(r => search_trend.push({ date: r.date, count: r.count }));
        }
      } catch { /* table may not exist */ }
    }

    sendJson(res, { popular_queries, zero_results, search_trend });
  } catch (e: unknown) {
    sendError(res, 500, e instanceof Error ? e.message : 'Unknown error');
  }
  return true;
}

function handleSuggestions(url: URL, res: http.ServerResponse, db: Database.Database | null): boolean {
  if (!db) { sendError(res, 503, 'Engine not initialized'); return true; }
  try {
    const q = url.searchParams.get('q') ?? '';
    const limit = parseInt(url.searchParams.get('limit') ?? '8', 10);
    if (!q) { sendJson(res, []); return true; }

    // Search entries by summary matching the query
    const rows = db.prepare(
      "SELECT id, summary, type FROM knowledge_entries WHERE summary LIKE ? LIMIT ?"
    ).all(`%${q}%`, limit) as any[];

    sendJson(res, rows.map(r => ({ id: r.id, summary: r.summary, type: r.type })));
  } catch (e: unknown) {
    sendError(res, 500, e instanceof Error ? e.message : 'Unknown error');
  }
  return true;
}

function handleQuality(res: http.ServerResponse, db: Database.Database | null): boolean {
  if (!db) { sendError(res, 503, 'Engine not initialized'); return true; }
  try {
    const totalEntries = (db.prepare("SELECT COUNT(*) as cnt FROM knowledge_entries").get() as any)?.cnt ?? 0;

    // Check if quality_scores table exists
    const qTable = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='quality_scores'"
    ).get();

    let avgScore = 0, scoredCount = 0, highCount = 0, lowCount = 0;
    const distribution: Record<string, number> = {};

    if (qTable) {
      avgScore = (db.prepare("SELECT AVG(total_score) as avg FROM quality_scores").get() as any)?.avg ?? 0;
      scoredCount = (db.prepare("SELECT COUNT(*) as cnt FROM quality_scores").get() as any)?.cnt ?? 0;
      highCount = (db.prepare("SELECT COUNT(*) as cnt FROM quality_scores WHERE total_score >= 70").get() as any)?.cnt ?? 0;
      lowCount = (db.prepare("SELECT COUNT(*) as cnt FROM quality_scores WHERE total_score < 40").get() as any)?.cnt ?? 0;

      // Distribution in buckets of 10
      const distRows = db.prepare(
        "SELECT CAST(total_score / 10 AS INTEGER) * 10 as bucket, COUNT(*) as cnt FROM quality_scores GROUP BY bucket ORDER BY bucket"
      ).all() as any[];
      distRows.forEach(r => { distribution[String(r.bucket)] = r.cnt; });
    } else {
      // Fallback: compute quality from entry metadata
      // Score based on: has tags (+20), has source (+20), content length (+30), confidence (+30)
      const rows = db.prepare(
        "SELECT id, tags, source, content, confidence FROM knowledge_entries"
      ).all() as any[];

      const scores: number[] = [];
      for (const row of rows) {
        let score = 0;
        if (row.tags && row.tags.trim()) score += 20;
        if (row.source && row.source.trim()) score += 20;
        const contentLen = (row.content || '').length;
        score += Math.min(30, Math.floor(contentLen / 50) * 5);
        score += Math.min(30, (row.confidence || 0) * 30);
        scores.push(score);
      }

      scoredCount = scores.length;
      avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      highCount = scores.filter(s => s >= 70).length;
      lowCount = scores.filter(s => s < 40).length;

      // Distribution
      for (const s of scores) {
        const bucket = String(Math.floor(s / 10) * 10);
        distribution[bucket] = (distribution[bucket] || 0) + 1;
      }
    }

    sendJson(res, {
      average_score: avgScore,
      scored_count: scoredCount,
      high_count: highCount,
      low_count: lowCount,
      total_entries: totalEntries,
      distribution,
    });
  } catch (e: unknown) {
    sendError(res, 500, e instanceof Error ? e.message : 'Unknown error');
  }
  return true;
}

function handleQualityLow(url: URL, res: http.ServerResponse, db: Database.Database | null): boolean {
  if (!db) { sendError(res, 503, 'Engine not initialized'); return true; }
  try {
    const threshold = parseInt(url.searchParams.get('threshold') ?? '40', 10);
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);

    const qTable = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='quality_scores'"
    ).get();

    if (qTable) {
      const rows = db.prepare(
        "SELECT q.entry_id as id, q.total_score as score, e.summary, e.type FROM quality_scores q JOIN knowledge_entries e ON q.entry_id = e.id WHERE q.total_score < ? ORDER BY q.total_score ASC LIMIT ?"
      ).all(threshold, limit) as any[];
      sendJson(res, rows.map(r => ({ id: r.id, summary: r.summary, type: r.type, quality_score: r.score })));
    } else {
      // Compute on-the-fly
      const rows = db.prepare(
        "SELECT id, summary, type, tags, source, content, confidence FROM knowledge_entries LIMIT 500"
      ).all() as any[];

      const scored = rows.map(row => {
        let score = 0;
        if (row.tags && row.tags.trim()) score += 20;
        if (row.source && row.source.trim()) score += 20;
        const contentLen = (row.content || '').length;
        score += Math.min(30, Math.floor(contentLen / 50) * 5);
        score += Math.min(30, (row.confidence || 0) * 30);
        return { id: row.id, summary: row.summary, type: row.type, quality_score: score };
      });

      const low = scored.filter(e => e.quality_score < threshold)
        .sort((a, b) => a.quality_score - b.quality_score)
        .slice(0, limit);
      sendJson(res, low);
    }
  } catch (e: unknown) {
    sendError(res, 500, e instanceof Error ? e.message : 'Unknown error');
  }
  return true;
}

function handleCitationsMost(url: URL, res: http.ServerResponse, db: Database.Database | null): boolean {
  if (!db) { sendError(res, 503, 'Engine not initialized'); return true; }
  try {
    const limit = parseInt(url.searchParams.get('limit') ?? '10', 10);

    const citTable = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='citations'"
    ).get();

    if (citTable) {
      const rows = db.prepare(
        "SELECT c.entry_id, COUNT(*) as citation_count, e.summary FROM citations c JOIN knowledge_entries e ON c.entry_id = e.id GROUP BY c.entry_id ORDER BY citation_count DESC LIMIT ?"
      ).all(limit) as any[];
      sendJson(res, rows.map(r => ({ id: r.entry_id, summary: r.summary, citation_count: r.citation_count })));
    } else {
      // No citations table — use access_count as proxy
      const rows = db.prepare(
        "SELECT id, summary, access_count FROM knowledge_entries WHERE access_count > 0 ORDER BY access_count DESC LIMIT ?"
      ).all(limit) as any[];
      sendJson(res, rows.map(r => ({ id: r.id, summary: r.summary, citation_count: r.access_count })));
    }
  } catch (e: unknown) {
    sendError(res, 500, e instanceof Error ? e.message : 'Unknown error');
  }
  return true;
}

function sendJson(res: http.ServerResponse, data: unknown): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res: http.ServerResponse, code: number, message: string): void {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}
