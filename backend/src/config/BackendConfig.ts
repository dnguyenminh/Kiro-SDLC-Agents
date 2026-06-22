/**
 * Backend configuration management.
 * Reads from environment variables and config file with sensible defaults.
 */

import { z } from 'zod';

const BackendConfigSchema = z.object({
  port: z.number().min(1024).max(65535).default(48721),
  host: z.string().default('127.0.0.1'),
  dataDir: z.string().default('.code-intel'),
  onnxModelPath: z.string().default('models/model.onnx'),
  sqliteDbPath: z.string().default('index.db'),
  orchestrationConfigPath: z.string().default('orchestration.json'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type BackendConfig = z.infer<typeof BackendConfigSchema>;

export function loadConfig(overrides?: Partial<BackendConfig>): BackendConfig {
  const raw = {
    port: parseInt(process.env.CODE_INTEL_PORT || '48721', 10),
    host: process.env.CODE_INTEL_HOST || '127.0.0.1',
    dataDir: process.env.CODE_INTEL_DATA_DIR || '.code-intel',
    onnxModelPath: process.env.CODE_INTEL_ONNX_MODEL || 'models/model.onnx',
    sqliteDbPath: process.env.CODE_INTEL_DB || 'index-backend.db',
    orchestrationConfigPath: process.env.CODE_INTEL_ORCHESTRATION || 'orchestration.json',
    logLevel: process.env.CODE_INTEL_LOG_LEVEL || 'info',
    ...overrides,
  };

  return BackendConfigSchema.parse(raw);
}
