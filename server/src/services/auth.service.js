import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import logger from '../config/logger.js';
import ApiError from '../utils/api-error.js';
import { User, RefreshToken, Settings } from '../models/index.js';
import { generateOtp, randomToken, sha256 } from '../utils/crypto.js';
import { sendMail, verificationEmail, passwordResetEmail } from './mail.service.js';
import { notify } from './notification.service.js';
import { signAccessToken } from '../middleware/auth.js';
import { generateSecret, verifyTotp, otpauthUrl } from './totp.service.js';
import crypto from 'node:crypto';

const CHALLENGE_TTL = '5m';

/* ------------------------------------------------------------------ *
 * Verification codes
 * ------------------------------------------------------------------ */
export async function issueVerificationOtp(user) {
  const otp = generateOtp(config.security.otpLength);
  user.verification.emailOtpHash = sha256(otp);
  user.verification.emailOtpExpiresAt = new Date(Date.now() + config.security.otpExpiryMinutes * 60000);
  user.verification.emailOtpAttempts = 0;
  user.verification.emailOtpSentAt = new Date();
  await user.save();

  const { subject, text } = verificationEmail({
    fullName: user.fullName,
    otp,
    expiryMinutes: config.security.otpExpiryMinutes,
  });
  await sendMail({ to: user.email, subject, text, purpose: 'email_verification', meta: { userId: user._id } });

  return otp;
}

export async function register({ fullName, email, password, phone }, req = {}) {
  const settings = await Settings.getSettings();
  if (!settings.allowRegistration) {
    throw ApiError.forbidden('Kwiyandikisha kwafunzwe by’agateganyo', 'REGISTRATION_DISABLED');
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) throw ApiError.conflict('Iyi email isanzwe yiyandikishije', 'EMAIL_TAKEN');

  const user = new User({ fullName, email: normalizedEmail, phone: phone || null });
  await user.setPassword(password);
  user.status = 'active';
  // Email verification is not enforced yet; new accounts are usable immediately.
  user.emailVerified = true;
  await user.save();

  await notify(user, {
    type: 'system',
    title: 'Murakaza neza!',
    body: 'Konti yawe yafunguwe. Tangira kwiga.',
  });

  const session = await issueSession(user, { ip: req.ip, userAgent: req.headers?.['user-agent'] });

  return { user, session };
}

export async function verifyEmail({ email, otp }) {
  const user = await User.findOne({ email: String(email).toLowerCase() }).select(
    '+verification.emailOtpHash +verification.emailOtpExpiresAt +verification.emailOtpAttempts',
  );
  // Same generic error whether the account exists or not (no enumeration).
  if (!user) throw ApiError.badRequest('Kode ntariyo', 'OTP_INVALID');
  if (user.emailVerified) return { user, alreadyVerified: true };

  const v = user.verification;
  if (!v.emailOtpHash || !v.emailOtpExpiresAt) {
    throw ApiError.badRequest('Nta kode yatumijwe. Saba indi kode.', 'OTP_MISSING');
  }
  if (v.emailOtpExpiresAt < new Date()) {
    throw ApiError.badRequest('Iyi kode yarangiye. Saba indi kode.', 'OTP_EXPIRED');
  }
  if (v.emailOtpAttempts >= 5) {
    throw ApiError.tooMany('Wagerageje kode kenshi. Saba indi kode.', 'OTP_ATTEMPTS');
  }
  if (sha256(String(otp)) !== v.emailOtpHash) {
    v.emailOtpAttempts += 1;
    await user.save();
    throw ApiError.badRequest('Kode ntariyo', 'OTP_INVALID');
  }

  user.emailVerified = true;
  user.verification.emailOtpHash = null;
  user.verification.emailOtpExpiresAt = null;
  user.verification.emailOtpAttempts = 0;
  await user.save();

  await notify(user, { type: 'security', title: 'Email yemejwe', body: 'Konti yawe yemejwe neza.' });
  return { user };
}

export async function resendVerification(email) {
  const user = await User.findOne({ email: String(email).toLowerCase() });
  // Always return success: never reveal whether the account exists or is
  // already verified (anti-enumeration).
  if (!user || user.emailVerified) return { sent: true, devOtp: undefined };

  const last = user.verification.emailOtpSentAt;
  if (last && Date.now() - last.getTime() < 60000) {
    throw ApiError.tooMany('Tegereza akanya mbere yo gusaba indi kode', 'OTP_THROTTLED');
  }
  const otp = await issueVerificationOtp(user);
  return { user, devOtp: config.isDevelopment ? otp : undefined };
}

/* ------------------------------------------------------------------ *
 * Sessions / tokens
 * ------------------------------------------------------------------ */
export async function issueSession(user, { ip, userAgent, family } = {}) {
  const refreshToken = randomToken(48);
  const tokenFamily = family || crypto.randomUUID();
  const expiresAt = new Date(Date.now() + config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    user: user._id,
    tokenHash: sha256(refreshToken),
    family: tokenFamily,
    ip: ip || null,
    userAgent: userAgent || null,
    expiresAt,
  });

  return { accessToken: signAccessToken(user), refreshToken, refreshExpiresAt: expiresAt };
}

function signChallenge(user, purpose) {
  return jwt.sign({ sub: String(user._id), purpose }, config.jwt.accessSecret, {
    expiresIn: CHALLENGE_TTL,
    issuer: 'rwanda-driving-test',
  });
}

function verifyChallenge(token) {
  try {
    return jwt.verify(token, config.jwt.accessSecret, { issuer: 'rwanda-driving-test' });
  } catch {
    return null;
  }
}

export async function login({ email, password, ip, userAgent }) {
  const normalizedEmail = String(email).toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash +twoFactor.secret');

  // Same generic error for unknown email and wrong password (no user enumeration).
  if (!user) {
    throw ApiError.unauthorized('Email cyangwa ijambo ry’ibanga sibyo', 'INVALID_CREDENTIALS');
  }
  if (user.status === 'suspended') throw ApiError.forbidden('Konti yawe ifunzwe', 'ACCOUNT_SUSPENDED');
  if (user.status === 'deactivated') throw ApiError.forbidden('Konti yawe yarafunzwe', 'ACCOUNT_DEACTIVATED');
  if (user.loginSecurity?.lockedUntil && user.loginSecurity.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.loginSecurity.lockedUntil - Date.now()) / 60000);
    throw ApiError.locked(`Konti yawe yafunzwe. Gerageza nyuma y’iminota ${minutes}.`);
  }

  const ok = await user.comparePassword(password);
  if (!ok) {
    await user.registerFailedLogin();
    throw ApiError.unauthorized('Email cyangwa ijambo ry’ibanga sibyo', 'INVALID_CREDENTIALS');
  }

  const settings = await Settings.getSettings();

  if (user.twoFactor?.enabled) {
    return { twoFactorRequired: true, challengeToken: signChallenge(user, '2fa') };
  }

  const isStaff = ['EDITOR', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role);
  if (isStaff && (settings.require2FAForAdmins || config.security.require2FAForAdmins) && !user.twoFactor?.enabled) {
    return { twoFactorSetupRequired: true, challengeToken: signChallenge(user, '2fa_setup') };
  }

  const session = await issueSession(user, { ip, userAgent });
  await user.registerSuccessfulLogin(ip);

  await notify(user, {
    type: 'security',
    title: 'Kwinjira gushya',
    body: `Hari umuntu winjiye kuri konti yawe (IP: ${ip || 'itazwi'}).`,
    data: { ip, userAgent },
  });

  return { user, session };
}

export async function completeTwoFactorLogin({ challengeToken, code, ip, userAgent }) {
  const payload = verifyChallenge(challengeToken);
  if (!payload || payload.purpose !== '2fa') {
    throw ApiError.unauthorized('Igihe cyo kwemeza cyararangiye. Ongera uinjire.', 'CHALLENGE_EXPIRED');
  }
  const user = await User.findById(payload.sub).select('+twoFactor.secret +twoFactor.recoveryCodeHashes');
  if (!user || !user.twoFactor?.enabled) throw ApiError.unauthorized();

  const valid = verifyTotp(user.twoFactor.secret, code);
  let usedRecovery = false;
  if (!valid) {
    const hash = sha256(String(code).trim().toUpperCase());
    const idx = (user.twoFactor.recoveryCodeHashes || []).indexOf(hash);
    if (idx >= 0) {
      user.twoFactor.recoveryCodeHashes.splice(idx, 1);
      await user.save();
      usedRecovery = true;
    }
  }
  if (!valid && !usedRecovery) throw ApiError.unauthorized('Kode ya 2FA ntariyo', 'INVALID_2FA_CODE');

  const session = await issueSession(user, { ip, userAgent });
  await user.registerSuccessfulLogin(ip);
  return { user, session, usedRecovery };
}

export async function rotateRefreshToken(refreshToken, { ip, userAgent }) {
  if (!refreshToken) throw ApiError.unauthorized('Nta token ihari', 'REFRESH_MISSING');
  const hash = sha256(refreshToken);
  const stored = await RefreshToken.findOne({ tokenHash: hash });
  if (!stored) throw ApiError.unauthorized('Icyemezo ntikiriho', 'REFRESH_INVALID');

  if (stored.revokedAt) {
    // Reuse of a rotated token: revoke the whole family (possible token theft).
    await RefreshToken.updateMany(
      { family: stored.family, revokedAt: null },
      { revokedAt: new Date(), revokedReason: 'reuse_detected' },
    );
    logger.warn('Refresh token reuse detected', { user: stored.user, family: stored.family });
    throw ApiError.unauthorized('Icyemezo cyakoreshejwe nabi. Ongera winjire.', 'REFRESH_REUSED');
  }
  if (stored.expiresAt < new Date()) {
    throw ApiError.unauthorized('Igihe cy’icyemezo cyarangiye', 'REFRESH_EXPIRED');
  }

  const user = await User.findById(stored.user);
  if (!user || user.status === 'suspended' || user.status === 'deactivated') {
    throw ApiError.unauthorized();
  }

  const nextRefresh = randomToken(48);
  stored.revokedAt = new Date();
  stored.revokedReason = 'rotated';
  stored.replacedByHash = sha256(nextRefresh);
  await stored.save();

  await RefreshToken.create({
    user: user._id,
    tokenHash: stored.replacedByHash,
    family: stored.family,
    ip: ip || null,
    userAgent: userAgent || null,
    expiresAt: new Date(Date.now() + config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000),
  });

  return { user, session: { accessToken: signAccessToken(user), refreshToken: nextRefresh } };
}

export async function logout(refreshToken) {
  if (!refreshToken) return;
  await RefreshToken.updateOne(
    { tokenHash: sha256(refreshToken), revokedAt: null },
    { revokedAt: new Date(), revokedReason: 'logout' },
  );
}

export async function listSessions(userId) {
  return RefreshToken.find({ user: userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .select('userAgent ip createdAt expiresAt family')
    .lean();
}

export async function revokeSession(userId, id) {
  const res = await RefreshToken.findOneAndUpdate(
    { _id: id, user: userId, revokedAt: null },
    { revokedAt: new Date(), revokedReason: 'revoked_by_user' },
    { new: true },
  );
  if (!res) throw ApiError.notFound('Iyi session ntibonetse', 'SESSION_NOT_FOUND');
  return res;
}

export async function revokeAllSessions(userId, reason = 'revoked_all') {
  const res = await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { revokedAt: new Date(), revokedReason: reason },
  );
  return res.modifiedCount;
}

/* ------------------------------------------------------------------ *
 * Password management
 * ------------------------------------------------------------------ */
export async function forgotPassword(email) {
  const settings = await Settings.getSettings();
  if (!settings.allowSelfServiceReset) {
    throw ApiError.forbidden('Guhindura ijambo ry’ibanga ntibyemewe ubu', 'RESET_DISABLED');
  }
  const user = await User.findOne({ email: String(email).toLowerCase() });
  // Always return success: never reveal whether the account exists.
  if (!user) return { sent: true };

  const token = generateOtp(6);
  user.passwordReset.tokenHash = sha256(token);
  user.passwordReset.expiresAt = new Date(Date.now() + config.security.otpExpiryMinutes * 60000);
  await user.save();

  const { subject, text } = passwordResetEmail({
    fullName: user.fullName,
    token,
    expiryMinutes: config.security.otpExpiryMinutes,
  });
  await sendMail({ to: user.email, subject, text, purpose: 'password_reset', meta: { userId: user._id } });

  return { sent: true, devToken: config.isDevelopment ? token : undefined };
}

export async function resetPassword({ email, token, password, ip, userAgent }) {
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+passwordReset.tokenHash +passwordReset.expiresAt');
  if (!user || !user.passwordReset?.tokenHash || !user.passwordReset?.expiresAt) {
    throw ApiError.badRequest('Ubusabe bwo guhindura ijambo ry’ibanga ntibwemewe', 'RESET_INVALID');
  }
  if (user.passwordReset.expiresAt < new Date()) {
    throw ApiError.badRequest('Igihe cyarangiye. Ongera usabe.', 'RESET_EXPIRED');
  }
  if (sha256(String(token)) !== user.passwordReset.tokenHash) {
    throw ApiError.badRequest('Kode ntariyo', 'RESET_INVALID');
  }

  await user.setPassword(password);
  user.passwordReset.tokenHash = null;
  user.passwordReset.expiresAt = null;
  await user.save();

  await revokeAllSessions(user._id, 'password_reset');

  await notify(user, {
    type: 'security',
    title: 'Ijambo ry’ibanga ryahindutse',
    body: 'Niba atari wowe wabikoze, hamagara ubufasha ako kanya.',
    data: { ip },
  });

  const session = await issueSession(user, { ip, userAgent });
  return { user, session };
}

export async function changePassword(user, { currentPassword, newPassword }) {
  const full = await User.findById(user._id).select('+passwordHash');
  const ok = await full.comparePassword(currentPassword);
  if (!ok) throw ApiError.badRequest('Ijambo ry’ibanga rya none ntiryo', 'INVALID_PASSWORD');
  await full.setPassword(newPassword);
  await full.save();
  await revokeAllSessions(user._id, 'password_changed');
  const session = await issueSession(full, {});
  await notify(full, { type: 'security', title: 'Ijambo ry’ibanga ryahindutse', body: 'Konti yawe iri mu mutekano.' });
  return { user: full, session };
}

/* ------------------------------------------------------------------ *
 * Two-factor authentication
 * ------------------------------------------------------------------ */
export async function begin2faSetup(user) {
  const secret = generateSecret();
  user.twoFactor.pendingSecret = secret;
  await user.save();
  return { secret, otpauthUrl: otpauthUrl({ secret, label: user.email }) };
}

export async function enable2fa(user, code) {
  const full = await User.findById(user._id).select('+twoFactor.pendingSecret');
  if (!full.twoFactor?.pendingSecret) {
    throw ApiError.badRequest('Tangiza gutunganya 2FA mbere', '2FA_NOT_STARTED');
  }
  if (!verifyTotp(full.twoFactor.pendingSecret, code)) {
    throw ApiError.badRequest('Kode ntariyo. Ongera ugerageze.', 'INVALID_2FA_CODE');
  }
  const recoveryCodes = Array.from({ length: 8 }, () => randomToken(4).slice(0, 10).toUpperCase());
  full.twoFactor.secret = full.twoFactor.pendingSecret;
  full.twoFactor.pendingSecret = null;
  full.twoFactor.enabled = true;
  full.twoFactor.enabledAt = new Date();
  full.twoFactor.recoveryCodeHashes = recoveryCodes.map((c) => sha256(c));
  await full.save();
  await notify(full, { type: 'security', title: '2FA yashyizweho', body: 'Konti yawe irinzwe neza kurushaho.' });
  return { recoveryCodes };
}

export async function disable2fa(user, { code, password }) {
  const full = await User.findById(user._id).select('+twoFactor.secret +passwordHash');
  if (!full.twoFactor?.enabled) throw ApiError.badRequest('2FA ntirakoreshwa', '2FA_DISABLED');
  const codeOk = verifyTotp(full.twoFactor.secret, code);
  const passOk = password ? await full.comparePassword(password) : false;
  if (!codeOk && !passOk) throw ApiError.badRequest('Kode cyangwa ijambo ry’ibanga sibyo', 'INVALID_2FA_CODE');
  full.twoFactor.enabled = false;
  full.twoFactor.secret = null;
  full.twoFactor.recoveryCodeHashes = [];
  await full.save();
  await notify(full, { type: 'security', title: '2FA yakuweho', body: 'Niba utabikoze, hindura ijambo ry’ibanga ako kanya.' });
  return { user: full };
}

export default {
  register,
  verifyEmail,
  resendVerification,
  login,
  completeTwoFactorLogin,
  issueSession,
  rotateRefreshToken,
  logout,
  listSessions,
  revokeSession,
  revokeAllSessions,
  forgotPassword,
  resetPassword,
  changePassword,
  begin2faSetup,
  enable2fa,
  disable2fa,
};
