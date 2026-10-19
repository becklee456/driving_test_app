import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Refresh tokens are stored hashed. `family` enables refresh-token reuse
 * detection: when a rotated token is replayed the whole family is revoked.
 */
const refreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
    replacedByHash: { type: String, default: null },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ user: 1, revokedAt: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
export default RefreshToken;
