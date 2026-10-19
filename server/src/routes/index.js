import { Router } from 'express';
import authRoutes from './auth.routes.js';
import meRoutes from './me.routes.js';
import quizRoutes from './quiz.routes.js';
import questionRoutes from './question.routes.js';
import categoryRoutes from './category.routes.js';
import adminRoutes from './admin.routes.js';
import { loadSettings, maintenanceGuard } from '../middleware/settings.js';
import config from '../config/env.js';
import { success } from '../middleware/error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { ROLES, PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, ALL_PERMISSIONS } from '../constants/permissions.js';

const router = Router();

/** Public runtime configuration for the client (safe, read-only fields). */
router.get(
  '/config',
  loadSettings,
  asyncHandler(async (req, res) => {
    const s = req.settings;
    return success(res, {
      appName: config.appName,
      defaultLanguage: s.defaultLanguage,
      enabledLanguages: s.enabledLanguages,
      passingScorePercent: s.passingScorePercent,
      examQuestionCount: s.examQuestionCount,
      examDurationMinutes: s.examDurationMinutes,
      practiceDefaultCount: s.practiceDefaultCount,
      allowRegistration: s.allowRegistration,
      requireEmailVerification: s.requireEmailVerification,
      maintenanceMode: s.maintenanceMode,
      announcement: s.announcement,
    });
  }),
);

/** Static role/permission catalog so the admin UI can render permission pickers. */
router.get('/permissions', (_req, res) =>
  success(res, { roles: ROLES, roleLabels: ROLE_LABELS, rolePermissions: ROLE_PERMISSIONS, permissions: ALL_PERMISSIONS, permissionGroups: PERMISSIONS }),
);

router.use(loadSettings, maintenanceGuard);

router.use('/auth', authRoutes);
router.use('/me', meRoutes);
router.use('/quizzes', quizRoutes);
router.use('/questions', questionRoutes);
router.use('/categories', categoryRoutes);
router.use('/admin', adminRoutes);

export default router;
