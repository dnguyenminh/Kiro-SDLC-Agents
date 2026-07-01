import { Express } from 'express';
export interface AdminModuleDependencies {
    db: any;
    jwtService: {
        validate(token: string): {
            sub: string;
            username: string;
        } | null;
    };
    kbEngine: any;
    mcpOrchestrator: any;
}
export declare function registerAdminModule(app: Express, deps: AdminModuleDependencies): void;
