import mongoose from 'mongoose';

const { Schema } = mongoose;

export const NOTIFICATION_TYPES = [
  'study_reminder',
  'new_content',
  'achievement',
  'test_result',
  'security',
  'system',
  'report_update',
];

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: 'system', index: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, default: '', maxlength: 1000 },
    data: { type: Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
