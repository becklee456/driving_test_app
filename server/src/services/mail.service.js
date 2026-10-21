import config from '../config/env.js';
import logger from '../config/logger.js';
import { OutboxMessage } from '../models/index.js';

/**
 * Mail delivery abstraction. The default "outbox" transport stores messages in
 * MongoDB (and logs them in development) so verification OTPs and reset links
 * are never lost when no SMTP server is configured.
 *
 * To plug in a real provider, implement `deliver()` below (e.g. using
 * nodemailer) and set MAIL_TRANSPORT accordingly.
 */
async function deliver({ to, subject }) {
  if (config.mail.transport === 'console') {
    // Never log the body: it contains OTP/reset codes.
    logger.info(`[mail] -> ${to} | ${subject}`);
    return { delivered: true };
  }
  // "outbox": persist for later inspection by admins / dev tooling.
  return { delivered: false };
}

export async function sendMail({ to, subject, text, purpose = 'generic', meta = {} }) {
  let result = { delivered: false, error: null };
  try {
    result = await deliver({ to, subject, text });
  } catch (err) {
    result = { delivered: false, error: err.message };
    logger.error('Mail delivery failed', { to, subject, error: err.message });
  }

  try {
    await OutboxMessage.create({
      to,
      subject,
      text,
      purpose,
      delivered: result.delivered,
      error: result.error,
      meta,
    });
  } catch (err) {
    logger.error('Failed to store outbox message', { error: err.message });
  }

  return result;
}

export function verificationEmail({ fullName, otp, expiryMinutes }) {
  return {
    subject: `${config.appName}: Emeza konti yawe`,
    text:
      `Muraho ${fullName},\n\n` +
      `Kode yo kwemeza konti yawe ni: ${otp}\n` +
      `Iyi kode irangira mu minota ${expiryMinutes}.\n\n` +
      'Niba utari wiyandikishije, urengagire iyi ubutumwa.\n\n' +
      `${config.appName}`,
  };
}

export function passwordResetEmail({ fullName, token, expiryMinutes }) {
  return {
    subject: `${config.appName}: Hindura ijambo ry’ibanga`,
    text:
      `Muraho ${fullName},\n\n` +
      `Koresha iyi kode uhindure ijambo ry’ibanga: ${token}\n` +
      `Iyi kode irangira mu minota ${expiryMinutes}.\n\n` +
      'Niba utabisabye, urengagire iyi ubutumwa kandi uhindure ijambo ry’ibanga ako kanya.\n\n' +
      `${config.appName}`,
  };
}

export default { sendMail, verificationEmail, passwordResetEmail };
