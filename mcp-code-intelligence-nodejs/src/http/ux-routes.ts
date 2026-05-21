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
    if (path === '/recommendations') return handleRecommendations(url, res, db);
    if (path === '/graph/analysis') return handleGraphAnalysis(res, db);
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

function sendJson(res: http.ServerResponse, data: unknown): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res: http.ServerResponse, code: number, message: string): void {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}
