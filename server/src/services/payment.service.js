import mongoose from 'mongoose';
import { PaymentTransaction, Subscription, Settings, Plan } from '../models/index.js';
import { getPurchasablePlan } from './plan.service.js';
import { canonicalPhone, isValidRwandaPhone } from '../utils/phone.js';
import { notify } from './notification.service.js';
import { parsePagination, paginated, textSearchFilter } from '../utils/pagination.js';
import { storeProof } from './proof-storage.service.js';
import { effectivePermissions, PERMISSIONS } from '../constants/permissions.js';
import ApiError from '../utils/api-error.js';

const DUPLICATE_COOLDOWN_MS = 60 * 1000; // block accidental double submit within 1 min

function verificationWindowMs(windowHours) {
  return Math.max(1, Number(windowHours) || 3) * 60 * 60 * 1000;
}

/**
 * Approves atomically: only a transaction still in a reviewable state can be
 * claimed. This makes concurrent/duplicate approvals impossible — the loser of
 * the race gets a 409 and no second subscription is ever created.
 */
async function claimForReview(txnId, reviewerId) {
  return PaymentTransaction.findOneAndUpdate(
    { _id: txnId, status: { $in: ['PENDING_REVIEW', 'UNDER_REVIEW'] } },
    { $set: { status: 'UNDER_REVIEW', reviewedBy: reviewerId } },
    { new: true },
  );
}

/**
 * Submits a manual Mobile Money payment with a proof screenshot. Validates the
 * plan, the payer phone, duplicate protection and the 3-hour verification
 * window (persisted as `expiresAt`).
 */
export async function submitPayment(user, input, file) {
  if (!user) throw ApiError.unauthorized();

  const plan = await getPurchasablePlan(input.planId);
  const settings = await Settings.getSettings();
  const paymentCfg = settings.payment || {};

  const payerPhone = canonicalPhone(input.payerPhone);
  if (!isValidRwandaPhone(input.payerPhone)) {
    throw ApiError.badRequest('Nomero ya telefone ntariyo (urugero: 078xxxxxxx)', 'INVALID_PHONE');
  }

  // Duplicate protection: a learner may not spam pending payments for a plan.
  const recent = await PaymentTransaction.findOne({
    user: user._id,
    plan: plan._id,
    status: { $in: ['PENDING_REVIEW', 'UNDER_REVIEW'] },
  }).sort({ createdAt: -1 });
  if (recent && Date.now() - new Date(recent.createdAt).getTime() < DUPLICATE_COOLDOWN_MS) {
    throw ApiError.conflict(
      'Usanzwe ufite ubusabe bugiye gukurikiranwa. Tegereza gato.',
      'PAYMENT_DUPLICATE',
    );
  }

  const allowNoProof = Boolean(input.noProof);
  if (!allowNoProof && !file?.buffer?.length) {
    throw ApiError.badRequest('Ifoto y’ubwishyu irakenewe', 'PROOF_REQUIRED');
  }

  let proof = { proofImageUrl: null, proofImagePublicId: null, metadata: null };
  if (file?.buffer?.length) {
    proof = await storeProof(file.buffer, {
      mimeType: file.mimetype,
      originalFilename: file.originalname,
    });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + verificationWindowMs(paymentCfg.verificationWindowHours));

  const txn = await PaymentTransaction.create({
    user: user._id,
    plan: plan._id,
    planCode: plan.code,
    planName: plan.name,
    amount: plan.price,
    currency: plan.currency || paymentCfg.currency || 'RWF',
    durationDays: plan.isLifetime ? null : plan.durationDays,
    isLifetime: plan.isLifetime,
    payerName: String(input.payerName || '').trim(),
    payerPhone,
    recipientPhone: paymentCfg.recipientPhone || '0783632506',
    recipientName: paymentCfg.recipientName || 'Gisubizo Becken',
    transactionReference: input.transactionReference ? String(input.transactionReference).trim() : null,
    paymentMessage: input.paymentMessage ? String(input.paymentMessage).trim() : null,
    proofImageUrl: proof.proofImageUrl,
    proofImagePublicId: proof.proofImagePublicId,
    proofMeta: proof.metadata || {},
    status: 'PENDING_REVIEW',
    submittedAt: now,
    expiresAt,
  });

  await notify(user, {
    type: 'system',
    title: 'Ubwishyu bwakiriwe',
    body: `Ubwishyu bwawe kuri ${plan.name} bwakiriwe. Buzagenzurwa mu masaha 3.`,
    data: { paymentId: String(txn._id), status: txn.status },
  }).catch(() => {});

  return txn;
}

/** Learner's own transaction history. */
export async function listMyPayments(userId, query = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 10, maxLimit: 50 });
  const filter = { user: userId };
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    PaymentTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    PaymentTransaction.countDocuments(filter),
  ]);
  return paginated(items, total, { page, limit });
}

/** Latest active/pending transaction, used for the status/countdown banner. */
export async function getLatestActivePayment(userId) {
  return PaymentTransaction.findOne({
    user: userId,
    status: { $in: ['PENDING_REVIEW', 'UNDER_REVIEW'] },
  }).sort({ createdAt: -1 });
}

/**
 * Loads a transaction for its owner. Automatically flips an overdue pending
 * transaction to EXPIRED before returning it so learners never see stale state.
 */
export async function getMyPayment(userId, txnId) {
  if (!mongoose.isValidObjectId(txnId)) {
    throw ApiError.badRequest('Indangamuntu y’ubwishyu ntariyo', 'INVALID_PAYMENT_ID');
  }
  await expireIfDue(txnId);
  const txn = await PaymentTransaction.findOne({ _id: txnId, user: userId }).lean();
  if (!txn) throw ApiError.notFound('Ubwishyu ntibwabonetse', 'PAYMENT_NOT_FOUND');
  return txn;
}

/** Flips a single due transaction to EXPIRED. Idempotent. */
export async function expireIfDue(txnId, now = new Date()) {
  const res = await PaymentTransaction.updateOne(
    { _id: txnId, status: 'PENDING_REVIEW', expiresAt: { $lte: now } },
    { $set: { status: 'EXPIRED', reviewedAt: now } },
  );
  return res.modifiedCount > 0;
}

/** Bulk expiry sweep; called lazily from admin/user read endpoints. */
export async function expireOverdue(now = new Date()) {
  const res = await PaymentTransaction.updateMany(
    { status: 'PENDING_REVIEW', expiresAt: { $lte: now } },
    { $set: { status: 'EXPIRED', reviewedAt: now } },
  );
  return res.modifiedCount;
}

// --- Admin ---

export async function listPaymentsForAdmin(query = {}) {
  await expireOverdue();
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.planCode) filter.planCode = query.planCode;
  if (query.userId && mongoose.isValidObjectId(query.userId)) filter.user = query.userId;
  const search = textSearchFilter(query.search, [
    'payerName',
    'payerPhone',
    'transactionReference',
    'planName',
  ]);
  if (search) Object.assign(filter, search);

  const [items, total, counts] = await Promise.all([
    PaymentTransaction.find(filter)
      .sort({ status: 1, submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'fullName email phone')
      .lean(),
    PaymentTransaction.countDocuments(filter),
    countByStatus(),
  ]);
  return { ...paginated(items, total, { page, limit }), counts };
}

async function countByStatus() {
  const rows = await PaymentTransaction.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const counts = { PENDING_REVIEW: 0, UNDER_REVIEW: 0, APPROVED: 0, DENIED: 0, EXPIRED: 0, total: 0 };
  for (const row of rows) {
    counts[row._id] = row.count;
    counts.total += row.count;
  }
  return counts;
}

export async function getPaymentForAdmin(txnId) {
  if (!mongoose.isValidObjectId(txnId)) {
    throw ApiError.badRequest('Indangamuntu y’ubwishyu ntariyo', 'INVALID_PAYMENT_ID');
  }
  await expireIfDue(txnId);
  const txn = await PaymentTransaction.findById(txnId)
    .populate('user', 'fullName email phone')
    .populate('reviewedBy', 'fullName email')
    .lean();
  if (!txn) throw ApiError.notFound('Ubwishyu ntibwabonetse', 'PAYMENT_NOT_FOUND');
  let subscription = null;
  if (txn.subscription) {
    subscription = await Subscription.findById(txn.subscription).lean();
  }
  return { ...txn, subscription };
}

/**
 * Approves a payment and activates the subscription. Idempotent + atomic:
 *  - claims the transaction with a guarded findOneAndUpdate
 *  - creates the subscription once (unique index on `payment`)
 *  - if a subscription already exists for this payment, returns it untouched
 */
export async function approvePayment(admin, txnId, { note } = {}) {
  await expireIfDue(txnId);
  const claimed = await claimForReview(txnId, admin._id);
  if (!claimed) {
    const existing = await PaymentTransaction.findById(txnId).lean();
    if (!existing) throw ApiError.notFound('Ubwishyu ntibwabonetse', 'PAYMENT_NOT_FOUND');
    if (existing.status === 'APPROVED') {
      throw ApiError.conflict('Ubu bwishyu bwemejwe mbere', 'PAYMENT_ALREADY_APPROVED');
    }
    if (existing.status === 'DENIED') {
      throw ApiError.conflict('Ubu bwishyu bwanze mbere', 'PAYMENT_ALREADY_DENIED');
    }
    if (existing.status === 'EXPIRED') {
      throw ApiError.conflict('Ubu bwishyu bwarangiye igihe', 'PAYMENT_EXPIRED');
    }
    throw ApiError.conflict('Ubu bwishyu ntibwemewe ubu', 'PAYMENT_NOT_REVIEWABLE');
  }

  // Reuse an existing subscription for this payment when present (idempotency).
  let subscription = await Subscription.findOne({ payment: claimed._id });
  if (!subscription) {
    const now = new Date();
    // Snapshot the plan's entitlements so later plan edits never affect this
    // already-purchased subscription.
    const planDoc = await Plan.findById(claimed.plan).lean();
    const expiresAt = claimed.isLifetime
      ? null
      : new Date(now.getTime() + (claimed.durationDays || 0) * 24 * 60 * 60 * 1000);
    try {
      subscription = await Subscription.create({
        user: claimed.user,
        plan: claimed.plan,
        planCode: claimed.planCode,
        planName: claimed.planName,
        payment: claimed._id,
        amount: claimed.amount,
        currency: claimed.currency,
        isLifetime: claimed.isLifetime,
        durationDays: claimed.isLifetime ? null : claimed.durationDays,
        entitlements: planDoc?.entitlements || undefined,
        status: 'active',
        activatedAt: now,
        expiresAt,
        approvedBy: admin._id,
      });
    } catch (err) {
      // Unique index race: another request created it first. Reuse it.
      if (err?.code === 11000) {
        subscription = await Subscription.findOne({ payment: claimed._id });
      } else {
        throw err;
      }
    }
  }

  const updated = await PaymentTransaction.findOneAndUpdate(
    { _id: claimed._id, status: 'UNDER_REVIEW' },
    {
      $set: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: admin._id,
        subscription: subscription?._id || null,
        denialReason: note ? String(note).slice(0, 300) : null,
      },
    },
    { new: true },
  );

  if (updated) {
    await notify(
      { _id: claimed.user },
      {
        type: 'system',
        title: 'Ubwishyu bwemejwe',
        body: `${claimed.planName} yatangiye! Ubu ufite ubwenge bwose.`,
        data: { paymentId: String(claimed._id), subscriptionId: String(subscription?._id || '') },
      },
    ).catch(() => {});
  }

  return { transaction: updated || claimed, subscription };
}

/** Denies a pending payment with an optional reason. Immutable afterwards. */
export async function denyPayment(admin, txnId, { reason } = {}) {
  await expireIfDue(txnId);
  const trimmedReason = reason ? String(reason).trim().slice(0, 300) : null;
  if (!trimmedReason || trimmedReason.length < 3) {
    throw ApiError.badRequest('Impamvu yo kwanga irakenewe', 'DENY_REASON_REQUIRED');
  }

  const denied = await PaymentTransaction.findOneAndUpdate(
    { _id: txnId, status: { $in: ['PENDING_REVIEW', 'UNDER_REVIEW'] } },
    {
      $set: {
        status: 'DENIED',
        reviewedAt: new Date(),
        reviewedBy: admin._id,
        denialReason: trimmedReason,
      },
    },
    { new: true },
  );

  if (!denied) {
    const existing = await PaymentTransaction.findById(txnId).lean();
    if (!existing) throw ApiError.notFound('Ubwishyu ntibwabonetse', 'PAYMENT_NOT_FOUND');
    if (existing.status === 'APPROVED') {
      throw ApiError.conflict('Ubu bwishyu bwemejwe mbere ntibushobora kwangwa', 'PAYMENT_ALREADY_APPROVED');
    }
    if (existing.status === 'DENIED') {
      throw ApiError.conflict('Ubu bwishyu bwanze mbere', 'PAYMENT_ALREADY_DENIED');
    }
    if (existing.status === 'EXPIRED') {
      throw ApiError.conflict('Ubu bwishyu bwarangiye igihe', 'PAYMENT_EXPIRED');
    }
    throw ApiError.conflict('Ubu bwishyu ntibwemewe ubu', 'PAYMENT_NOT_REVIEWABLE');
  }

  await notify(
    { _id: denied.user },
    {
      type: 'system',
      title: 'Ubwishyu bwanze',
      body: `Ubwishyu bwawe kuri ${denied.planName} bwanze. Impamvu: ${trimmedReason}`,
      data: { paymentId: String(denied._id), status: 'DENIED' },
    },
  ).catch(() => {});

  return denied;
}

/** Access check for proof downloads: owner or billing admin only. */
export function canViewProof(txn, requester) {
  if (!txn || !requester) return false;
  if (String(txn.user?._id || txn.user) === String(requester._id)) return true;
  return effectivePermissions(requester).includes(PERMISSIONS.BILLING_MANAGE);
}

/**
 * Finds the transaction that owns a given proof image. Accepts either the
 * transaction id or the GridFS proof id (the latter is what `proofImageUrl`
 * embeds and what clients actually request).
 */
export async function getTransactionForProof(idOrProofId) {
  if (!mongoose.isValidObjectId(idOrProofId)) return null;
  return PaymentTransaction.findOne({
    $or: [{ proofImagePublicId: idOrProofId }, { _id: idOrProofId }],
  });
}

export default {
  submitPayment,
  listMyPayments,
  getLatestActivePayment,
  getMyPayment,
  expireIfDue,
  expireOverdue,
  listPaymentsForAdmin,
  getPaymentForAdmin,
  approvePayment,
  denyPayment,
  canViewProof,
  getTransactionForProof,
  verificationWindowMs,
};
