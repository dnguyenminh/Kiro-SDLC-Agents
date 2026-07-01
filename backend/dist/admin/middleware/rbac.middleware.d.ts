import { Request, Response, NextFunction } from 'express';
import { GroupPermission } from '../types/admin.types.js';
export declare function invalidateRBACCache(userId?: string): void;
export interface RBACDeps {
    getUserPermissions: (userId: string) => Promise<GroupPermission[] | null>;
    getUserStatus: (userId: string) => Promise<string | null>;
}
export declare function createRBACMiddleware(deps: RBACDeps): (req: Request, res: Response, next: NextFunction) => Promise<void>;
