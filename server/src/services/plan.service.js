import mongoose from 'mongoose';
import { Plan } from '../models/index.js';
import ApiError from '../utils/api-error.js';

/** Public catalogue: active plans ordered for display. */
export async function listActivePlans() {
  return Plan.find({ isActive: true }).sort({ order: 1, price: 1 }).lean();
}

/** Admin catalogue: every plan, active or not. */
export async function listAllPlans() {
  return Plan.find().sort({ order: 1, price: 1 }).lean();
}

export async function getPlanByIdOrFail(planId) {
  if (!mongoose.isValidObjectId(planId)) {
    throw ApiError.badRequest('Indangamuntu y’ubwenge ntariyo', 'INVALID_PLAN_ID');
  }
  const plan = await Plan.findById(planId);
  if (!plan) throw ApiError.notFound('Ubu bwenge ntibubonetse', 'PLAN_NOT_FOUND');
  return plan;
}

/** Loads an active plan for checkout; refuses inactive plans. */
export async function getPurchasablePlan(planId) {
  const plan = await getPlanByIdOrFail(planId);
  if (!plan.isActive) {
    throw ApiError.badRequest('Ubu bwenge ntibukoreshwa ubu', 'PLAN_INACTIVE');
  }
  return plan;
}

export async function createPlan(payload, actorId) {
  const code = String(payload.code || '').trim().toLowerCase();
  if (!code) throw ApiError.badRequest('Kode y’ubwenge irakenewe', 'PLAN_CODE_REQUIRED');
  const existing = await Plan.findOne({ code });
  if (existing) throw ApiError.conflict('Iyi kode isanzweho', 'PLAN_CODE_TAKEN');
  const data = { ...payload, code, createdBy: actorId, updatedBy: actorId };
  if (data.isLifetime) data.durationDays = null;
  assertPriceConsistency(data);
  const plan = await Plan.create(data);
  return plan;
}

/** Rejects an originalPrice that is lower than the sale price. */
function assertPriceConsistency({ price, originalPrice }) {
  if (originalPrice != null && Number(originalPrice) < Number(price)) {
    throw ApiError.badRequest(
      'Igiciro cy’mbere gikomba kuba ringana cyangwa rinini ku igiciro gihagaze',
      'PLAN_PRICE_INVALID',
    );
  }
}

export async function updatePlan(planId, payload, actorId) {
  const plan = await getPlanByIdOrFail(planId);
  const editable = [
    'name',
    'description',
    'price',
    'originalPrice',
    'currency',
    'durationDays',
    'isLifetime',
    'interval',
    'badge',
    'features',
    'entitlements',
    'order',
    'isActive',
    'isPopular',
  ];
  for (const key of editable) {
    if (payload[key] !== undefined) plan[key] = payload[key];
  }
  if (plan.isLifetime) plan.durationDays = null;
  assertPriceConsistency(plan);
  plan.updatedBy = actorId;
  await plan.save();
  return plan;
}

/**
 * Plans are never hard-deleted (historical transactions reference them).
 * Deactivating hides them from the public catalogue while preserving history.
 */
export async function deactivatePlan(planId, actorId) {
  const plan = await getPlanByIdOrFail(planId);
  plan.isActive = false;
  plan.updatedBy = actorId;
  await plan.save();
  return plan;
}

export default {
  listActivePlans,
  listAllPlans,
  getPlanByIdOrFail,
  getPurchasablePlan,
  createPlan,
  updatePlan,
  deactivatePlan,
};
