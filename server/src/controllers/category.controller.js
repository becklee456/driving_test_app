import mongoose from 'mongoose';
import { Category, Question } from '../models/index.js';
import * as questionService from '../services/question.service.js';
import { slugify } from '../utils/slug.js';
import { success } from '../middleware/error.js';
import { recordActivity } from '../middleware/audit.js';
import ApiError from '../utils/api-error.js';

export async function listCategories(req, res) {
  const includeInactive = req.query.includeInactive === 'true' && req.user && req.user.role !== 'USER';
  const filter = includeInactive ? {} : { isActive: true };
  const categories = await Category.find(filter).sort({ order: 1, name: 1 }).lean();
  return success(res, { categories });
}

export async function getCategory(req, res) {
  const key = req.params.slugOrId;
  const category = mongoose.isValidObjectId(key) ? await Category.findById(key).lean() : await Category.findOne({ slug: key }).lean();
  if (!category) throw ApiError.notFound('Icyiciro ntikibonetse', 'CATEGORY_NOT_FOUND');
  return success(res, { category });
}

export async function createCategory(req, res) {
  const { name, nameEn, description, icon, color, order } = req.body;
  const slug = req.body.slug ? slugify(req.body.slug) : slugify(name);
  const existing = await Category.findOne({ slug });
  if (existing) throw ApiError.conflict('Icyiciro kirasa slug isanzweho', 'CATEGORY_EXISTS');

  const category = await Category.create({
    name,
    nameEn: nameEn || '',
    slug,
    description: description || '',
    icon: icon || 'sign',
    color: color || '#2563eb',
    order: order ?? (await Category.countDocuments()),
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
  await recordActivity(req, { action: 'category.create', resource: 'category', resourceId: category._id });
  return success(res, { category }, 201);
}

export async function updateCategory(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('Indangamuntu itariyo', 'INVALID_ID');
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound('Icyiciro ntikibonetse', 'CATEGORY_NOT_FOUND');

  const { name, nameEn, description, icon, color, order, isActive, slug } = req.body;
  if (slug && slugify(slug) !== category.slug) {
    const clash = await Category.findOne({ slug: slugify(slug), _id: { $ne: category._id } });
    if (clash) throw ApiError.conflict('Iyi slug isanzweho', 'CATEGORY_EXISTS');
    category.slug = slugify(slug);
    await Question.updateMany({ category: category._id }, { $set: { categorySlug: category.slug } });
  }
  if (name !== undefined) category.name = name;
  if (nameEn !== undefined) category.nameEn = nameEn;
  if (description !== undefined) category.description = description;
  if (icon !== undefined) category.icon = icon;
  if (color !== undefined) category.color = color;
  if (order !== undefined) category.order = order;
  if (isActive !== undefined) category.isActive = isActive;
  category.updatedBy = req.user._id;
  await category.save();

  await recordActivity(req, { action: 'category.update', resource: 'category', resourceId: category._id });
  return success(res, { category });
}

export async function deleteCategory(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('Indangamuntu itariyo', 'INVALID_ID');
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound('Icyiciro ntikibonetse', 'CATEGORY_NOT_FOUND');

  const questionCount = await Question.countDocuments({ category: category._id });
  if (questionCount > 0) {
    throw ApiError.conflict(
      `Iki cyiciro kirimo ibibazo ${questionCount}. Banza ubihindure cyangwa ubisibe.`,
      'CATEGORY_NOT_EMPTY',
      { questionCount },
    );
  }
  await category.deleteOne();
  await recordActivity(req, { action: 'category.delete', resource: 'category', resourceId: req.params.id });
  return success(res, { deleted: true });
}

export async function reorderCategories(req, res) {
  const { order } = req.body;
  if (!Array.isArray(order)) throw ApiError.badRequest('Urutonde ntirwemewe', 'INVALID_ORDER');
  await Promise.all(
    order.map((entry, index) =>
      Category.updateOne({ _id: entry.id }, { $set: { order: entry.order ?? index } }),
    ),
  );
  await questionService.refreshCategoryCounts();
  const categories = await Category.find().sort({ order: 1 }).lean();
  return success(res, { categories });
}

export default {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
};
