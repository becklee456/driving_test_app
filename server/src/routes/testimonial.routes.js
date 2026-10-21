import { Router } from 'express';
import * as testimonialController from '../controllers/testimonial.controller.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.get('/', asyncHandler(testimonialController.listTestimonials));
router.get('/:id', asyncHandler(testimonialController.getTestimonial));

export default router;
