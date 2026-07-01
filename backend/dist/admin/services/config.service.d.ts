import { ConfigEntry, ConfigHistoryEntry, ConfigUpdateResult } from '../types/admin.types.js';
export declare class ConfigService {
    private db;
    private runtime;
    constructor(db: any);
    getAll(sections?: string[]): ConfigEntry[];
    update(section: string, key: string, newValue: any, userId: string): ConfigUpdateResult;
    getHistory(limit?: number): ConfigHistoryEntry[];
    get(section: string, key: string): any;
}
