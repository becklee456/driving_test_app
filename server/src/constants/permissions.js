/**
 * Permission catalog. Authorization is permission-based - roles are only
 * convenient bundles of permissions and can be extended per-user.
 */
export const PERMISSIONS = {
  ADMIN_ACCESS: 'admin:access',

  QUESTIONS_VIEW: 'questions:view',
  QUESTIONS_CREATE: 'questions:create',
  QUESTIONS_EDIT: 'questions:edit',
  QUESTIONS_DELETE: 'questions:delete',
  QUESTIONS_IMPORT: 'questions:import',
  QUESTIONS_EXPORT: 'questions:export',
  QUESTIONS_PUBLISH: 'questions:publish',
  EXPLANATIONS_MANAGE: 'explanations:manage',

  CATEGORIES_VIEW: 'categories:view',
  CATEGORIES_MANAGE: 'categories:manage',

  REPORTS_VIEW: 'reports:view',
  REPORTS_MANAGE: 'reports:manage',

  USERS_VIEW: 'users:view',
  USERS_MANAGE: 'users:manage',
  USERS_SUSPEND: 'users:suspend',
  ROLES_MANAGE: 'roles:manage',

  EXAMS_VIEW: 'exams:view',
  EXAMS_MANAGE: 'exams:manage',

  ANALYTICS_VIEW: 'analytics:view',
  SETTINGS_MANAGE: 'settings:manage',
  AUDIT_VIEW: 'audit:view',

  BILLING_MANAGE: 'billing:manage',
  PLANS_MANAGE: 'plans:manage',
};

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const ROLES = {
  USER: 'USER',
  EDITOR: 'EDITOR',
  MODERATOR: 'MODERATOR',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
};

export const ROLE_LABELS = {
  USER: 'Umunyeshuri',
  EDITOR: 'Umwanditsi',
  MODERATOR: 'Umugenzuzi',
  ADMIN: 'Umuyobozi',
  SUPER_ADMIN: 'Umuyobozi mukuru',
};

export const ROLE_PERMISSIONS = {
  USER: [],
  EDITOR: [
    PERMISSIONS.ADMIN_ACCESS,
    PERMISSIONS.QUESTIONS_VIEW,
    PERMISSIONS.QUESTIONS_CREATE,
    PERMISSIONS.QUESTIONS_EDIT,
    PERMISSIONS.QUESTIONS_DELETE,
    PERMISSIONS.QUESTIONS_IMPORT,
    PERMISSIONS.QUESTIONS_EXPORT,
    PERMISSIONS.EXPLANATIONS_MANAGE,
    PERMISSIONS.CATEGORIES_VIEW,
    PERMISSIONS.CATEGORIES_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
  ],
  MODERATOR: [
    PERMISSIONS.ADMIN_ACCESS,
    PERMISSIONS.QUESTIONS_VIEW,
    PERMISSIONS.CATEGORIES_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_MANAGE,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_SUSPEND,
  ],
  ADMIN: [
    PERMISSIONS.ADMIN_ACCESS,
    PERMISSIONS.QUESTIONS_VIEW,
    PERMISSIONS.QUESTIONS_CREATE,
    PERMISSIONS.QUESTIONS_EDIT,
    PERMISSIONS.QUESTIONS_DELETE,
    PERMISSIONS.QUESTIONS_IMPORT,
    PERMISSIONS.QUESTIONS_EXPORT,
    PERMISSIONS.QUESTIONS_PUBLISH,
    PERMISSIONS.EXPLANATIONS_MANAGE,
    PERMISSIONS.CATEGORIES_VIEW,
    PERMISSIONS.CATEGORIES_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_MANAGE,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.USERS_SUSPEND,
    PERMISSIONS.EXAMS_VIEW,
    PERMISSIONS.EXAMS_MANAGE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.BILLING_MANAGE,
    PERMISSIONS.PLANS_MANAGE,
  ],
  SUPER_ADMIN: ALL_PERMISSIONS,
};

export const ADMIN_ROLES = [ROLES.EDITOR, ROLES.MODERATOR, ROLES.ADMIN, ROLES.SUPER_ADMIN];

export const isAdminRole = (role) => ADMIN_ROLES.includes(role);

export function permissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}

export function effectivePermissions(user) {
  if (!user) return [];
  if (user.role === ROLES.SUPER_ADMIN) return ALL_PERMISSIONS;
  const set = new Set(permissionsForRole(user.role));
  for (const p of user.permissions || []) set.add(p);
  return [...set];
}

export function userHasPermission(user, permission) {
  return effectivePermissions(user).includes(permission);
}

export function userHasAnyPermission(user, permissions = []) {
  const effective = effectivePermissions(user);
  return permissions.some((p) => effective.includes(p));
}
