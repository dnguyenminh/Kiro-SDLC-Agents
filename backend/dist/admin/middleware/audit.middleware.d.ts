import { Request, Response, NextFunction } from 'express';
export interface AuditDeps {
    recordAudit: (entry: {
        userId: string;
        username: string;
        action: string;
        resource: string;
        resourceId?: string;
        changes?: any;
        ipAddress?: string;
    }) => Promise<void>;
}
export declare function createAuditMiddleware(deps: AuditDeps): (req: Request, res: Response, next: NextFunction) => void;
