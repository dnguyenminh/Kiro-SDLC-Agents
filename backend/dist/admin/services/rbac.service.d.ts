import { AccessGroupWithPermissions, GroupPermission } from '../types/admin.types.js';
export declare class RBACService {
    private db;
    constructor(db: any);
    private rolesTableExists;
    private hasRolesTable;
    listGroups(): AccessGroupWithPermissions[];
    createGroup(name: string, permissions: GroupPermission[]): AccessGroupWithPermissions;
    updateGroup(groupId: string, name: string, permissions: GroupPermission[]): void;
    deleteGroup(groupId: string): void;
    listPermissions(): any[];
    listRoles(groupId: string, permissionId: string): any[];
    createRole(groupId: string, permissionId: string, roleName: string, roleData: any): any;
    updateRole(roleId: string, roleName: string, roleData: any): void;
    deleteRole(roleId: string): void;
}
