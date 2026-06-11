/**
 * API routes — /api/* for Webview data endpoints.
 * Implements TDD §3.5, FSD §3.5.4.
 */

import { Hono } from 'hono';
import { ModuleRegistry } from '../../modules/ModuleRegistry';

export function createApiRoute(moduleRegistry: ModuleRegistry): Hono {
  const app = new Hono();

  // Dashboard
  app.get('/api/dashboard/summary', (c) => {
    return c.json({
      data: {
        totalEntries: 0,
        recentCount: 0,
        topCategories: [],
        modulesReady: moduleRegistry.isAllReady(),
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/dashboard/recent', (c) => {
    return c.json({
      data: { items: [] },
      timestamp: new Date().toISOString(),
    });
  });

  // KB Graph
  app.get('/api/kb/graph', (c) => {
    return c.json({
      data: { nodes: [], edges: [] },
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/kb/graph/node/:id', (c) => {
    const id = c.req.param('id');
    return c.json({
      data: { id, title: '', content: '', tags: [] },
      timestamp: new Date().toISOString(),
    });
  });

  // Analytics
  app.get('/api/analytics/overview', (c) => {
    return c.json({
      data: { totalQueries: 0, avgLatency: 0, topTools: [] },
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/analytics/timeline', (c) => {
    return c.json({
      data: { points: [] },
      timestamp: new Date().toISOString(),
    });
  });

  // Tags
  app.get('/api/tags/list', (c) => {
    return c.json({
      data: { tags: [] },
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/tags', async (c) => {
    const body = await c.req.json<{ name: string }>();
    return c.json({
      data: { id: crypto.randomUUID(), name: body.name, createdAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    }, 201);
  });

  app.put('/api/tags/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<{ name: string }>();
    return c.json({
      data: { id, name: body.name, updatedAt: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    });
  });

  app.delete('/api/tags/:id', (c) => {
    return c.json({
      data: { deleted: true },
      timestamp: new Date().toISOString(),
    });
  });

  // Quality
  app.get('/api/quality/scores', (c) => {
    return c.json({
      data: { scores: [] },
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/quality/summary', (c) => {
    return c.json({
      data: { averageScore: 0, totalEntries: 0, distribution: {} },
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
