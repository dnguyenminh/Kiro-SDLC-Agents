/**
 * UX enhancement API routes — recommendations, graph analysis, help.
 * Port of Python ux_routes.py.
 */
import * as http from 'http';
import Database from 'better-sqlite3';
import { MemoryEngine } from '../memory/memory-engine.js';
/** Handle UX routes. Returns true if handled. */
export declare function handleUxRoute(req: http.IncomingMessage, url: URL, res: http.ServerResponse, engine: MemoryEngine | null, db: Database.Database | null): boolean;
//# sourceMappingURL=ux-routes.d.ts.map