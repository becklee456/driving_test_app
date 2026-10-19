import mongoose from 'mongoose';

const { Schema } = mongoose;

export const QUIZ_TYPES = ['study', 'practice', 'mock', 'mistakes', 'bookmarks', 'category', 'daily'];
export const QUIZ_STATUS = ['in_progress', 'submitted', 'expired'];

const quizQuestionSchema = new Schema(
  {
    question: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    order: { type: Number, default: 0 },
    category: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
  },
  { _id: false },
);

const answerSchema = new Schema(
  {
    question: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    selectedOptionId: { type: String, default: null },
    correct: { type: Boolean, default: false },
    answered: { type: Boolean, default: false },
    timeSpentMs: { type: Number, default: 0 },
    answeredAt: { type: Date, default: null },
  },
  { _id: false },
);

const quizSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: QUIZ_TYPES, default: 'practice', index: true },
    title: { type: String, default: '' },
    status: { type: String, enum: QUIZ_STATUS, default: 'in_progress', index: true },

    config: {
      requestedCount: { type: Number, default: 20 },
      categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
      difficulty: { type: String, default: 'all' },
      mode: { type: String, enum: ['random', 'sequential', 'incorrect', 'bookmarked'], default: 'random' },
      feedbackMode: { type: String, enum: ['immediate', 'end'], default: 'immediate' },
      passingScore: { type: Number, default: null },
    },

    questions: { type: [quizQuestionSchema], default: [] },
    answers: { type: [answerSchema], default: [] },

    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },
    timeLimitSec: { type: Number, default: null },
    expiresAt: { type: Date, default: null },

    score: {
      total: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      incorrect: { type: Number, default: 0 },
      unanswered: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 },
      passed: { type: Boolean, default: false },
      passingScore: { type: Number, default: null },
      byCategory: [{ type: Schema.Types.Mixed }],
    },
    durationSec: { type: Number, default: 0 },
  },
  { timestamps: true },
);

quizSchema.index({ user: 1, createdAt: -1 });
quizSchema.index({ user: 1, status: 1, type: 1 });
quizSchema.index({ createdAt: -1 });

export const Quiz = mongoose.model('Quiz', quizSchema);
export default Quiz;
