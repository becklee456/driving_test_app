import { Router } from 'express';
import { z } from 'zod';
import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter, loginLimiter, otpLimiter, writeLimiter } from '../middleware/rate-limit.js';
import { asyncHandler } from '../utils/async-handler.js';
import { loadSettings } from '../middleware/settings.js';

const router = Router();

const password = z
  .string()
  .min(8, 'Ijambo ry’ibanga rigomba kuba nibura inyuguti 8')
  .max(128)
  .regex(/[A-Za-z]/, 'Rigomba kuba ririmo inyuguti')
  .regex(/[0-9]/, 'Rigomba kuba ririmo umubare');

const email = z.string().trim().toLowerCase().email('Email ntariyo');

const registerSchema = z.object({
  fullName: z.string().trim().min(3, 'Amazina ni make cyane').max(120),
  email,
  password,
  phone: z.string().trim().max(20).optional().or(z.literal('')),
});

const loginSchema = z.object({ email, password: z.string().min(1, 'Ijambo ry’ibanga rirakenewe') });
const verifySchema = z.object({ email, otp: z.string().trim().min(4).max(10) });
const emailOnlySchema = z.object({ email });
const resetSchema = z.object({ email, token: z.string().trim().min(4).max(10), password });
const changeSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });
const twoFactorSchema = z.object({ challengeToken: z.string().min(10), code: z.string().trim().min(4).max(12) });

router.use(loadSettings);

router.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(authController.register));
router.post('/verify-email', authLimiter, validate({ body: verifySchema }), asyncHandler(authController.verifyEmail));
router.post('/resend-verification', otpLimiter, validate({ body: emailOnlySchema }), asyncHandler(authController.resendVerification));
router.post('/login', loginLimiter, validate({ body: loginSchema }), asyncHandler(authController.login));
router.post('/login/2fa', loginLimiter, validate({ body: twoFactorSchema }), asyncHandler(authController.loginTwoFactor));
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', asyncHandler(authController.logout));
router.post('/forgot-password', otpLimiter, validate({ body: emailOnlySchema }), asyncHandler(authController.forgotPassword));
router.post('/reset-password', authLimiter, validate({ body: resetSchema }), asyncHandler(authController.resetPassword));
router.post(
  '/change-password',
  authenticate,
  writeLimiter,
  validate({ body: changeSchema }),
  asyncHandler(authController.changePassword),
);

export default router;
