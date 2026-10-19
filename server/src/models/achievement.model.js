import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Achievement definitions. Evaluation is driven by `criteria.type` so new
 * badges can be added without code changes for the simple cases.
 */
const achievementSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'award' },
    xp: { type: Number, default: 50 },
    criteria: {
      type: { type: String, required: true },
      threshold: { type: Number, default: 1 },
    },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const CRITERIA_TYPES = [
  'tests_completed',
  'questions_studied',
  'questions_correct',
  'perfect_score',
  'streak_days',
  'accuracy',
  'bookmarks_created',
  'mistakes_reviewed',
];

export const Achievement = mongoose.model('Achievement', achievementSchema);
export default Achievement;
