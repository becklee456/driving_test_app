import mongoose from 'mongoose';
import { Subscription } from '../models/index.js';

/**
 * Returns the learner's subscriptions, newest first, with expired ones filtered
 * out of the "current" view but still available in history.
 */
export async function listUserSubscriptions(userId) {
  const now = new Date();
  const subs = await Subscription.find({ user: userId }).sort({ activatedAt: -1 }).lean();
  return subs.map((sub) => ({
    ...sub,
    isCurrentlyActive:
      sub.status === 'active' && (sub.isLifetime || !sub.expiresAt || sub.expiresAt.getTime() > now.getTime()),
  }));
}

/** The single subscription governing current access (lifetime wins, then latest expiry). */
export async function getCurrentSubscription(userId, now = new Date()) {
  return Subscription.findOne({
    user: userId,
    status: 'active',
    $or: [{ isLifetime: true }, { expiresAt: null }, { expiresAt: { $gt: now } }],
  }).sort({ isLifetime: -1, expiresAt: -1 });
}

export async function getSubscriptionById(subId) {
  if (!mongoose.isValidObjectId(subId)) return null;
  return Subscription.findById(subId).lean();
}

export default { listUserSubscriptions, getCurrentSubscription, getSubscriptionById };
