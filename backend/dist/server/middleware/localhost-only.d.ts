/**
 * Middleware to reject non-localhost requests.
 * Security: Backend only serves 127.0.0.1 connections (BR-35, BR-37).
 */
import type { MiddlewareHandler } from 'hono';
export declare const localhostOnly: MiddlewareHandler;
