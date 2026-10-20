import mongoose from 'mongoose';

const { Schema } = mongoose;

export const PAYMENT_STATUS = ['PENDING_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'DENIED', 'EXPIRED'];

/**
 * An append-only, immutable financial record of a manual Mobile Money payment.
 *
 * Only four fields may ever change after creation, and only through an
 * authorised review action (approve/deny/expire):
 *   status, reviewedAt, reviewedBy, denialReason
 *
 * Every other field is a historical snapshot and must never be mutated. There
 * is intentionally NO application API that deletes a transaction.
 */
const paymentTransactionSchema = new Schema(
  {
    // --- Learner + plan snapshot (immutable) ---
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: Schema.Types.ObjectId, ref: 'Plan', required: true, index: true },
    planCode: { type: String, required: true },
    planName: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'RWF', trim: true, uppercase: true, maxlength: 8 },
    durationDays: { type: Number, default: null },
    isLifetime: { type: Boolean, default: false },

    // --- Payer-submitted data (immutable) ---
    payerName: { type: String, required: true, trim: true, maxlength: 120 },
    payerPhone: { type: String, required: true, trim: true, maxlength: 20 },
    recipientPhone: { type: String, required: true, trim: true, maxlength: 20 },
    recipientName: { type: String, required: true, trim: true, maxlength: 120 },
    transactionReference: { type: String, default: null, trim: true, maxlength: 80 },
    paymentMessage: { type: String, default: null, trim: true, maxlength: 500 },

    // --- Proof of payment (immutable) ---
    proofImageUrl: { type: String, default: null },
    proofImagePublicId: { type: String, default: null },
    proofMeta: {
      originalFilename: { type: String, default: null },
      mimeType: { type: String, default: null },
      fileSize: { type: Number, default: null },
      uploadedAt: { type: Date, default: null },
    },

    // --- Review state (the only mutable fields) ---
    status: { type: String, enum: PAYMENT_STATUS, default: 'PENDING_REVIEW', index: true },
    submittedAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, required: true, index: true },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    denialReason: { type: String, default: null, maxlength: 300 },

    // --- Link to the subscription created on approval (idempotency) ---
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription', default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

paymentTransactionSchema.index({ user: 1, status: 1, submittedAt: -1 });
paymentTransactionSchema.index({ user: 1, createdAt: -1 });
paymentTransactionSchema.index({ status: 1, submittedAt: -1 });
paymentTransactionSchema.index({ status: 1, expiresAt: 1 });
paymentTransactionSchema.index({ transactionReference: 1 });

paymentTransactionSchema.virtual('isExpired').get(function isExpired() {
  return this.status === 'PENDING_REVIEW' && this.expiresAt && this.expiresAt.getTime() < Date.now();
});

export const PaymentTransaction = mongoose.model('PaymentTransaction', paymentTransactionSchema);
export default PaymentTransaction;
