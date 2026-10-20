import mongoose from 'mongoose';

const { Schema } = mongoose;

export const PLAN_INTERVALS = ['day', 'week', 'month', 'year', 'lifetime'];

/** Unlimited sentinel for numeric entitlement quotas. */
export const UNLIMITED = -1;

/**
 * Per-plan entitlements enforced server-side. Numeric quotas use -1 for
 * unlimited and 0 for disabled. These are snapshotted onto the Subscription
 * at approval time so later plan edits never change active subscriptions.
 */
export function entitlementsSchema() {
  return new Schema(
    {
      dailyQuestions: { type: Number, default: UNLIMITED, min: -1 },
      dailyMockExams: { type: Number, default: UNLIMITED, min: -1 },
      dailyAIAnswers: { type: Number, default: 0, min: -1 },
      mistakeReview: { type: Boolean, default: true },
      advancedAnalytics: { type: Boolean, default: false },
      downloadableReports: { type: Boolean, default: false },
      adFree: { type: Boolean, default: true },
      prioritySupport: { type: Boolean, default: false },
    },
    { _id: false },
  );
}

/**
 * A purchasable premium plan. Prices, durations, badges and entitlements are
 * managed from the admin panel and never hard-coded in the client. Plans are
 * soft deactivated (isActive=false) rather than deleted so that historical
 * payment transactions keep pointing at a valid snapshot record.
 */
const planSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 600 },

    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, default: null, min: 0 },
    currency: { type: String, default: 'RWF', trim: true, uppercase: true, maxlength: 8 },

    durationDays: { type: Number, default: null, min: 1 },
    isLifetime: { type: Boolean, default: false },
    interval: { type: String, enum: PLAN_INTERVALS, default: 'month' },

    badge: { type: String, trim: true, maxlength: 40, default: null },
    features: { type: [String], default: [] },
    entitlements: { type: entitlementsSchema(), default: () => ({}) },

    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    isPopular: { type: Boolean, default: false },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

planSchema.index({ isActive: 1, order: 1 });

planSchema.virtual('durationLabel').get(function durationLabel() {
  if (this.isLifetime) return 'lifetime';
  return `${this.durationDays}d`;
});

/** Normalizes lifetime/duration consistency before validation. */
planSchema.pre('validate', function normalize(next) {
  if (this.isLifetime) {
    this.durationDays = null;
    this.interval = 'lifetime';
  }
  if (this.originalPrice != null && this.originalPrice < this.price) {
    this.invalidate('originalPrice', 'Original price must be greater than or equal to the sale price');
  }
  next();
});

export const Plan = mongoose.model('Plan', planSchema);
export default Plan;
