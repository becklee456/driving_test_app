import { Router } from 'express';
import { z } from 'zod';
import * as quizController from '../controllers/quiz.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rate-limit.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.use(authenticate);

const startSchema = z.object({
  type: z.enum(['study', 'practice', 'mock', 'mistakes', 'bookmarks', 'category', 'daily']).default('practice'),
  count: z.coerce.number().int().min(5).max(200).optional(),
  categories: z.array(z.string()).max(20).optional(),
  difficulty: z.enum(['all', 'easy', 'medium', 'hard']).optional(),
  mode: z.enum(['random', 'sequential', 'incorrect', 'bookmarked']).optional(),
});

const answerSchema = z.object({
  questionId: z.string().min(12),
  selectedOptionId: z.string().max(4).nullable().optional(),
  timeSpentMs: z.coerce.number().int().min(0).max(3_600_000).optional(),
});

const submitSchema = z.object({
  selections: z.record(z.string(), z.string().nullable()).optional(),
});

router.post('/', writeLimiter, validate({ body: startSchema }), asyncHandler(quizController.startQuiz));
router.get('/active', asyncHandler(quizController.getActiveQuiz));
router.get('/', asyncHandler(quizController.listQuizzes));
router.get('/:id', asyncHandler(quizController.getQuiz));
router.post('/:id/answers', writeLimiter, validate({ body: answerSchema }), asyncHandler(quizController.saveAnswer));
router.post('/:id/submit', writeLimiter, validate({ body: submitSchema }), asyncHandler(quizController.submitQuiz));
router.get('/:id/result', asyncHandler(quizController.getResult));
router.delete('/:id', asyncHandler(quizController.deleteQuiz));

export default router;
