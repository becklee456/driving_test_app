import * as authService from '../services/auth.service.js';
import { success } from '../middleware/error.js';
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from '../middleware/auth.js';
import { recordActivity, clientIp } from '../middleware/audit.js';

function sessionPayload(result) {
  return {
    user: result.user,
    accessToken: result.session?.accessToken,
    expiresIn: 20 * 60,
  };
}

export async function register(req, res) {
  const result = await authService.register(req.body, req);
  await recordActivity(req, { action: 'auth.register', resource: 'user', resourceId: result.user._id, meta: { email: result.user.email } });
  setAuthCookies(res, result.session);
  return success(res, sessionPayload(result), 201);
}

export async function verifyEmail(req, res) {
  const { user } = await authService.verifyEmail(req.body);
  const session = await authService.issueSession(user, { ip: clientIp(req), userAgent: req.headers['user-agent'] });
  setAuthCookies(res, session);
  await recordActivity(req, { action: 'auth.verify_email', resource: 'user', resourceId: user._id });
  return success(res, sessionPayload({ user, session }));
}

export async function resendVerification(req, res) {
  const result = await authService.resendVerification(req.body.email);
  return success(res, { sent: true, devOtp: result.devOtp });
}

export async function login(req, res) {
  const ip = clientIp(req);
  const result = await authService.login({ ...req.body, ip, userAgent: req.headers['user-agent'] });

  if (result.twoFactorRequired || result.twoFactorSetupRequired) {
    return success(res, {
      twoFactorRequired: Boolean(result.twoFactorRequired),
      twoFactorSetupRequired: Boolean(result.twoFactorSetupRequired),
      challengeToken: result.challengeToken,
    });
  }

  setAuthCookies(res, result.session);
  await recordActivity(req, { action: 'auth.login', resource: 'user', resourceId: result.user._id, meta: { email: result.user.email } });
  return success(res, sessionPayload(result));
}

export async function loginTwoFactor(req, res) {
  const result = await authService.completeTwoFactorLogin({
    ...req.body,
    ip: clientIp(req),
    userAgent: req.headers['user-agent'],
  });
  setAuthCookies(res, result.session);
  await recordActivity(req, { action: 'auth.login_2fa', resource: 'user', resourceId: result.user._id });
  return success(res, { ...sessionPayload(result), usedRecoveryCode: result.usedRecovery });
}

export async function refresh(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
  try {
    const result = await authService.rotateRefreshToken(token, {
      ip: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
    setAuthCookies(res, result.session);
    return success(res, { user: result.user, accessToken: result.session.accessToken, expiresIn: 20 * 60 });
  } catch (err) {
    clearAuthCookies(res);
    throw err;
  }
}

export async function logout(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  await authService.logout(token);
  clearAuthCookies(res);
  return success(res, { loggedOut: true });
}

export async function forgotPassword(req, res) {
  const result = await authService.forgotPassword(req.body.email);
  await recordActivity(req, { action: 'auth.forgot_password', meta: { email: req.body.email } });
  return success(res, result);
}

export async function resetPassword(req, res) {
  const result = await authService.resetPassword({
    ...req.body,
    ip: clientIp(req),
    userAgent: req.headers['user-agent'],
  });
  setAuthCookies(res, result.session);
  return success(res, sessionPayload(result));
}

export async function changePassword(req, res) {
  const result = await authService.changePassword(req.user, req.body);
  setAuthCookies(res, result.session);
  await recordActivity(req, { action: 'auth.change_password', resource: 'user', resourceId: req.user._id });
  return success(res, sessionPayload(result));
}

export default {
  register,
  verifyEmail,
  resendVerification,
  login,
  loginTwoFactor,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
};
