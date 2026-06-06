/**
 * Kiro Models Client Tests — KSA-237
 *
 * Covers the REAL Kiro model-list integration:
 *  - mapKiroApiModels: maps the CodeWhisperer ListAvailableModels payload to
 *    the Anthropic /v1/models shape, filtering invalid entries.
 *  - KiroAdapter.listModels: falls back to the static KIRO_MODELS list when no
 *    bearer token is available (no live call attempted).
 *
 * Maps to STC: UT (model listing), IT-04 (model availability).
 */
import { describe, it, expect } from 'vitest';

import { mapKiroApiModels } from '../kiro-models-client.js';
import { KiroAdapter } from '../adapters/kiro-adapter.js';
import { mapModel } from '../kiro-converter.js';

describe('mapKiroApiModels', () => {
  it('maps modelId/modelName to the Anthropic model shape', () => {
    const payload = {
      defaultModel: { modelId: 'auto', modelName: 'Auto' },
      models: [
        { modelId: 'claude-sonnet-4.5', modelName: 'Claude Sonnet 4.5' },
        { modelId: 'deepseek-3.2', modelName: 'Deepseek v3.2' },
      ],
    };
    const models = mapKiroApiModels(payload);
    expect(models).toEqual([
      { type: 'model', id: 'claude-sonnet-4.5', display_name: 'Claude Sonnet 4.5' },
      { type: 'model', id: 'deepseek-3.2', display_name: 'Deepseek v3.2' },
    ]);
  });

  it('falls back to id when modelName is missing', () => {
    const models = mapKiroApiModels({ models: [{ modelId: 'glm-5' }] });
    expect(models).toEqual([{ type: 'model', id: 'glm-5', display_name: 'glm-5' }]);
  });

  it('filters entries without a usable modelId', () => {
    const models = mapKiroApiModels({
      models: [{ modelName: 'No Id' }, { modelId: '  ' }, { modelId: 'qwen3-coder-next', modelName: 'Qwen3 Coder Next' }],
    });
    expect(models.map((m) => m.id)).toEqual(['qwen3-coder-next']);
  });

  it('returns an empty array for a malformed payload', () => {
    expect(mapKiroApiModels({} as any)).toEqual([]);
    expect(mapKiroApiModels({ models: undefined } as any)).toEqual([]);
  });

  it('every real Kiro model id maps via the converter (gateway-acceptable)', () => {
    // The real ListAvailableModels ids must all resolve in mapModel so the
    // chat backend accepts whatever /v1/models surfaces.
    const realIds = [
      'auto', 'claude-opus-4.8', 'claude-opus-4.7', 'claude-opus-4.6',
      'claude-sonnet-4.6', 'claude-opus-4.5', 'claude-sonnet-4.5',
      'claude-sonnet-4', 'claude-haiku-4.5', 'deepseek-3.2',
      'minimax-m2.5', 'minimax-m2.1', 'glm-5', 'qwen3-coder-next',
    ];
    for (const id of realIds) {
      expect(mapModel(id)).not.toBeNull();
    }
  });
});

describe('KiroAdapter.listModels fallback', () => {
  it('returns the static KIRO_MODELS list when no bearer token is present', async () => {
    // No bearerToken -> the adapter must NOT attempt a live call and return the
    // static fallback list (every entry has type/id/display_name).
    const adapter = new KiroAdapter({ mode: 'kiro' });
    const models = await adapter.listModels();
    expect(models.length).toBeGreaterThan(0);
    for (const m of models) {
      expect(m.type).toBe('model');
      expect(typeof m.id).toBe('string');
      expect(m.id.length).toBeGreaterThan(0);
      expect(typeof m.display_name).toBe('string');
      expect(m.created_at).toBeDefined();
    }
  });
});
