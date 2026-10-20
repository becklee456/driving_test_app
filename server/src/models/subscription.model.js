import mongoose from 'mongoose';
import { entitlementsSchema } from './plan.model.js';

const { Schema } = mongoose;

export const SUBSCRIPTION_STATUS = ['active', 'expired', 'cancelled'];

/**
 * A learner's premium entitlement period, created ONLY when an administrator
 * approves a payment. Lifetime subscriptions use expiresAt = null (never fake
 * a lifetime with a far-future date).
 */
const subscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
    planCode: { type: String, required: true },
    planName: { type: String, required: true },

    // The payment transaction that funded this subscription (1:1, idempotency key).
    payment: { type: Schema.Types.ObjectId, ref: 'PaymentTransaction', required: true, unique: true },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'RWF', trim: true, uppercase: true, maxlength: 8 },

    isLifetime: { type: Boolean, default: false },
    durationDays: { type: Number, default: null },

    // Entitlements frozen at approval time (copied from the plan). Later plan
    // price/entitlement edits never change already-activated subscriptions.
    entitlements: { type: entitlementsSchema(), default: () => ({}) },

    status: { type: String, enum: SUBSCRIPTION_STATUS, default: 'active', index: true },
    activatedAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, default: null, index: true },

    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

subscriptionSchema.index({ user: 1, status: 1, expiresAt: -1 });
subscriptionSchema.index({ user: 1, activatedAt: -1 });

subscriptionSchema.methods.isActive = function isActive(now = new Date()) {
  if (this.status !== 'active') return false;
  if (this.isLifetime || !this.expiresAt) return true;
  return this.expiresAt.getTime() > now.getTime();
};

export const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
