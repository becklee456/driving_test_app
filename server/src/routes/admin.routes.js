import { Router } from 'express';
import { z } from 'zod';
import * as adminController from '../controllers/admin.controller.js';
import * as questionController from '../controllers/question.controller.js';
import * as categoryController from '../controllers/category.controller.js';
import * as userController from '../controllers/user.controller.js';
import * as importController from '../controllers/import.controller.js';
import * as reportController from '../controllers/report.controller.js';
import * as paymentController from '../controllers/payment.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { requireStaff, requirePermission } from '../middleware/permissions.js';
import { PERMISSIONS, ALL_PERMISSIONS } from '../constants/permissions.js';
import { writeLimiter } from '../middleware/rate-limit.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.use(authenticate, requireStaff);

const optionSchema = z.object({
  id: z.string().max(4).optional(),
  label: z.string().max(4).optional(),
  text: z.string().trim().min(1, 'Umwandiko w’igisubizo urakenewe'),
  isCorrect: z.boolean().optional(),
});

const questionBodySchema = z.object({
  questionNumber: z.coerce.number().int().min(1).max(9999).optional(),
  questionText: z.string().trim().min(4, 'Umwandiko w’ikibazo ni muke'),
  options: z.array(optionSchema).min(2).max(8),
  explanation: z.string().max(4000).nullable().optional(),
  category: z.string().optional(),
  categorySlug: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  tags: z.array(z.string()).max(20).optional(),
  status: z.enum(['active', 'review', 'inactive']).optional(),
  image: z.object({ url: z.string().url(), alt: z.string().max(200).optional() }).nullable().optional(),
  sourceId: z.string().max(60).optional(),
});

const questionUpdateSchema = questionBodySchema.partial().extend({
  questionText: z.string().trim().min(4).optional(),
  options: z.array(optionSchema).min(2).max(8).optional(),
});

/* Analytics */
router.get('/overview', requirePermission(PERMISSIONS.ANALYTICS_VIEW), asyncHandler(adminController.overview));
router.get('/analytics/growth', requirePermission(PERMISSIONS.ANALYTICS_VIEW), asyncHandler(adminController.userGrowth));
router.get('/analytics/activity', requirePermission(PERMISSIONS.ANALYTICS_VIEW), asyncHandler(adminController.activityTrend));
router.get('/analytics/categories', requirePermission(PERMISSIONS.ANALYTICS_VIEW), asyncHandler(adminController.categoryPerformance));
router.get('/analytics/questions', requirePermission(PERMISSIONS.ANALYTICS_VIEW), asyncHandler(adminController.questionInsights));
router.get('/analytics/leaderboard', requirePermission(PERMISSIONS.ANALYTICS_VIEW), asyncHandler(adminController.leaderboard));
router.get('/analytics/recent-activity', requirePermission(PERMISSIONS.ANALYTICS_VIEW), asyncHandler(adminController.recentActivity));

/* Audit trail */
router.get('/audit', requirePermission(PERMISSIONS.AUDIT_VIEW), asyncHandler(adminController.listAudit));

/* Questions */
router.get('/questions', requirePermission(PERMISSIONS.QUESTIONS_VIEW), asyncHandler(questionController.adminList));
router.get('/questions/stats', requirePermission(PERMISSIONS.QUESTIONS_VIEW), asyncHandler(questionController.questionStats));
router.get('/questions/review-queue', requirePermission(PERMISSIONS.QUESTIONS_VIEW), asyncHandler(adminController.reviewQueue));
router.get('/questions/:id', requirePermission(PERMISSIONS.QUESTIONS_VIEW), asyncHandler(questionController.adminGet));
router.post('/questions', requirePermission(PERMISSIONS.QUESTIONS_CREATE), writeLimiter, validate({ body: questionBodySchema }), asyncHandler(questionController.createQuestion));
router.patch('/questions/:id', requirePermission(PERMISSIONS.QUESTIONS_EDIT), writeLimiter, validate({ body: questionUpdateSchema }), asyncHandler(questionController.updateQuestion));
router.delete('/questions/:id', requirePermission(PERMISSIONS.QUESTIONS_DELETE), asyncHandler(questionController.deleteQuestion));
router.post(
  '/questions/bulk',
  requirePermission(PERMISSIONS.QUESTIONS_EDIT),
  writeLimiter,
  validate({
    body: z.object({
      action: z.enum(['publish', 'unpublish', 'delete', 'category']),
      ids: z.array(z.string()).min(1).max(500),
      category: z.string().optional(),
    }),
  }),
  asyncHandler(questionController.bulkAction),
);

/* Categories */
router.get('/categories', requirePermission(PERMISSIONS.CATEGORIES_VIEW), asyncHandler(categoryController.listCategories));
router.post(
  '/categories',
  requirePermission(PERMISSIONS.CATEGORIES_MANAGE),
  validate({
    body: z.object({
      name: z.string().trim().min(2).max(120),
      nameEn: z.string().trim().max(120).optional(),
      slug: z.string().trim().max(120).optional(),
      description: z.string().max(600).optional(),
      icon: z.string().max(40).optional(),
      color: z.string().max(20).optional(),
      order: z.coerce.number().int().optional(),
    }),
  }),
  asyncHandler(categoryController.createCategory),
);
router.patch(
  '/categories/:id',
  requirePermission(PERMISSIONS.CATEGORIES_MANAGE),
  validate({
    body: z.object({
      name: z.string().trim().min(2).max(120).optional(),
      nameEn: z.string().trim().max(120).optional(),
      slug: z.string().trim().max(120).optional(),
      description: z.string().max(600).optional(),
      icon: z.string().max(40).optional(),
      color: z.string().max(20).optional(),
      order: z.coerce.number().int().optional(),
      isActive: z.boolean().optional(),
    }),
  }),
  asyncHandler(categoryController.updateCategory),
);
router.delete('/categories/:id', requirePermission(PERMISSIONS.CATEGORIES_MANAGE), asyncHandler(categoryController.deleteCategory));
router.post(
  '/categories/reorder',
  requirePermission(PERMISSIONS.CATEGORIES_MANAGE),
  validate({ body: z.object({ order: z.array(z.object({ id: z.string(), order: z.coerce.number().int() })) }) }),
  asyncHandler(categoryController.reorderCategories),
);

/* Imports / exports */
router.post(
  '/imports/preview',
  requirePermission(PERMISSIONS.QUESTIONS_IMPORT),
  writeLimiter,
  validate({
    body: z.object({
      format: z.enum(['json', 'csv', 'txt', 'xlsx', 'xls']).optional(),
      content: z.string().optional(),
      fileName: z.string().max(200).optional(),
      sourceName: z.string().max(120).optional(),
      source: z.literal('bundled-dataset').optional(),
    }),
  }),
  asyncHandler(importController.preview),
);
router.post(
  '/imports/commit',
  requirePermission(PERMISSIONS.QUESTIONS_IMPORT),
  writeLimiter,
  validate({
    body: z.object({
      format: z.enum(['json', 'csv', 'txt', 'xlsx', 'xls']).optional(),
      content: z.string().optional(),
      fileName: z.string().max(200).optional(),
      sourceName: z.string().max(120).optional(),
      dataset: z.string().max(120).optional(),
      skipDuplicateNumbers: z.boolean().optional(),
      source: z.literal('bundled-dataset').optional(),
    }),
  }),
  asyncHandler(importController.commit),
);
router.get('/imports/export', requirePermission(PERMISSIONS.QUESTIONS_EXPORT), asyncHandler(importController.exportQuestions));

/* Reports */
router.get('/reports', requirePermission(PERMISSIONS.REPORTS_VIEW), asyncHandler(reportController.listReports));
router.get('/reports/search-questions', requirePermission(PERMISSIONS.REPORTS_VIEW), asyncHandler(reportController.reportSearchQuestions));
router.patch(
  '/reports/:id',
  requirePermission(PERMISSIONS.REPORTS_MANAGE),
  validate({
    body: z.object({
      status: z.enum(['pending', 'under_review', 'resolved', 'rejected']).optional(),
      resolutionNote: z.string().max(1000).optional(),
    }),
  }),
  asyncHandler(reportController.updateReport),
);

/* Users */
router.get('/users', requirePermission(PERMISSIONS.USERS_VIEW), asyncHandler(userController.listUsers));
router.get('/users/:id', requirePermission(PERMISSIONS.USERS_VIEW), asyncHandler(userController.getUser));
router.patch(
  '/users/:id',
  requirePermission(PERMISSIONS.USERS_MANAGE),
  writeLimiter,
  validate({
    body: z.object({
      fullName: z.string().trim().min(3).max(120).optional(),
      phone: z.string().trim().max(20).nullable().optional(),
      status: z.enum(['active', 'pending', 'suspended', 'deactivated']).optional(),
      notes: z.string().max(2000).optional(),
    }),
  }),
  asyncHandler(userController.updateUser),
);
router.patch(
  '/users/:id/role',
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  writeLimiter,
  validate({
    body: z.object({
      role: z.enum(['USER', 'EDITOR', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN']),
      permissions: z.array(z.enum(ALL_PERMISSIONS)).optional(),
    }),
  }),
  asyncHandler(userController.updateUserRole),
);
router.post(
  '/users/:id/suspend',
  requirePermission(PERMISSIONS.USERS_SUSPEND),
  writeLimiter,
  validate({ body: z.object({ notes: z.string().max(2000).optional() }) }),
  asyncHandler(userController.suspendUser),
);
router.post(
  '/users/:id/activate',
  requirePermission(PERMISSIONS.USERS_MANAGE),
  writeLimiter,
  validate({ body: z.object({ notes: z.string().max(2000).optional() }) }),
  asyncHandler(userController.activateUser),
);
router.post(
  '/users/:id/reset-progress',
  requirePermission(PERMISSIONS.USERS_MANAGE),
  writeLimiter,
  validate({ body: z.object({}).optional() }),
  asyncHandler(userController.resetProgress),
);
router.delete('/users/:id', requirePermission(PERMISSIONS.USERS_MANAGE), asyncHandler(userController.deleteUser));

/* Settings */
router.get('/settings', requirePermission(PERMISSIONS.SETTINGS_MANAGE), asyncHandler(adminController.getSettings));
router.patch(
  '/settings',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate({
    body: z.object({
      passingScorePercent: z.coerce.number().int().min(0).max(100).optional(),
      examQuestionCount: z.coerce.number().int().min(5).max(200).optional(),
      examDurationMinutes: z.coerce.number().int().min(1).max(240).optional(),
      practiceDefaultCount: z.coerce.number().int().min(5).max(100).optional(),
      allowRegistration: z.boolean().optional(),
      requireEmailVerification: z.boolean().optional(),
      require2FAForAdmins: z.boolean().optional(),
      allowSelfServiceReset: z.boolean().optional(),
      maintenanceMode: z.boolean().optional(),
      defaultLanguage: z.enum(['rw', 'en', 'fr']).optional(),
      enabledLanguages: z.array(z.enum(['rw', 'en', 'fr'])).min(1).optional(),
      announcement: z.string().max(1000).optional(),
      xpPerCorrectAnswer: z.coerce.number().int().min(0).max(100).optional(),
      xpPerTest: z.coerce.number().int().min(0).max(500).optional(),
      theme: z
        .object({
          primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'HEX color required').optional(),
          accentColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'HEX color required').optional(),
        })
        .optional(),
    }),
  }),
  asyncHandler(adminController.updateSettings),
);

/* Payments */
router.get('/payments', requirePermission(PERMISSIONS.BILLING_MANAGE), asyncHandler(paymentController.adminListPayments));
router.get('/payments/:id', requirePermission(PERMISSIONS.BILLING_MANAGE), asyncHandler(paymentController.adminGetPayment));
router.post(
  '/payments/:id/approve',
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  writeLimiter,
  validate({ body: z.object({ note: z.string().max(300).optional() }) }),
  asyncHandler(paymentController.adminApprovePayment),
);
router.post(
  '/payments/:id/deny',
  requirePermission(PERMISSIONS.BILLING_MANAGE),
  writeLimiter,
  validate({ body: z.object({ reason: z.string().trim().min(3).max(300) }) }),
  asyncHandler(paymentController.adminDenyPayment),
);

/* Plans (admin) */
const planEntitlementsSchema = z
  .object({
    dailyQuestions: z.coerce.number().int().min(-1).optional(),
    dailyMockExams: z.coerce.number().int().min(-1).optional(),
    dailyAIAnswers: z.coerce.number().int().min(-1).optional(),
    mistakeReview: z.boolean().optional(),
    advancedAnalytics: z.boolean().optional(),
    downloadableReports: z.boolean().optional(),
    adFree: z.boolean().optional(),
    prioritySupport: z.boolean().optional(),
  })
  .strict()
  .optional();

router.get('/plans', requirePermission(PERMISSIONS.PLANS_MANAGE), asyncHandler(paymentController.listAllPlans));
router.post(
  '/plans',
  requirePermission(PERMISSIONS.PLANS_MANAGE),
  writeLimiter,
  validate({
    body: z.object({
      code: z.string().trim().max(60),
      name: z.string().trim().min(2).max(120),
      description: z.string().max(600).optional(),
      price: z.coerce.number().int().min(0),
      originalPrice: z.coerce.number().int().min(0).nullable().optional(),
      currency: z.string().trim().max(8).optional(),
      durationDays: z.coerce.number().int().min(1).nullable().optional(),
      isLifetime: z.boolean().optional(),
      interval: z.enum(['day', 'week', 'month', 'year', 'lifetime']).optional(),
      badge: z.string().trim().max(40).nullable().optional(),
      features: z.array(z.string().trim().max(120)).max(30).optional(),
      entitlements: planEntitlementsSchema,
      order: z.coerce.number().int().optional(),
      isActive: z.boolean().optional(),
      isPopular: z.boolean().optional(),
    }),
  }),
  asyncHandler(paymentController.adminCreatePlan),
);
router.patch(
  '/plans/:id',
  requirePermission(PERMISSIONS.PLANS_MANAGE),
  writeLimiter,
  validate({
    body: z.object({
      name: z.string().trim().min(2).max(120).optional(),
      description: z.string().max(600).optional(),
      price: z.coerce.number().int().min(0).optional(),
      originalPrice: z.coerce.number().int().min(0).nullable().optional(),
      currency: z.string().trim().max(8).optional(),
      durationDays: z.coerce.number().int().min(1).nullable().optional(),
      isLifetime: z.boolean().optional(),
      interval: z.enum(['day', 'week', 'month', 'year', 'lifetime']).optional(),
      badge: z.string().trim().max(40).nullable().optional(),
      features: z.array(z.string().trim().max(120)).max(30).optional(),
      entitlements: planEntitlementsSchema,
      order: z.coerce.number().int().optional(),
      isActive: z.boolean().optional(),
      isPopular: z.boolean().optional(),
    }),
  }),
  asyncHandler(paymentController.adminUpdatePlan),
);
router.delete('/plans/:id', requirePermission(PERMISSIONS.PLANS_MANAGE), asyncHandler(paymentController.adminDeactivatePlan));

/* Payment settings */
router.patch(
  '/payment-settings',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  writeLimiter,
  validate({
    body: z.object({
      freeQuestionsAllowed: z.coerce.number().int().min(0).max(1000).optional(),
      freePracticeAttemptsAllowed: z.coerce.number().int().min(0).max(100).optional(),
      payment: z
        .object({
          method: z.string().max(80).optional(),
          recipientPhone: z.string().trim().max(20).optional(),
          recipientName: z.string().trim().max(120).optional(),
          currency: z.string().trim().max(8).optional(),
          verificationWindowHours: z.coerce.number().int().min(1).max(72).optional(),
          instructions: z.string().max(2000).optional(),
        })
        .optional(),
    }),
  }),
  asyncHandler(adminController.updatePaymentSettings),
);

export default router;
