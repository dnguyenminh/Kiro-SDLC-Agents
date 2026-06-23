import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { ModuleRegistry } from '../modules/ModuleRegistry.js';
import type { Logger } from 'pino';
export declare function getMcpServer(registry: ModuleRegistry, logger: Logger): Server;
export declare function broadcastNotification(method: string, params?: any): void;
export declare function registerTransport(transport: any): void;
