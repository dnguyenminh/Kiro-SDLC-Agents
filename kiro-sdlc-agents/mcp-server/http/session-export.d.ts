/**
 * Session export handler — generates markdown from session events.
 */
import * as http from 'http';
import { MemoryEngine } from '../memory/memory-engine.js';
/** Export session as markdown grouped by task. */
export declare function handleSessionExport(path: string, res: http.ServerResponse, engine: MemoryEngine | null): void;
//# sourceMappingURL=session-export.d.ts.map