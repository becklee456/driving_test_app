import mongoose from 'mongoose';

const { Schema } = mongoose;

const testimonialSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameRw: { type: String, trim: true, default: '', maxlength: 120 },
    role: { type: String, trim: true, default: '', maxlength: 80 },
    roleRw: { type: String, trim: true, default: '', maxlength: 80 },
    quote: { type: String, required: true, trim: true, maxlength: 1000 },
    quoteRw: { type: String, trim: true, default: '', maxlength: 1000 },
    rating: { type: Number, default: 5, min: 1, max: 5 },
    avatar: { type: String, trim: true, default: '' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

testimonialSchema.index({ order: 1, isActive: 1 });

export const Testimonial = mongoose.model('Testimonial', testimonialSchema);
export default Testimonial;
