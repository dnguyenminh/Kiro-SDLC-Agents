/**
 * kiro-ts Module Entry Point — KSA-237
 * Re-exports route handlers for integration into http-entry.js.
 */

export { handleChatRoute, sendError } from './chat-handler.js';
export { handleModelsRoute } from './models-handler.js';
export { checkHealth } from './health-checker.js';
export { selectAdapter, buildModelsListResponse, KiroAdapter, KIRO_MODELS, AnthropicPassthroughAdapter, ANTHROPIC_FALLBACK_MODELS, fetchAnthropicModels } from './adapters/index.js';
export type { LLMBackendAdapter, AnthropicModel } from './adapters/index.js';
export { resolveAuth, AuthenticationError, setCredentialPathOverride, initializeAuth, getPrivateApiKey, getGatewayApiKey, hasValidCredentials, resolveApiRegion, resolveApiRegionAsync, invalidateApiRegionCache, discoverKiroTokenPath, getActiveTokenPath, ensureFreshKiroToken, buildKiroAuthResult, RefreshTokenExpiredError, TokenRefreshError } from './auth-resolver.js';
export type { KiroSSOToken } from './auth-resolver.js';
export { refreshToken, refreshSocialToken, refreshIdcToken, isTokenExpired, isTokenExpiringSoon, isIdcToken, resolveAuthRegion } from './token-refresh.js';
export { KIRO_VERSION, NODE_VERSION, AWS_SDK_VERSION, systemVersion } from './kiro-config.js';
export { signRequest } from './sigv4-signer.js';
export { validateRequest } from './request-validator.js';
export { ConversationStore, ConversationSession, ToolIdMismatchError } from './conversation-store.js';
export { formatSSEEvent, writeSSEHeaders, proxyStream, proxyNonStreaming } from './stream-proxy.js';
export { convertRequest, mapModel, ConversionError } from './kiro-converter.js';
export { fetchKiroModels, mapKiroApiModels } from './kiro-models-client.js';
export { EventStreamDecoder, parseFrame, crc32 } from './event-stream-parser.js';
export { KiroStreamConverter } from './kiro-stream.js';
export { resolveMachineId, normalizeMachineId, deriveMachineId } from './machine-id.js';
export type { AuthResult, AWSCredentials, HealthStatus, AnthropicRequest, SSEEvent } from './types.js';
