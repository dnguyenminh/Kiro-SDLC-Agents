/**
 * Config routes — /api/config/* endpoints.
 * Implements TDD §3.3 Configuration APIs.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { ConfigModule } from '../../modules/config/ConfigModule';
import { getAuthPayload } from '../middleware/auth-guard';

const McpServerConfigSchema = z.object({
  jira: z.object({
    url: z.string().url(),
    username: z.string().min(1),
    token: z.string().min(10).optional(),
    project_key: z.string().optional(),
  }).optional(),
  drawio: z.object({
    path: z.string().optional(),
    format: z.string().optional(),
  }).optional(),
  export: z.object({
    output_dir: z.string().optional(),
  }).optional(),
});

const TestConnectionSchema = z.object({
  server: z.enum(['jira', 'drawio', 'export']),
});

export function createConfigRoute(configModule: ConfigModule): Hono {
  const app = new Hono();

  app.get('/api/config/mcp-servers', (c) => {
    const { userId } = getAuthPayload(c);
    const config = configModule.configService.getConfig(userId);
    return c.json(config, 200);
  });

  app.put('/api/config/mcp-servers', async (c) => {
    const { userId } = getAuthPayload(c);
    const body = await c.req.json();
    const parsed = McpServerConfigSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid configuration.', details: parsed.error.flatten() },
      }, 400);
    }

    const updatedAt = configModule.configService.saveConfig(userId, parsed.data);
    return c.json({ message: 'Configuration saved', updated_at: updatedAt }, 200);
  });

  app.post('/api/config/mcp-servers/test', async (c) => {
    const { userId } = getAuthPayload(c);
    const body = await c.req.json();
    const parsed = TestConnectionSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input.' } }, 400);
    }

    const result = await configModule.configService.testConnection(userId, parsed.data.server);
    return c.json(result, 200);
  });

  return app;
}
