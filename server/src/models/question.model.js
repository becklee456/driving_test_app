import mongoose from 'mongoose';
import { normalizeQuestionText } from '../utils/slug.js';

const { Schema } = mongoose;

export const QUESTION_STATUS = ['active', 'review', 'inactive'];
export const DIFFICULTIES = ['easy', 'medium', 'hard'];

const optionSchema = new Schema(
  {
    id: { type: String, required: true, trim: true },
    label: { type: String, default: '', trim: true },
    text: { type: String, default: '', trim: true },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false },
);

const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    alt: { type: String, default: '' },
    publicId: { type: String, default: null },
  },
  { _id: false },
);

const questionSchema = new Schema(
  {
    sourceId: { type: String, default: null },
    questionNumber: { type: Number, required: true, index: true },
    questionText: { type: String, required: true, trim: true },
    normalizedText: { type: String, select: false },
    category: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    categorySlug: { type: String, default: null, index: true },
    image: {
      url: { type: String, default: null },
      alt: { type: String, default: '' },
      publicId: { type: String, default: null },
    },
    images: { type: [imageSchema], default: [] },
    options: {
      type: [optionSchema],
      validate: {
        validator: (options) => Array.isArray(options) && options.length >= 2,
        message: 'A question needs at least two options',
      },
    },
    explanation: { type: String, default: null, maxlength: 4000 },
    difficulty: { type: String, enum: DIFFICULTIES, default: 'medium', index: true },
    tags: { type: [String], default: [], index: true },
    source: { type: String, default: 'manual' },
    status: { type: String, enum: QUESTION_STATUS, default: 'active', index: true },
    examinable: { type: Boolean, default: true, index: true },
    flags: { type: [String], default: [] },
    needsReview: { type: Boolean, default: false, index: true },
    stats: {
      timesAnswered: { type: Number, default: 0 },
      timesCorrect: { type: Number, default: 0 },
      timesMissed: { type: Number, default: 0 },
      reportsCount: { type: Number, default: 0 },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

questionSchema.index({ questionText: 'text', tags: 'text' });
questionSchema.index({ status: 1, examinable: 1, category: 1 });
questionSchema.index({ sourceId: 1 }, { unique: true, partialFilterExpression: { sourceId: { $type: 'string' } } });
questionSchema.index({ normalizedText: 1 });
questionSchema.index({ 'stats.timesAnswered': -1 });

questionSchema.pre('validate', function setDerived(next) {
  if (this.questionText) this.normalizedText = normalizeQuestionText(this.questionText);
  if (Array.isArray(this.options)) {
    const correct = this.options.filter((o) => o.isCorrect).length;
    const withText = this.options.filter((o) => o.text && o.text.trim()).length;
    this.examinable = correct === 1 && withText >= 2;
    if (!this.examinable && this.status === 'active') {
      // cannot be scored: keep it visible in study mode but out of exams
      this.needsReview = true;
    }
  }
  const selected = this.options?.filter((o) => o.isCorrect) || [];
  if (selected.length > 1) this.needsReview = true;
  next();
});

questionSchema.methods.toStudentJSON = function toStudentJSON({ includeCorrect = false } = {}) {
  return {
    id: this._id,
    sourceId: this.sourceId,
    questionNumber: this.questionNumber,
    questionText: this.questionText,
    category: this.category,
    categorySlug: this.categorySlug,
    image: this.image?.url ? this.image : null,
    images: (this.images || []).filter((i) => i.url).map((i) => ({ url: i.url, alt: i.alt || '' })),
    difficulty: this.difficulty,
    tags: this.tags,
    status: this.status,
    hasExplanation: Boolean(this.explanation),
    options: this.options.map((o) => ({
      id: o.id,
      label: o.label,
      text: o.text,
      ...(includeCorrect ? { isCorrect: o.isCorrect } : {}),
    })),
    ...(includeCorrect
      ? {
          explanation: this.explanation,
          correctOptionIds: this.options.filter((o) => o.isCorrect).map((o) => o.id),
        }
      : {}),
  };
};

export const Question = mongoose.model('Question', questionSchema);
export default Question;
