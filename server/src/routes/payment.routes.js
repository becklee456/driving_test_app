import { Router } from 'express';
import { z } from 'zod';
import * as paymentController from '../controllers/payment.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rate-limit.js';
import { handleProofUpload } from '../services/proof-storage.service.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

/* Public: active plan catalogue (used by the pricing page before login). */
router.get('/plans', asyncHandler(paymentController.listPlans));

router.use(authenticate);

const submitSchema = z.object({
  planId: z.string().min(12, 'Ubwenge ntibwatoranyijwe'),
  payerName: z.string().trim().min(3, 'Amazina y’uwishyuye arakenewe').max(120),
  payerPhone: z.string().trim().min(9, 'Nomero ya telefone irakenewe').max(20),
  transactionReference: z.string().trim().max(80).optional(),
  paymentMessage: z.string().trim().max(500).optional(),
  noProof: z.union([z.boolean(), z.string()]).optional(),
});

/* Learner endpoints */
router.post(
  '/',
  writeLimiter,
  handleProofUpload,
  validate({ body: submitSchema }),
  asyncHandler(paymentController.submitPayment),
);
router.get('/my', asyncHandler(paymentController.listMyPayments));
router.get('/my/status', asyncHandler(paymentController.getMyPaymentStatus));
router.get('/my/subscriptions', asyncHandler(paymentController.listMySubscriptions));
router.get('/proof/:id', asyncHandler(paymentController.getPaymentProof));
router.get('/:id', asyncHandler(paymentController.getMyPayment));

export default router;
