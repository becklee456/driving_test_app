import mongoose from 'mongoose';

const { Schema } = mongoose;

const bookmarkSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    question: { type: Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    note: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
);

bookmarkSchema.index({ user: 1, question: 1 }, { unique: true });
bookmarkSchema.index({ user: 1, createdAt: -1 });

export const Bookmark = mongoose.model('Bookmark', bookmarkSchema);
export default Bookmark;
