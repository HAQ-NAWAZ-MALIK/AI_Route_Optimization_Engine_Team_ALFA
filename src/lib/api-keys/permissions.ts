/**
 * API Key Permissions System
 * Scoped permissions for fine-grained access control
 */

export type Permission =
    | 'route:read'
    | 'route:optimize'
    | 'cluster:optimize'
    | 'matrix:calculate'
    | 'admin:users:read'
    | 'admin:users:write'
    | 'admin:keys:read'
    | 'admin:keys:revoke'
    | 'admin:analytics'
    | 'admin:*'; // Full admin access

export const PERMISSION_GROUPS = {
    user: ['route:read', 'route:optimize', 'cluster:optimize', 'matrix:calculate'] as Permission[],
    admin: ['admin:*'] as Permission[],
} as const;

/**
 * Check if a key has a specific permission
 */
export function hasPermission(
    keyPermissions: string[],
    requiredPermission: Permission
): boolean {
    // Admin wildcard grants all permissions
    if (keyPermissions.includes('admin:*')) {
        return true;
    }

    // Check for exact permission match
    if (keyPermissions.includes(requiredPermission)) {
        return true;
    }

    // Check for wildcard permissions (e.g., "route:*" grants "route:read", "route:optimize")
    const [resource, action] = requiredPermission.split(':');
    const wildcardPermission = `${resource}:*`;
    if (keyPermissions.includes(wildcardPermission)) {
        return true;
    }

    return false;
}

/**
 * Get required permission for an API endpoint
 */
export function getRequiredPermission(endpoint: string, method: string): Permission | null {
    const permissionMap: Record<string, Permission> = {
        // Route optimization endpoints
        'GET:/api/v1/optimize/route': 'route:read',
        'POST:/api/v1/optimize/route': 'route:optimize',

        // Multi-cluster endpoints
        'POST:/api/v1/optimize/multi-cluster': 'cluster:optimize',

        // Distance matrix
        'POST:/api/v1/matrix/distance': 'matrix:calculate',

        // Admin endpoints
        'GET:/api/portal/admin/users': 'admin:users:read',
        'POST:/api/portal/admin/users': 'admin:users:write',
        'GET:/api/portal/admin/keys': 'admin:keys:read',
        'DELETE:/api/portal/admin/keys': 'admin:keys:revoke',
        'GET:/api/portal/admin/analytics': 'admin:analytics',
    };

    const key = `${method}:${endpoint}`;
    return permissionMap[key] || null;
}

/**
 * Get default permissions for a new user
 */
export function getDefaultUserPermissions(): Permission[] {
    return PERMISSION_GROUPS.user;
}

/**
 * Validate permission string array
 */
export function validatePermissions(permissions: string[]): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];
    const validPermissions = new Set([
        'route:read',
        'route:optimize',
        'route:*',
        'cluster:optimize',
        'matrix:calculate',
        'admin:users:read',
        'admin:users:write',
        'admin:keys:read',
        'admin:keys:revoke',
        'admin:analytics',
        'admin:*',
    ]);

    permissions.forEach(perm => {
        if (!validPermissions.has(perm)) {
            errors.push(`Invalid permission: ${perm}`);
        }
    });

    return {
        valid: errors.length === 0,
        errors,
    };
}
