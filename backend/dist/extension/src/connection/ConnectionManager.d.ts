/**
 * ConnectionManager — manages Remote Backend connection lifecycle.
 * KSA-292: Removed BackendProcess dependency, URL-based, no STARTING state.
 * Implements TDD §4.1 ConnectionManager.
 */
import * as vscode from 'vscode';
import { ConnectionState } from '../types/connection';
import { BackendConfiguration } from '../types/config';
import { HttpClient } from '../proxy/HttpClient';
import { AuthManager } from '../auth/AuthManager';
export interface IConnectionManager {
    readonly state: ConnectionState;
    connect(): Promise<void>;
    disconnect(): void;
    onStateChange(listener: (state: ConnectionState) => void): vscode.Disposable;
}
export declare class ConnectionManager implements IConnectionManager, vscode.Disposable {
    private _state;
    private readonly stateChangeEmitter;
    private readonly healthChecker;
    private readonly client;
    private reconnectTimer;
    private readonly outputChannel;
    get state(): ConnectionState;
    constructor(config: BackendConfiguration, authManager: AuthManager, outputChannel: vscode.OutputChannel);
    connect(): Promise<void>;
    disconnect(): void;
    onStateChange(listener: (state: ConnectionState) => void): vscode.Disposable;
    getHttpClient(): HttpClient;
    isConnected(): boolean;
    dispose(): void;
    private startHealthPolling;
    private handleHealthSuccess;
    private scheduleReconnect;
    private cancelReconnect;
    private transitionTo;
    private log;
}
