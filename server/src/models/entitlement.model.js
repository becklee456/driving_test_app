import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Server-side usage ledger for a learner's FREE allowance.
 *
 * `answeredQuestionIds` is the authoritative, deduplicated set of distinct
 * questions the learner has ever answered while on the free plan. Because it
 * lives in the database (not the client), refreshing, logging out, switching
 * browsers/devices or editing request bodies cannot reset it.
 *
 * Counters are denormalised for cheap reads but always recomputed from the set
 * when the set changes, so they can never drift.
 */
const entitlementSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },

    freeQuestionsAllowed: { type: Number, default: 40, min: 0 },
    freeQuestionsUsed: { type: Number, default: 0, min: 0 },
    answeredQuestionIds: { type: [Schema.Types.ObjectId], default: [] },
    // Questions held by in-progress quizzes; released on submit or expiry.
    pendingReservedQuestions: { type: Number, default: 0, min: 0 },

    freePracticeAttemptsAllowed: { type: Number, default: 1, min: 0 },
    freePracticeAttemptsUsed: { type: Number, default: 0, min: 0 },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

entitlementSchema.virtual('freeQuestionsRemaining').get(function remaining() {
  return Math.max(0, (this.freeQuestionsAllowed || 0) - (this.freeQuestionsUsed || 0));
});

export const Entitlement = mongoose.model('Entitlement', entitlementSchema);
export default Entitlement;
