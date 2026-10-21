import mongoose from 'mongoose';
import { User, Category, Question, Settings, Plan, Subscription } from '../../src/models/index.js';
import { ROLES } from '../../src/constants/permissions.js';
import { invalidateSettingsCache } from '../../src/middleware/settings.js';

/**
 * A buffer that starts with real PNG magic bytes so the proof-upload
 * magic-byte sniffer accepts it (client MIME types are not trusted).
 */
export function fakePngBuffer() {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([header, Buffer.alloc(64, 1)]);
}

export async function createCategory(overrides = {}) {
  return Category.create({
    name: 'Ibimenyetso by’umuhanda',
    slug: 'traffic-signs',
    icon: 'sign',
    color: '#2563eb',
    order: 0,
    ...overrides,
  });
}

export function questionData(category, overrides = {}) {
  return {
    questionNumber: 1,
    questionText: 'Ikinyabiziga kigomba kugira iki?',
    category: category?._id || null,
    categorySlug: category?.slug || null,
    options: [
      { id: 'a', label: 'a', text: 'Umuyobozi', isCorrect: true },
      { id: 'b', label: 'b', text: 'Umuherekeza', isCorrect: false },
      { id: 'c', label: 'c', text: 'Nta muntu', isCorrect: false },
    ],
    difficulty: 'medium',
    status: 'active',
    source: 'test',
    ...overrides,
  };
}

export async function createQuestions(category, count = 10) {
  const docs = [];
  for (let i = 0; i < count; i += 1) {
    docs.push(
      questionData(category, {
        questionNumber: i + 1,
        questionText: `Ikibazo nimero ${i + 1} gisaba igisubizo cy’ukuri?`,
      }),
    );
  }
  return Question.insertMany(docs);
}

export async function createUser(overrides = {}) {
  const user = new User({
    fullName: overrides.fullName || 'Umunyeshuri',
    email: overrides.email || `user${Math.random().toString(36).slice(2, 8)}@test.rw`,
    role: overrides.role || ROLES.USER,
  });
  await user.setPassword(overrides.password || 'Password123');
  user.emailVerified = overrides.emailVerified ?? true;
  user.status = overrides.status || 'active';
  await user.save();
  return user;
}

export async function ensureSettings(overrides = {}) {
  const settings = await Settings.getSettings();
  Object.assign(settings, overrides);
  await settings.save();
  invalidateSettingsCache();
  return settings;
}

/** Creates a plan document directly (bypasses plan service rules). */
export async function createPlan(overrides = {}) {
  const { plan: _plan, paymentId: _paymentId, status: _status, activatedAt: _activatedAt, expiresAt: _expiresAt, ...fields } = overrides;
  return Plan.create({
    code: `plan_${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Plan',
    price: 1000,
    currency: 'RWF',
    durationDays: 30,
    isLifetime: false,
    isActive: true,
    ...fields,
  });
}

/** Grants the user an active (optionally lifetime) subscription. */
export async function grantPremium(user, overrides = {}) {
  const plan = overrides.plan || (await createPlan(overrides));
  const subscription = await Subscription.create({
    user: user._id,
    plan: plan._id,
    planCode: plan.code,
    planName: plan.name,
    payment: overrides.paymentId || new mongoose.Types.ObjectId(),
    amount: plan.price,
    currency: plan.currency,
    isLifetime: plan.isLifetime,
    durationDays: plan.durationDays,
    // Mirrors approvePayment: the entitlements snapshot is frozen from the plan.
    entitlements: overrides.entitlements || plan.entitlements || undefined,
    status: overrides.status || 'active',
    activatedAt: overrides.activatedAt || new Date(),
    expiresAt: overrides.expiresAt ?? (plan.isLifetime ? null : new Date(Date.now() + plan.durationDays * 86400000)),
  });
  return { plan, subscription };
}
