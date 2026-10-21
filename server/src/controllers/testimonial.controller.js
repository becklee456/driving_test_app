import { Testimonial } from '../models/index.js';
import { success } from '../middleware/error.js';
import { recordActivity } from '../middleware/audit.js';
import ApiError from '../utils/api-error.js';

export async function listTestimonials(req, res) {
  const testimonials = await Testimonial.find({ isActive: true }).sort({ order: 1, createdAt: -1 }).lean();
  return success(res, { testimonials });
}

export async function adminListTestimonials(req, res) {
  const testimonials = await Testimonial.find().sort({ order: 1, createdAt: -1 }).lean();
  return success(res, { testimonials });
}

export async function getTestimonial(req, res) {
  const testimonial = await Testimonial.findById(req.params.id).lean();
  if (!testimonial) throw ApiError.notFound('Ubufasha ntibubonetse', 'TESTIMONIAL_NOT_FOUND');
  return success(res, { testimonial });
}

export async function createTestimonial(req, res) {
  const payload = {
    ...req.body,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  };
  const testimonial = await Testimonial.create(payload);
  await recordActivity(req, { action: 'testimonial.create', resource: 'testimonial', resourceId: testimonial._id });
  return success(res, { testimonial }, 201);
}

export async function updateTestimonial(req, res) {
  const testimonial = await Testimonial.findById(req.params.id);
  if (!testimonial) throw ApiError.notFound('Ubufasha ntibubonetse', 'TESTIMONIAL_NOT_FOUND');
  Object.assign(testimonial, req.body);
  testimonial.updatedBy = req.user._id;
  await testimonial.save();
  await recordActivity(req, { action: 'testimonial.update', resource: 'testimonial', resourceId: testimonial._id });
  return success(res, { testimonial });
}

export async function deleteTestimonial(req, res) {
  const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
  if (!testimonial) throw ApiError.notFound('Ubufasha ntibubonetse', 'TESTIMONIAL_NOT_FOUND');
  await recordActivity(req, { action: 'testimonial.delete', resource: 'testimonial', resourceId: testimonial._id });
  return success(res, { testimonial });
}

export async function reorderTestimonials(req, res) {
  const order = Array.isArray(req.body.order) ? req.body.order : [];
  const ops = order
    .filter((item) => item?.id)
    .map((item, index) => ({
      updateOne: {
        filter: { _id: item.id },
        update: { $set: { order: Number(item.order ?? index) } },
      },
    }));
  if (ops.length) await Testimonial.bulkWrite(ops);
  return success(res, { success: true });
}

export default { listTestimonials, adminListTestimonials, getTestimonial, createTestimonial, updateTestimonial, deleteTestimonial, reorderTestimonials };
