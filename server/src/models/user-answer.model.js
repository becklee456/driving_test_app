import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * One record per answered question, kept separately from the quiz document so
 * that per-question analytics and mistake history stay cheap to query.
 */
const userAnswerSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    question: { type: Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    quizType: { type: String, default: 'practice', index: true },
    selectedOptionId: { type: String, default: null },
    correctOptionId: { type: String, default: null },
    correct: { type: Boolean, default: false, index: true },
    answered: { type: Boolean, default: true },
    timeSpentMs: { type: Number, default: 0 },
    answeredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

userAnswerSchema.index({ user: 1, question: 1, answeredAt: -1 });
userAnswerSchema.index({ user: 1, correct: 1, quizType: 1 });

export const UserAnswer = mongoose.model('UserAnswer', userAnswerSchema);
export default UserAnswer;
