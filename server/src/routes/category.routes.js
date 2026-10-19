import { Router } from 'express';
import * as categoryController from '../controllers/category.controller.js';
import { authenticateOptional } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.get('/', authenticateOptional, asyncHandler(categoryController.listCategories));
router.get('/:slugOrId', asyncHandler(categoryController.getCategory));

export default router;
