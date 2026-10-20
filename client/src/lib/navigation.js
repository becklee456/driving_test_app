import { PERMISSIONS } from './constants.js';

export const PUBLIC_NAV = [
  { to: '/', labelKey: 'nav.home', icon: 'home', end: true },
  { to: '/practice', labelKey: 'nav.practice', icon: 'play' },
  { to: '/mock', labelKey: 'nav.mock', icon: 'clipboard' },
  { to: '/pricing', labelKey: 'nav.pricing', icon: 'tag' },
];

export const APP_NAV = [
  { to: '/app', labelKey: 'nav.dashboard', icon: 'home', end: true },
  { to: '/app/categories', labelKey: 'nav.categories', icon: 'grid' },
  { to: '/app/mock', labelKey: 'nav.mock', icon: 'clipboard' },
  { to: '/app/progress', labelKey: 'nav.progress', icon: 'chart' },
  { to: '/app/bookmarks', labelKey: 'nav.bookmarks', icon: 'bookmark' },
  { to: '/app/mistakes', labelKey: 'nav.mistakes', icon: 'alert' },
  { to: '/app/billing', labelKey: 'nav.billing', icon: 'credit-card' },
];

export const APP_BOTTOM_NAV = [
  { to: '/app', labelKey: 'nav.dashboard', icon: 'home', end: true },
  { to: '/app/categories', labelKey: 'nav.practice', icon: 'play' },
  { to: '/app/mock', labelKey: 'nav.mock', icon: 'clipboard' },
  { to: '/app/progress', labelKey: 'nav.progress', icon: 'chart' },
  { to: '/app/profile', labelKey: 'nav.profile', icon: 'user' },
];

export const ADMIN_NAV = [
  { to: '/admin', labelKey: 'admin.dashboard', icon: 'home', end: true, permission: PERMISSIONS.DASHBOARD_VIEW },
  { to: '/admin/questions', labelKey: 'admin.questions', icon: 'clipboard', permission: PERMISSIONS.QUESTIONS_VIEW },
  { to: '/admin/review', labelKey: 'admin.review_queue', icon: 'alert', permission: PERMISSIONS.QUESTIONS_VIEW },
  { to: '/admin/categories', labelKey: 'admin.categories', icon: 'grid', permission: PERMISSIONS.CATEGORIES_VIEW },
  { to: '/admin/users', labelKey: 'admin.users', icon: 'user', permission: PERMISSIONS.USERS_VIEW },
  { to: '/admin/reports', labelKey: 'admin.reports', icon: 'flag', permission: PERMISSIONS.REPORTS_VIEW },
  { to: '/admin/payments', labelKey: 'admin.payments', icon: 'credit-card', permission: PERMISSIONS.BILLING_MANAGE },
  { to: '/admin/plans', labelKey: 'admin.plans', icon: 'tag', permission: PERMISSIONS.PLANS_MANAGE },
  { to: '/admin/imports', labelKey: 'admin.imports', icon: 'upload', permission: PERMISSIONS.QUESTIONS_IMPORT },
  { to: '/admin/analytics', labelKey: 'nav.progress', icon: 'chart', permission: PERMISSIONS.ANALYTICS_VIEW },
  { to: '/admin/audit', labelKey: 'admin.audit', icon: 'shield', permission: PERMISSIONS.AUDIT_VIEW },
  { to: '/admin/settings', labelKey: 'admin.settings', icon: 'settings', permission: PERMISSIONS.SETTINGS_MANAGE },
];
