import { Router } from 'express';
import { z } from 'zod';
import * as userController from '../controllers/user.controller.js';
import * as progressController from '../controllers/progress.controller.js';
import * as bookmarkController from '../controllers/bookmark.controller.js';
import * as notificationController from '../controllers/notification.controller.js';
import * as reportController from '../controllers/report.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { writeLimiter, otpLimiter } from '../middleware/rate-limit.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.use(authenticate);

/* Profile */
router.get('/', asyncHandler(userController.getMe));
router.patch(
  '/',
  writeLimiter,
  validate({
    body: z.object({
      fullName: z.string().trim().min(3).max(120).optional(),
      phone: z.string().trim().max(20).nullable().optional(),
      preferences: z
        .object({
          language: z.enum(['rw', 'en', 'fr']).optional(),
          dailyGoal: z.number().int().min(5).max(200).optional(),
          reduceMotion: z.boolean().optional(),
          highContrast: z.boolean().optional(),
        })
        .optional(),
      notificationPreferences: z
        .object({
          studyReminders: z.boolean().optional(),
          newContent: z.boolean().optional(),
          achievements: z.boolean().optional(),
          testResults: z.boolean().optional(),
          securityAlerts: z.boolean().optional(),
        })
        .optional(),
    }),
  }),
  asyncHandler(userController.updateMe),
);
router.delete('/', asyncHandler(userController.deleteMe));

/* Sessions */
router.get('/sessions', asyncHandler(userController.listSessions));
router.delete('/sessions', asyncHandler(userController.revokeAllSessions));
router.delete('/sessions/:id', asyncHandler(userController.revokeSession));

/* Two-factor authentication */
router.post('/2fa/setup', asyncHandler(userController.setupTwoFactor));
router.post('/2fa/enable', writeLimiter, validate({ body: z.object({ code: z.string().trim().min(4).max(12) }) }), asyncHandler(userController.enableTwoFactor));
router.post(
  '/2fa/disable',
  writeLimiter,
  validate({ body: z.object({ code: z.string().trim().min(4).max(12).optional(), password: z.string().min(1).optional() }) }),
  asyncHandler(userController.disableTwoFactor),
);

/* Progress & analytics */
router.get('/progress', asyncHandler(progressController.getProgress));
router.get('/progress/categories', asyncHandler(progressController.getCategories));
router.get('/progress/activity', asyncHandler(progressController.getActivity));
router.get('/progress/mistakes', asyncHandler(progressController.getMistakes));
router.delete('/progress', writeLimiter, asyncHandler(progressController.resetProgress));

/* Bookmarks */
router.get('/bookmarks', asyncHandler(bookmarkController.listBookmarks));
router.post('/bookmarks', writeLimiter, validate({ body: z.object({ questionId: z.string().min(12), note: z.string().max(500).optional() }) }), asyncHandler(bookmarkController.addBookmark));
router.post('/bookmarks/toggle', writeLimiter, validate({ body: z.object({ questionId: z.string().min(12) }) }), asyncHandler(bookmarkController.toggleBookmark));
router.delete('/bookmarks/:questionId', asyncHandler(bookmarkController.removeBookmark));

/* Notifications */
router.get('/notifications', asyncHandler(notificationController.listNotifications));
router.get('/notifications/unread-count', asyncHandler(notificationController.unreadCount));
router.patch('/notifications/:id/read', asyncHandler(notificationController.markRead));
router.post('/notifications/read-all', asyncHandler(notificationController.markAllRead));

/* Question reports */
router.post(
  '/reports',
  otpLimiter,
  validate({
    body: z.object({
      questionId: z.string().min(12),
      reason: z.enum(['incorrect-answer', 'typo', 'missing-option', 'image-problem', 'unclear-question', 'duplicate', 'other']),
      message: z.string().max(1000).optional(),
    }),
  }),
  asyncHandler(reportController.createReport),
);
router.get('/reports', asyncHandler(reportController.listMyReports));

export default router;
