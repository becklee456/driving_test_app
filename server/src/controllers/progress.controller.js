import * as progressService from '../services/progress.service.js';
import { success } from '../middleware/error.js';

export async function getProgress(req, res) {
  const progress = await progressService.getUserProgress(req.user);
  return success(res, progress);
}

export async function getCategories(req, res) {
  const categories = await progressService.getCategoryProgress(req.user, { categorySlug: req.query.category });
  return success(res, { categories });
}

export async function getActivity(req, res) {
  const days = Number(req.query.days) || 90;
  const activity = await progressService.getActivityHeatmap(req.user, { days });
  return success(res, { activity });
}

export async function getMistakes(req, res) {
  const limit = Number(req.query.limit) || 20;
  const mistakes = await progressService.getMistakes(req.user, { limit });
  return success(res, { mistakes });
}

export async function resetProgress(req, res) {
  await progressService.resetUserProgress(req.user);
  return success(res, { reset: true });
}

export default { getProgress, getCategories, getActivity, getMistakes, resetProgress };
