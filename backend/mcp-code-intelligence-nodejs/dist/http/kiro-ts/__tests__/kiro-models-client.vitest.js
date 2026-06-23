"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const vitest_1 = require("vitest");
const kiro_models_client_js_1 = require("../kiro-models-client.js");
const kiro_adapter_js_1 = require("../adapters/kiro-adapter.js");
const kiro_converter_js_1 = require("../kiro-converter.js");
(0, vitest_1.describe)('mapKiroApiModels', () => {
    (0, vitest_1.it)('maps modelId/modelName to the Anthropic model shape', () => {
        const payload = {
            defaultModel: { modelId: 'auto', modelName: 'Auto' },
            models: [
                { modelId: 'claude-sonnet-4.5', modelName: 'Claude Sonnet 4.5' },
                { modelId: 'deepseek-3.2', modelName: 'Deepseek v3.2' },
            ],
        };
        const models = (0, kiro_models_client_js_1.mapKiroApiModels)(payload);
        (0, vitest_1.expect)(models).toEqual([
            { type: 'model', id: 'claude-sonnet-4.5', display_name: 'Claude Sonnet 4.5' },
            { type: 'model', id: 'deepseek-3.2', display_name: 'Deepseek v3.2' },
        ]);
    });
    (0, vitest_1.it)('falls back to id when modelName is missing', () => {
        const models = (0, kiro_models_client_js_1.mapKiroApiModels)({ models: [{ modelId: 'glm-5' }] });
        (0, vitest_1.expect)(models).toEqual([{ type: 'model', id: 'glm-5', display_name: 'glm-5' }]);
    });
    (0, vitest_1.it)('filters entries without a usable modelId', () => {
        const models = (0, kiro_models_client_js_1.mapKiroApiModels)({
            models: [{ modelName: 'No Id' }, { modelId: '  ' }, { modelId: 'qwen3-coder-next', modelName: 'Qwen3 Coder Next' }],
        });
        (0, vitest_1.expect)(models.map((m) => m.id)).toEqual(['qwen3-coder-next']);
    });
    (0, vitest_1.it)('returns an empty array for a malformed payload', () => {
        (0, vitest_1.expect)((0, kiro_models_client_js_1.mapKiroApiModels)({})).toEqual([]);
        (0, vitest_1.expect)((0, kiro_models_client_js_1.mapKiroApiModels)({ models: undefined })).toEqual([]);
    });
    (0, vitest_1.it)('every real Kiro model id maps via the converter (gateway-acceptable)', () => {
        // The real ListAvailableModels ids must all resolve in mapModel so the
        // chat backend accepts whatever /v1/models surfaces.
        const realIds = [
            'auto', 'claude-opus-4.8', 'claude-opus-4.7', 'claude-opus-4.6',
            'claude-sonnet-4.6', 'claude-opus-4.5', 'claude-sonnet-4.5',
            'claude-sonnet-4', 'claude-haiku-4.5', 'deepseek-3.2',
            'minimax-m2.5', 'minimax-m2.1', 'glm-5', 'qwen3-coder-next',
        ];
        for (const id of realIds) {
            (0, vitest_1.expect)((0, kiro_converter_js_1.mapModel)(id)).not.toBeNull();
        }
    });
});
(0, vitest_1.describe)('KiroAdapter.listModels fallback', () => {
    (0, vitest_1.it)('returns the static KIRO_MODELS list when no bearer token is present', async () => {
        // No bearerToken -> the adapter must NOT attempt a live call and return the
        // static fallback list (every entry has type/id/display_name).
        const adapter = new kiro_adapter_js_1.KiroAdapter({ mode: 'kiro' });
        const models = await adapter.listModels();
        (0, vitest_1.expect)(models.length).toBeGreaterThan(0);
        for (const m of models) {
            (0, vitest_1.expect)(m.type).toBe('model');
            (0, vitest_1.expect)(typeof m.id).toBe('string');
            (0, vitest_1.expect)(m.id.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(typeof m.display_name).toBe('string');
            (0, vitest_1.expect)(m.created_at).toBeDefined();
        }
    });
});
//# sourceMappingURL=kiro-models-client.vitest.js.map