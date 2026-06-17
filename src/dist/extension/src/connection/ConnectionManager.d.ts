/**
 * ConnectionManager — manages Backend connection lifecycle.
 * Implements TDD §5.3 IConnectionManager and §5.5 State Machine.
 */
import * as vscode from 'vscode';
import { ConnectionState } from '../types/connection';
import { BackendConfiguration } from '../types/config';
import { HttpClient } from '../proxy/HttpClient';
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
    private readonly backendProcess;
    private readonly client;
    private readonly config;
    private reconnectTimer;
    private readonly outputChannel;
    get state(): ConnectionState;
    constructor(config: BackendConfiguration, outputChannel: vscode.OutputChannel);
    connect(): Promise<void>;
    disconnect(): void;
    onStateChange(listener: (state: ConnectionState) => void): vscode.Disposable;
    getHttpClient(): HttpClient;
    isConnected(): boolean;
    dispose(): void;
    private waitForHealthy;
    private startHealthPolling;
    private handleHealthSuccess;
    private scheduleReconnect;
    private cancelReconnect;
    private transitionTo;
    private log;
    private sleep;
}
//# sourceMappingURL=ConnectionManager.d.ts.map