import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import config from '../config/env.js';
import { ROLES, ALL_PERMISSIONS } from '../constants/permissions.js';

const { Schema } = mongoose;

const gamificationSchema = new Schema(
  {
    xp: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },
    currentStreak: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    lastStudyDate: { type: String, default: null },
    totalStudyDays: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const achievementSchema = new Schema(
  {
    code: { type: String, required: true },
    unlockedAt: { type: Date, default: Date.now },
    seen: { type: Boolean, default: false },
  },
  { _id: false },
);

const notificationPrefsSchema = new Schema(
  {
    studyReminders: { type: Boolean, default: true },
    newContent: { type: Boolean, default: true },
    achievements: { type: Boolean, default: true },
    testResults: { type: Boolean, default: true },
    securityAlerts: { type: Boolean, default: true },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email address is invalid'],
    },
    phone: { type: String, trim: true, default: null },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.USER, index: true },
    permissions: { type: [String], enum: ALL_PERMISSIONS, default: [] },
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended', 'deactivated'],
      default: 'active',
      index: true,
    },

    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },

    verification: {
      emailOtpHash: { type: String, default: null, select: false },
      emailOtpExpiresAt: { type: Date, default: null, select: false },
      emailOtpAttempts: { type: Number, default: 0, select: false },
      emailOtpSentAt: { type: Date, default: null, select: false },
    },

    passwordReset: {
      tokenHash: { type: String, default: null, select: false },
      expiresAt: { type: Date, default: null, select: false },
    },

    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, default: null, select: false },
      pendingSecret: { type: String, default: null, select: false },
      enabledAt: { type: Date, default: null },
      recoveryCodeHashes: { type: [String], default: [], select: false },
    },

    loginSecurity: {
      failedAttempts: { type: Number, default: 0 },
      lockedUntil: { type: Date, default: null },
      lastLoginAt: { type: Date, default: null },
      lastLoginIp: { type: String, default: null },
      passwordChangedAt: { type: Date, default: null },
    },

    preferences: {
      language: { type: String, enum: ['rw', 'en', 'fr'], default: 'rw' },
      dailyGoal: { type: Number, default: 20, min: 5, max: 200 },
      reduceMotion: { type: Boolean, default: false },
      highContrast: { type: Boolean, default: false },
    },

    notificationPreferences: { type: notificationPrefsSchema, default: () => ({}) },
    gamification: { type: gamificationSchema, default: () => ({}) },
    achievements: { type: [achievementSchema], default: [] },

    studyStats: {
      questionsAttempted: { type: Number, default: 0 },
      questionsCorrect: { type: Number, default: 0 },
      testsCompleted: { type: Number, default: 0 },
      totalStudySeconds: { type: Number, default: 0 },
      bestScore: { type: Number, default: 0 },
      lastActiveAt: { type: Date, default: null },
    },

    notes: { type: String, default: '', maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.verification;
        delete ret.passwordReset;
        delete ret.twoFactor?.secret;
        delete ret.twoFactor?.pendingSecret;
        delete ret.twoFactor?.recoveryCodeHashes;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.index({ createdAt: -1 });
userSchema.index({ 'studyStats.lastActiveAt': -1 });
userSchema.index({ fullName: 'text', email: 'text' });

userSchema.virtual('isLocked').get(function isLocked() {
  return Boolean(this.loginSecurity?.lockedUntil && this.loginSecurity.lockedUntil > new Date());
});

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, config.security.bcryptRounds);
  this.loginSecurity.passwordChangedAt = new Date();
};

userSchema.methods.comparePassword = function comparePassword(plain) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.registerFailedLogin = async function registerFailedLogin() {
  const max = config.security.maxLoginAttempts;
  // Atomic guarded increment: concurrent failed logins cannot overshoot the
  // threshold or lose each other's counts (read-modify-write would race).
  const doc = await this.constructor.findOneAndUpdate(
    {
      _id: this._id,
      $or: [
        { 'loginSecurity.lockedUntil': null },
        { 'loginSecurity.lockedUntil': { $exists: false } },
        { 'loginSecurity.lockedUntil': { $lte: new Date() } },
      ],
    },
    { $inc: { 'loginSecurity.failedAttempts': 1 } },
    { new: true },
  );
  if (!doc) return; // currently locked - failed attempts during lockout are ignored
  if (doc.loginSecurity.failedAttempts >= max) {
    await this.constructor.updateOne(
      { _id: this._id },
      {
        $set: {
          'loginSecurity.lockedUntil': new Date(Date.now() + config.security.lockoutMinutes * 60000),
          'loginSecurity.failedAttempts': 0,
        },
      },
    );
  }
  this.loginSecurity = doc.loginSecurity;
};

userSchema.methods.registerSuccessfulLogin = async function registerSuccessfulLogin(ip) {
  this.loginSecurity.failedAttempts = 0;
  this.loginSecurity.lockedUntil = null;
  this.loginSecurity.lastLoginAt = new Date();
  this.loginSecurity.lastLoginIp = ip || null;
  this.studyStats.lastActiveAt = new Date();
  await this.save();
};

userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, config.security.bcryptRounds);

export const User = mongoose.model('User', userSchema);
export default User;
