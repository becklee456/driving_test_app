import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..', '..');

// Loads ./.env from the working directory (server/ when run via npm). No explicit
// path here: bundlers/File Trace would otherwise try to ship .env in the artifact.
dotenv.config();

const bool = (v, fallback = false) => {
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};
const int = (v, fallback) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

const generated = {};
function secret(name, fallbackName) {
  const value = process.env[name];
  if (value && value.length >= 24) return value;
  if (isProduction) {
    throw new Error(
      `Missing or too short environment variable ${name}. ` +
        `Set a strong value (>= 24 characters) before starting in production.`,
    );
  }
  if (!generated[fallbackName]) {
    generated[fallbackName] = crypto.randomBytes(48).toString('hex');
    console.warn(
      `[config] ${name} is not set - using a temporary random secret. ` +
        'Sessions will be invalidated on every restart. Set it in server/.env.',
    );
  }
  return generated[fallbackName];
}

export const config = {
  env: NODE_ENV,
  isProduction,
  isTest,
  isDevelopment: !isProduction && !isTest,
  port: int(process.env.PORT, 5000),
  appName: process.env.APP_NAME || 'Ikizamini cyo Gutwara',
  logLevel: process.env.LOG_LEVEL || (isTest ? 'silent' : isProduction ? 'info' : 'debug'),

  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  corsOrigins: (process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  mongoUri: isTest
    ? process.env.TEST_MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rwanda_driving_test_test'
    : process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rwanda_driving_test',

  jwt: {
    accessSecret: secret('JWT_ACCESS_SECRET', 'access'),
    refreshSecret: secret('JWT_REFRESH_SECRET', 'refresh'),
    accessTtl: process.env.ACCESS_TOKEN_TTL || '20m',
    refreshTtlDays: int(process.env.REFRESH_TOKEN_TTL_DAYS, 30),
  },

  cookies: {
    secret: secret('COOKIE_SECRET', 'cookie'),
    domain: process.env.COOKIE_DOMAIN || undefined,
    secure: bool(process.env.SECURE_COOKIES, isProduction),
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
  },

  security: {
    maxLoginAttempts: int(process.env.MAX_LOGIN_ATTEMPTS, 5),
    lockoutMinutes: int(process.env.LOCKOUT_MINUTES, 15),
    bcryptRounds: int(process.env.BCRYPT_ROUNDS, isTest ? 4 : 12),
    otpLength: int(process.env.OTP_LENGTH, 6),
    otpExpiryMinutes: int(process.env.OTP_EXPIRY_MINUTES, 15),
    passwordMinLength: int(process.env.PASSWORD_MIN_LENGTH, 8),
    require2FAForAdmins: bool(process.env.REQUIRE_2FA_FOR_ADMINS, false),
    trustProxy: bool(process.env.TRUST_PROXY, isProduction),
  },

  rateLimit: {
    globalWindowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    globalMax: int(process.env.RATE_LIMIT_MAX, 600),
    authWindowMs: int(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    authMax: int(process.env.AUTH_RATE_LIMIT_MAX, 25),
    writeMax: int(process.env.WRITE_RATE_LIMIT_MAX, 120),
  },

  mail: {
    transport: process.env.MAIL_TRANSPORT || 'outbox',
    from: process.env.MAIL_FROM || 'no-reply@ikizamini.rw',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@ikizamini.rw',
    exposeOutbox: bool(process.env.EXPOSE_OUTBOX, !isProduction),
  },

  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@ikizamini.rw',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
    editorEmail: process.env.SEED_EDITOR_EMAIL || 'editor@ikizamini.rw',
    editorPassword: process.env.SEED_EDITOR_PASSWORD || 'Editor@12345',
    moderatorEmail: process.env.SEED_MODERATOR_EMAIL || 'moderator@ikizamini.rw',
    moderatorPassword: process.env.SEED_MODERATOR_PASSWORD || 'Mod@12345',
    studentEmail: process.env.SEED_STUDENT_EMAIL || 'student@ikizamini.rw',
    studentPassword: process.env.SEED_STUDENT_PASSWORD || 'Student@12345',
  },

  questionsFile: path.resolve(SERVER_ROOT, '..', 'data', 'questions.json'),
  importReportFile: path.resolve(SERVER_ROOT, '..', 'data', 'import-report.json'),
  serverRoot: SERVER_ROOT,
};

export default config;
