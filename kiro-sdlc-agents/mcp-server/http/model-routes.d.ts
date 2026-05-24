/**
 * HTTP routes for model management — list, download, status, switch.
 */
import * as http from 'http';
import { ModelManager } from '../orchestration/models/model-manager.js';
export declare function handleModelRoute(req: http.IncomingMessage, url: URL, res: http.ServerResponse, modelManager: ModelManager | null): boolean;
//# sourceMappingURL=model-routes.d.ts.map