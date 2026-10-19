import mongoose from 'mongoose';

const { Schema } = mongoose;

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameEn: { type: String, trim: true, default: '' },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '', maxlength: 600 },
    icon: { type: String, default: 'sign' },
    color: { type: String, default: '#2563eb' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    questionCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

categorySchema.index({ order: 1, name: 1 });
categorySchema.index({ isActive: 1 });

export const Category = mongoose.model('Category', categorySchema);
export default Category;
