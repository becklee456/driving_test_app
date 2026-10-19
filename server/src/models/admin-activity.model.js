import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Immutable audit trail for administrative and security-sensitive actions. */
const adminActivitySchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorEmail: { type: String, default: null },
    actorRole: { type: String, default: null },
    action: { type: String, required: true, index: true },
    resource: { type: String, default: null, index: true },
    resourceId: { type: String, default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    result: { type: String, enum: ['success', 'failure'], default: 'success', index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

adminActivitySchema.index({ createdAt: -1 });
adminActivitySchema.index({ actor: 1, createdAt: -1 });

export const AdminActivity = mongoose.model('AdminActivity', adminActivitySchema);
export default AdminActivity;
