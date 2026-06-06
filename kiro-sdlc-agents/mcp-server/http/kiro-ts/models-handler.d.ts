/**
 * Models Handler — KSA-237 (Adapter Pattern)
 * Handler for GET /v1/models — lists available models in Anthropic format.
 *
 * Auth is relaxed like the gateway: valid Kiro SSO -> Kiro models; a real
 * `sk-ant-` key -> Anthropic passthrough models; no key on localhost -> still
 * served (Kiro models if SSO present, else Anthropic fallback list).
 */
import * as http from 'http';
/**
 * Handle GET /v1/models (also accepts the `/anthropic` prefix, stripped by the
 * router). Returns true if the request was handled, false if route didn't match.
 */
export declare function handleModelsRoute(req: http.IncomingMessage, res: http.ServerResponse): boolean;
//# sourceMappingURL=models-handler.d.ts.map