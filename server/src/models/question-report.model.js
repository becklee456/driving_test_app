import mongoose from 'mongoose';

const { Schema } = mongoose;

export const REPORT_REASONS = [
  'incorrect-answer',
  'typo',
  'missing-option',
  'image-problem',
  'unclear-question',
  'duplicate',
  'other',
];

export const REPORT_STATUS = ['pending', 'under_review', 'resolved', 'rejected'];

const reportSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    question: { type: Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    reason: { type: String, enum: REPORT_REASONS, required: true, index: true },
    message: { type: String, default: '', maxlength: 1000 },
    status: { type: String, enum: REPORT_STATUS, default: 'pending', index: true },
    handledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    handledAt: { type: Date, default: null },
    resolutionNote: { type: String, default: '', maxlength: 1000 },
  },
  { timestamps: true },
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ question: 1, status: 1 });

export const QuestionReport = mongoose.model('QuestionReport', reportSchema);
export default QuestionReport;
