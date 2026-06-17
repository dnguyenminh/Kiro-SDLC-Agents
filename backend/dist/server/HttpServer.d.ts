/**
 * Hono HTTP server setup with all routes and middleware.
 * Implements: UC-2, UC-7, BR-35, BR-37
 */
import { Hono } from 'hono';
import type { Logger } from 'pino';
import type { ModuleRegistry } from '../modules/ModuleRegistry.js';
export interface HttpServerOptions {
    port: number;
    host: string;
    logger: Logger;
    registry: ModuleRegistry;
    version: string;
}
export declare class HttpServer {
    private options;
    private app;
    private server;
    private logger;
    private port;
    private host;
    private _isRunning;
    constructor(options: HttpServerOptions);
    private createApp;
    start(): Promise<void>;
    stop(): Promise<void>;
    get isRunning(): boolean;
    get honoApp(): Hono;
}
