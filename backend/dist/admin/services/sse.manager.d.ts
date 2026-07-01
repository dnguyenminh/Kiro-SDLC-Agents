import { Response } from 'express';
export declare class SSEManager {
    private clients;
    private heartbeatInterval;
    constructor();
    addClient(userId: string, res: Response): void;
    broadcast(event: string, data: any): void;
    sendToUser(userId: string, event: string, data: any): void;
    private heartbeat;
    getClientCount(): number;
    destroy(): void;
}
