export const ROLES = {
  USER: 'USER',
  EDITOR: 'EDITOR',
  MODERATOR: 'MODERATOR',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
};

export const STAFF_ROLES = [ROLES.EDITOR, ROLES.MODERATOR, ROLES.ADMIN, ROLES.SUPER_ADMIN];

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  ANALYTICS_VIEW: 'analytics.view',
  QUESTIONS_VIEW: 'questions.view',
  QUESTIONS_CREATE: 'questions.create',
  QUESTIONS_EDIT: 'questions.edit',
  QUESTIONS_DELETE: 'questions.delete',
  QUESTIONS_IMPORT: 'questions.import',
  QUESTIONS_EXPORT: 'questions.export',
  CATEGORIES_VIEW: 'categories.view',
  CATEGORIES_MANAGE: 'categories.manage',
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  USERS_SUSPEND: 'users.suspend',
  ROLES_MANAGE: 'roles.manage',
  REPORTS_VIEW: 'reports.view',
  REPORTS_MANAGE: 'reports.manage',
  SETTINGS_MANAGE: 'settings.manage',
  AUDIT_VIEW: 'audit.view',
  BILLING_MANAGE: 'billing:manage',
  PLANS_MANAGE: 'plans:manage',
};

export const PAYMENT_STATUS = ['PENDING_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'DENIED', 'EXPIRED'];

export const QUIZ_TYPES = ['study', 'practice', 'mock', 'mistakes', 'bookmarks', 'category', 'daily'];

export const QUESTION_STATUS = ['active', 'review', 'inactive'];
export const DIFFICULTIES = ['easy', 'medium', 'hard'];

export const REPORT_REASONS = [
  'incorrect-answer',
  'typo',
  'missing-option',
  'image-problem',
  'unclear-question',
  'duplicate',
  'other',
];

export const REPORT_STATUS = ['pending', 'under_review', 'resolved', 'rejected'];

export const LANGUAGES = [
  { code: 'rw', label: 'Ikinyarwanda' },
  { code: 'en', label: 'English' },
];
