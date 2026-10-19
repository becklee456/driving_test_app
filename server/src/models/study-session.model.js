import mongoose from 'mongoose';

const { Schema } = mongoose;

const studySessionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mode: { type: String, enum: ['study', 'practice', 'mock', 'mistakes', 'bookmarks'], default: 'study' },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    durationSec: { type: Number, default: 0 },
    questionsViewed: { type: Number, default: 0 },
    questionsAnswered: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    device: { type: String, default: 'unknown' },
  },
  { timestamps: true },
);

studySessionSchema.index({ user: 1, startedAt: -1 });
studySessionSchema.index({ startedAt: -1 });

export const StudySession = mongoose.model('StudySession', studySessionSchema);
export default StudySession;
