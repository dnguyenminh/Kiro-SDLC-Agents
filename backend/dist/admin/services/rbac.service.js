// KSA-286: RBAC Service
import { AdminErrorCode } from '../types/admin.types.js';
import { invalidateRBACCache } from '../middleware/rbac.middleware.js';
export class RBACService {
    db;
    constructor(db) {
        this.db = db;
    }
    rolesTableExists = null;
    hasRolesTable() {
        if (this.rolesTableExists === null) {
            const result = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='roles'").get();
            this.rolesTableExists = !!result;
        }
        return this.rolesTableExists;
    }
    listGroups() {
        const groups = this.db.prepare('SELECT * FROM access_groups ORDER BY access_group_name').all();
        const hasRoles = this.hasRolesTable();
        return groups.map((g) => {
            const perms = this.db.prepare('SELECT permission_id, role_data FROM group_permissions WHERE access_group_id = ?').all(g.access_group_id);
            const userCount = this.db.prepare('SELECT COUNT(*) as cnt FROM users WHERE access_group_id = ?').get(g.access_group_id)?.cnt || 0;
            const permissionsWithRoles = perms.map((p) => {
                let roles = [];
                if (hasRoles) {
                    try {
                        roles = this.db.prepare('SELECT role_id, role_name, role_data FROM roles WHERE access_group_id = ? AND permission_id = ?').all(g.access_group_id, p.permission_id);
                    }
                    catch { /* ignore */ }
                }
                return { permissionId: p.permission_id, roleData: JSON.parse(p.role_data || '{}'), roles: roles.map((r) => ({ roleId: r.role_id, roleName: r.role_name, roleData: JSON.parse(r.role_data || '{}') })) };
            });
            return { accessGroupId: g.access_group_id, accessGroupName: g.access_group_name, isSystemGroup: !!g.is_system_group, createdAt: g.created_at, updatedAt: g.updated_at, permissions: permissionsWithRoles, userCount };
        });
    }
    createGroup(name, permissions) {
        if (this.db.prepare('SELECT 1 FROM access_groups WHERE access_group_name = ?').get(name))
            throw { code: AdminErrorCode.VALIDATION_ERROR, message: 'Group name exists' };
        const id = 'grp-' + crypto.randomUUID().slice(0, 8);
        this.db.transaction(() => {
            this.db.prepare('INSERT INTO access_groups (access_group_id, access_group_name) VALUES (?, ?)').run(id, name);
            for (const p of permissions) {
                this.db.prepare('INSERT INTO group_permissions (access_group_id, permission_id, role_data) VALUES (?, ?, ?)').run(id, p.permissionId, JSON.stringify(p.roleData || {}));
            }
        })();
        invalidateRBACCache();
        return { accessGroupId: id, accessGroupName: name, isSystemGroup: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), permissions };
    }
    updateGroup(groupId, name, permissions) {
        const group = this.db.prepare('SELECT * FROM access_groups WHERE access_group_id = ?').get(groupId);
        if (!group)
            throw { code: AdminErrorCode.ENTRY_NOT_FOUND };
        this.db.transaction(() => {
            this.db.prepare("UPDATE access_groups SET access_group_name = ?, updated_at = datetime('now') WHERE access_group_id = ?").run(name, groupId);
            this.db.prepare('DELETE FROM group_permissions WHERE access_group_id = ?').run(groupId);
            for (const p of permissions) {
                this.db.prepare('INSERT INTO group_permissions (access_group_id, permission_id, role_data) VALUES (?, ?, ?)').run(groupId, p.permissionId, JSON.stringify(p.roleData || {}));
            }
        })();
        invalidateRBACCache();
    }
    deleteGroup(groupId) {
        const group = this.db.prepare('SELECT * FROM access_groups WHERE access_group_id = ?').get(groupId);
        if (!group)
            throw { code: AdminErrorCode.ENTRY_NOT_FOUND };
        if (group.is_system_group)
            throw { code: AdminErrorCode.LAST_SYSTEM_OWNER, message: 'Cannot delete System Owner group' };
        const users = this.db.prepare('SELECT COUNT(*) as cnt FROM users WHERE access_group_id = ?').get(groupId)?.cnt || 0;
        if (users > 0)
            throw { code: AdminErrorCode.GROUP_HAS_USERS, message: `Group has ${users} users` };
        this.db.prepare('DELETE FROM access_groups WHERE access_group_id = ?').run(groupId);
        invalidateRBACCache();
    }
    listPermissions() { return this.db.prepare('SELECT * FROM permissions ORDER BY permission_id').all(); }
    // --- Role CRUD ---
    listRoles(groupId, permissionId) {
        return this.db.prepare('SELECT role_id, role_name, role_data, created_at FROM roles WHERE access_group_id = ? AND permission_id = ?').all(groupId, permissionId)
            .map((r) => ({ roleId: r.role_id, roleName: r.role_name, roleData: JSON.parse(r.role_data || '{}'), createdAt: r.created_at }));
    }
    createRole(groupId, permissionId, roleName, roleData) {
        const gp = this.db.prepare('SELECT 1 FROM group_permissions WHERE access_group_id = ? AND permission_id = ?').get(groupId, permissionId);
        if (!gp)
            throw { code: AdminErrorCode.ENTRY_NOT_FOUND, message: 'Group does not have this permission' };
        const roleId = 'role-' + crypto.randomUUID().slice(0, 8);
        this.db.prepare('INSERT INTO roles (role_id, access_group_id, permission_id, role_name, role_data) VALUES (?, ?, ?, ?, ?)').run(roleId, groupId, permissionId, roleName, JSON.stringify(roleData || {}));
        invalidateRBACCache();
        return { roleId, roleName, roleData: roleData || {}, createdAt: new Date().toISOString() };
    }
    updateRole(roleId, roleName, roleData) {
        const role = this.db.prepare('SELECT 1 FROM roles WHERE role_id = ?').get(roleId);
        if (!role)
            throw { code: AdminErrorCode.ENTRY_NOT_FOUND, message: 'Role not found' };
        this.db.prepare('UPDATE roles SET role_name = ?, role_data = ? WHERE role_id = ?').run(roleName, JSON.stringify(roleData || {}), roleId);
        invalidateRBACCache();
    }
    deleteRole(roleId) {
        const role = this.db.prepare('SELECT 1 FROM roles WHERE role_id = ?').get(roleId);
        if (!role)
            throw { code: AdminErrorCode.ENTRY_NOT_FOUND, message: 'Role not found' };
        this.db.prepare('DELETE FROM roles WHERE role_id = ?').run(roleId);
        invalidateRBACCache();
    }
}
//# sourceMappingURL=rbac.service.js.map