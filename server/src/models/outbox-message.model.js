import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Development/support mailbox. When no SMTP transport is configured, outgoing
 * email (verification OTPs, password reset links, ...) is stored here and can
 * be inspected by admins instead of silently disappearing.
 */
const outboxSchema = new Schema(
  {
    to: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    text: { type: String, default: '' },
    purpose: { type: String, default: 'generic', index: true },
    delivered: { type: Boolean, default: false },
    error: { type: String, default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

outboxSchema.index({ createdAt: -1 });

export const OutboxMessage = mongoose.model('OutboxMessage', outboxSchema);
export default OutboxMessage;
