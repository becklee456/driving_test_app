import { Router } from 'express';
import { z } from 'zod';
import * as questionController from '../controllers/question.controller.js';
import { authenticateOptional } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().max(120).optional(),
    category: z.string().trim().max(120).optional(),
    categorySlug: z.string().trim().max(120).optional(),
    difficulty: z.enum(['all', 'easy', 'medium', 'hard']).optional(),
    status: z.enum(['active', 'review', 'inactive']).optional(),
    sort: z.enum(['recent', 'missed', 'hardest', 'number']).optional(),
    bookmarked: z.coerce.boolean().optional(),
  })
  .strip();

const randomQuerySchema = z
  .object({
    category: z.string().trim().max(120).optional(),
    difficulty: z.enum(['all', 'easy', 'medium', 'hard']).optional(),
  })
  .strip();

router.get('/', authenticateOptional, validate({ query: listQuerySchema }), asyncHandler(questionController.listQuestions));
router.get('/random', validate({ query: randomQuerySchema }), asyncHandler(questionController.randomQuestion));
router.get('/:id', asyncHandler(questionController.getQuestion));

export default router;
