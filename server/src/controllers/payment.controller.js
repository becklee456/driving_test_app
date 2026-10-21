import * as paymentService from '../services/payment.service.js';
import * as planService from '../services/plan.service.js';
import * as subscriptionService from '../services/subscription.service.js';
import * as entitlementService from '../services/entitlement.service.js';
import { streamProof } from '../services/proof-storage.service.js';
import { recordActivity } from '../middleware/audit.js';
import { success } from '../middleware/error.js';
import ApiError from '../utils/api-error.js';

/* ------------------------------------------------------------------ *
 * Plans (public)
 * ------------------------------------------------------------------ */
export async function listPlans(_req, res) {
  const plans = await planService.listActivePlans();
  return success(res, { plans });
}

export async function listAllPlans(_req, res) {
  const plans = await planService.listAllPlans();
  return success(res, { plans });
}

/* ------------------------------------------------------------------ *
 * Learner payments
 * ------------------------------------------------------------------ */
export async function submitPayment(req, res) {
  const txn = await paymentService.submitPayment(
    req.user,
    {
      planId: req.body.planId,
      payerName: req.body.payerName,
      payerPhone: req.body.payerPhone,
      transactionReference: req.body.transactionReference,
      paymentMessage: req.body.paymentMessage,
    },
    req.file,
  );
  await recordActivity(req, {
    action: 'payment.submit',
    resource: 'payment',
    resourceId: txn._id,
    meta: { planCode: txn.planCode, amount: txn.amount, currency: txn.currency },
  });
  return success(res, { payment: txn }, 201);
}

export async function listMyPayments(req, res) {
  const result = await paymentService.listMyPayments(req.user._id, req.query);
  return success(res, result);
}

export async function getMyPayment(req, res) {
  const payment = await paymentService.getMyPayment(req.user._id, req.params.id);
  return success(res, { payment });
}

export async function getMyPaymentStatus(req, res) {
  const [latest, access] = await Promise.all([
    paymentService.getLatestActivePayment(req.user._id),
    entitlementService.getAccessState(req.user._id),
  ]);
  return success(res, { payment: latest, access });
}

export async function listMySubscriptions(req, res) {
  const subscriptions = await subscriptionService.listUserSubscriptions(req.user._id);
  return success(res, { subscriptions });
}

/**
 * Streams a payment proof image. Accessible to the owning learner or a billing
 * administrator only; anyone else receives 403.
 */
export async function getPaymentProof(req, res) {
  const txn = await paymentService.getTransactionForProof(req.params.id);
  if (!txn) throw ApiError.notFound('Ubwishyu ntibwabonetse', 'PAYMENT_NOT_FOUND');
  if (!paymentService.canViewProof(txn, req.user)) {
    throw ApiError.forbidden('Nta bwemererwa bwo kureba iyi foto', 'PROOF_FORBIDDEN');
  }
  if (!txn.proofImagePublicId) {
    throw ApiError.notFound('Iyi fishi nta foto ifite', 'PROOF_NOT_FOUND');
  }
  await streamProof(txn.proofImagePublicId, res);
}

/* ------------------------------------------------------------------ *
 * Admin payments
 * ------------------------------------------------------------------ */
export async function adminListPayments(req, res) {
  const result = await paymentService.listPaymentsForAdmin(req.query);
  return success(res, result);
}

export async function adminGetPayment(req, res) {
  const payment = await paymentService.getPaymentForAdmin(req.params.id);
  return success(res, { payment });
}

export async function adminApprovePayment(req, res) {
  const { transaction, subscription } = await paymentService.approvePayment(req.user, req.params.id, {
    note: req.body?.note,
  });
  await recordActivity(req, {
    action: 'payment.approve',
    resource: 'payment',
    resourceId: transaction._id,
    meta: { planCode: transaction.planCode, subscriptionId: subscription?._id, order: transaction.planCode },
  });
  return success(res, { payment: transaction, subscription });
}

export async function adminDenyPayment(req, res) {
  const transaction = await paymentService.denyPayment(req.user, req.params.id, { reason: req.body?.reason });
  await recordActivity(req, {
    action: 'payment.deny',
    resource: 'payment',
    resourceId: transaction._id,
    meta: { planCode: transaction.planCode, reason: transaction.denialReason },
  });
  return success(res, { payment: transaction });
}

/* ------------------------------------------------------------------ *
 * Admin plan management
 * ------------------------------------------------------------------ */
export async function adminCreatePlan(req, res) {
  const plan = await planService.createPlan(req.body, req.user._id);
  await recordActivity(req, { action: 'plan.create', resource: 'plan', resourceId: plan._id, meta: { code: plan.code } });
  return success(res, { plan }, 201);
}

export async function adminUpdatePlan(req, res) {
  const plan = await planService.updatePlan(req.params.id, req.body, req.user._id);
  await recordActivity(req, { action: 'plan.update', resource: 'plan', resourceId: plan._id, meta: { code: plan.code } });
  return success(res, { plan });
}

export async function adminDeactivatePlan(req, res) {
  const plan = await planService.deactivatePlan(req.params.id, req.user._id);
  await recordActivity(req, { action: 'plan.deactivate', resource: 'plan', resourceId: plan._id, meta: { code: plan.code } });
  return success(res, { plan });
}

export default {
  listPlans,
  listAllPlans,
  submitPayment,
  listMyPayments,
  getMyPayment,
  getMyPaymentStatus,
  listMySubscriptions,
  getPaymentProof,
  adminListPayments,
  adminGetPayment,
  adminApprovePayment,
  adminDenyPayment,
  adminCreatePlan,
  adminUpdatePlan,
  adminDeactivatePlan,
};
