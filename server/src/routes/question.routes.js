import { Router } from 'express';
import * as questionController from '../controllers/question.controller.js';
import { authenticateOptional } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.get('/', authenticateOptional, asyncHandler(questionController.listQuestions));
router.get('/random', asyncHandler(questionController.randomQuestion));
router.get('/:id', asyncHandler(questionController.getQuestion));

export default router;
