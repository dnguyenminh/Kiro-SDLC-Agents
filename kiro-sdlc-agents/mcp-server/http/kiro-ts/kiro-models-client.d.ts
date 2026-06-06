/**
 * Kiro Models Client — KSA-237
 *
 * Fetches the REAL list of models available to the logged-in Kiro user from
 * the CodeWhisperer/Q backend, so the gateway `/v1/models` (and therefore the
 * Settings panel + Chat box) shows EXACTLY the same models as Kiro IDE.
 *
 * ── How the endpoint was discovered ────────────────────────────────────────
 * Kiro IDE itself does not expose a public REST `/v1/models`. The chat traffic
 * goes to `q.{region}.amazonaws.com/generateAssistantResponse` (AWS JSON-RPC
 * 1.0 over the `AmazonCodeWhispererService` target). Probing that service for
 * target operations revealed:
 *
 *   X-Amz-Target: AmazonCodeWhispererService.ListAvailableModels
 *   body:         {"origin":"AI_EDITOR"}
 *   -> HTTP 200 { defaultModel: {...}, models: [ { modelId, modelName, ... } ] }
 *
 * (Operations `ListModels` / `ListFoundationModels` return UnknownOperation —
 * only `ListAvailableModels` exists. The previously-used host
 * `kiro.api.{region}.amazonaws.com` does NOT resolve in DNS and is dead.)
 *
 * This call uses the same bearer token + KiroIDE User-Agent headers as
 * generateAssistantResponse, so it succeeds whenever chat succeeds. Empty body
 * is rejected (400 "Improperly formed request"); `{"origin":"AI_EDITOR"}` is
 * required.
 *
 * Network failures, auth failures, or unexpected payloads make the caller fall
 * back to the static KIRO_MODELS list.
 */
import { AnthropicModel } from './adapters/llm-backend-adapter.js';
/** Shape of a single model entry in the ListAvailableModels response. */
interface KiroApiModel {
    modelId?: string;
    modelName?: string;
    description?: string;
}
interface ListAvailableModelsResponse {
    defaultModel?: KiroApiModel;
    models?: KiroApiModel[];
}
/**
 * Call ListAvailableModels against `q.{region}.amazonaws.com` using the Kiro
 * bearer token. Returns the parsed model list mapped to AnthropicModel[], or
 * throws on any network / auth / parse failure so the caller can fall back.
 *
 * @param region      resolved CodeWhisperer API region (from resolveApiRegionAsync)
 * @param bearerToken Kiro SSO access token
 * @param machineId   stable KiroIDE machine id (resolveMachineId)
 */
export declare function fetchKiroModels(region: string, bearerToken: string, machineId: string): Promise<AnthropicModel[]>;
/**
 * Map the CodeWhisperer ListAvailableModels payload to the Anthropic
 * `/v1/models` model shape. Filters out entries without a usable modelId.
 *
 * The synthetic `auto` model (Kiro's task-router) is preserved — Kiro IDE shows
 * it and the gateway/converter accepts it (mapModel falls back gracefully).
 */
export declare function mapKiroApiModels(payload: ListAvailableModelsResponse): AnthropicModel[];
export {};
//# sourceMappingURL=kiro-models-client.d.ts.map