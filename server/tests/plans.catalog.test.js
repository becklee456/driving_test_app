import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { getApp, authHeader } from './helpers/app.js';
import { createCategory, createQuestions, createUser, createPlan, ensureSettings, grantPremium } from './helpers/fixtures.js';
import { syncPlanCatalogue } from '../src/scripts/seed-plans.js';
import { PLANS, LEGACY_PLAN_CODES } from '../src/seed/plans.data.js';
import { Plan, PaymentTransaction, Subscription, Quiz } from '../src/models/index.js';
import { ROLES } from '../src/constants/permissions.js';
import { getAccessState, assertDailyMockQuota } from '../src/services/entitlement.service.js';
import ApiError from '../src/utils/api-error.js';

const app = getApp();
const CODES = PLANS.map((p) => p.code);

function planByCode(code) {
  return PLANS.find((p) => p.code === code);
}

async function submitPayment(user, plan, extraFields = {}) {
  const req = request(app)
    .post('/api/payments')
    .set('Authorization', authHeader(user))
    .field('planId', String(plan._id))
    .field('payerName', 'John Doe')
    .field('payerPhone', '0781234567');
  for (const [key, value] of Object.entries(extraFields)) req.field(key, String(value));
  return req.attach('proof', Buffer.from('fake-image-bytes'), { filename: 'proof.png', contentType: 'image/png' });
}

describe('premium plan catalogue seed', () => {
  it('dry-run reports actions but writes nothing', async () => {
    const report = await syncPlanCatalogue({ apply: false });
    expect(report.plans.created).toHaveLength(8);
    expect(await Plan.countDocuments()).toBe(0);
  });

  it('creates exactly the 8 premium plans with correct prices, durations and orders', async () => {
    await syncPlanCatalogue({ apply: true });

    const plans = await Plan.find().sort({ order: 1 }).lean();
    expect(plans).toHaveLength(8);
    expect(new Set(plans.map((p) => p.code)).size).toBe(8);

    const expected = [
      ['weekly_pass_7d', 1000, 7, 1],
      ['study_boost_14d', 1500, 14, 2],
      ['monthly_pro_30d', 2500, 30, 3],
      ['exam_ready_60d', 4000, 60, 4],
      ['ultimate_90d', 5500, 90, 5],
      ['semester_pass_180d', 8000, 180, 6],
      ['annual_pass_365d', 10000, 365, 7],
    ];
    for (const [code, price, days, order] of expected) {
      const plan = plans.find((p) => p.code === code);
      expect(plan, code).toBeTruthy();
      expect(plan.price).toBe(price);
      expect(plan.durationDays).toBe(days);
      expect(plan.order).toBe(order);
      expect(plan.isActive).toBe(true);
      expect(plan.currency).toBe('RWF');
      expect(plan.originalPrice == null || plan.originalPrice >= plan.price).toBe(true);
    }

    const lifetime = plans.find((p) => p.code === 'lifetime_access');
    expect(lifetime.isLifetime).toBe(true);
    expect(lifetime.durationDays).toBeNull();
    expect(lifetime.interval).toBe('lifetime');
    expect(lifetime.price).toBe(15000);
    expect(lifetime.order).toBe(8);

    // Every plan carries a full entitlements snapshot.
    for (const plan of plans) {
      expect(plan.entitlements, plan.code).toBeTruthy();
      expect(typeof plan.entitlements.dailyQuestions).toBe('number');
      expect(typeof plan.entitlements.dailyMockExams).toBe('number');
      expect(typeof plan.entitlements.mistakeReview).toBe('boolean');
    }
    expect(planByCode('semester_pass_180d').entitlements.dailyMockExams).toBe(-1);
    expect(planByCode('weekly_pass_7d').entitlements.dailyMockExams).toBe(3);
  });

  it('is idempotent: a second run creates nothing and changes nothing', async () => {
    await syncPlanCatalogue({ apply: true });
    const second = await syncPlanCatalogue({ apply: true });
    expect(second.plans.created).toHaveLength(0);
    expect(second.plans.updated).toHaveLength(0);
    expect(second.plans.unchanged).toHaveLength(8);
    expect(await Plan.countDocuments()).toBe(8);
  });

  it('deactivates legacy quick_start plans without deleting them', async () => {
    await createPlan({ code: 'quick_start_2d', name: 'Quick Start 2D', price: 500, durationDays: 2 });
    await createPlan({ code: 'quick_start_3d', name: 'Quick Start 3D', price: 700, durationDays: 3, isActive: false });

    const report = await syncPlanCatalogue({ apply: true });
    expect(report.legacy.deactivated).toEqual(['quick_start_2d']);
    expect(report.legacy.alreadyInactive).toEqual(['quick_start_3d']);

    const legacy = await Plan.find({ code: { $in: LEGACY_PLAN_CODES } }).lean();
    expect(legacy).toHaveLength(2); // never deleted
    for (const doc of legacy) expect(doc.isActive).toBe(false);
    expect(await Plan.countDocuments({ code: { $in: CODES } })).toBe(8);
  });

  it('updates an existing plan in place without touching isActive', async () => {
    await Plan.create({
      code: 'weekly_pass_7d',
      name: 'Old Weekly',
      price: 900,
      durationDays: 7,
      isActive: false, // admin deliberately hid it
      order: 1,
    });

    const report = await syncPlanCatalogue({ apply: true });
    expect(report.plans.updated.map((u) => u.code)).toContain('weekly_pass_7d');

    const plan = await Plan.findOne({ code: 'weekly_pass_7d' }).lean();
    expect(plan.price).toBe(1000);
    expect(plan.name).toBe('Weekly Pass');
    expect(plan.isActive).toBe(false); // administrator decision preserved
    expect(await Plan.countDocuments({ code: 'weekly_pass_7d' })).toBe(1);
  });
});

describe('plan prices are server-owned', () => {
  let user;
  let plan;

  beforeEach(async () => {
    await ensureSettings({
      freeQuestionsAllowed: 40,
      freePracticeAttemptsAllowed: 1,
      payment: { verificationWindowHours: 3, recipientPhone: '0783632506', recipientName: 'Test Payee' },
    });
    user = await createUser({ email: 'inject@test.rw' });
    plan = await createPlan({ code: 'monthly_pro_30d', name: 'Monthly Pro', price: 2500, durationDays: 30 });
  });

  it('ignores client-supplied price/amount/duration fields at checkout', async () => {
    const res = await submitPayment(user, plan, {
      price: 1,
      amount: 1,
      durationDays: 9999,
      isLifetime: 'true',
      entitlements: 'everything',
    });
    expect(res.status).toBe(201);
    const stored = await PaymentTransaction.findById(res.body.data.payment.id).lean();
    expect(stored.amount).toBe(2500);
    expect(stored.durationDays).toBe(30);
    expect(stored.isLifetime).toBe(false);
    expect(stored.currency).toBe('RWF');
  });

  it('keeps historical transactions and subscriptions immutable after a plan price change', async () => {
    const admin = await createUser({ email: 'admin-snap@test.rw', role: ROLES.ADMIN });
    const created = await submitPayment(user, plan);
    const txnId = created.body.data.payment.id;

    const approve = await request(app)
      .post(`/api/admin/payments/${txnId}/approve`)
      .set('Authorization', authHeader(admin))
      .send({});
    expect(approve.status).toBe(200);

    // Admin later doubles the plan price.
    const update = await request(app)
      .patch(`/api/admin/plans/${plan._id}`)
      .set('Authorization', authHeader(admin))
      .send({ price: 5000, originalPrice: 6000 });
    expect(update.status).toBe(200);

    const txn = await PaymentTransaction.findById(txnId).lean();
    expect(txn.amount).toBe(2500); // historical snapshot untouched
    expect(txn.planName).toBe('Monthly Pro');

    const sub = await Subscription.findOne({ payment: txnId }).lean();
    expect(sub.amount).toBe(2500);

    const access = await getAccessState(user._id);
    expect(access.isPremium).toBe(true);
  });
});

describe('plan entitlement quotas', () => {
  it('enforces the daily mock-exam quota from the subscription snapshot', async () => {
    const category = await createCategory();
    await createQuestions(category, 30);
    await ensureSettings({ examQuestionCount: 10 });

    const user = await createUser({ email: 'quota@test.rw' });
    await grantPremium(user, {
      code: 'quota_weekly',
      name: 'Quota Weekly',
      price: 1000,
      durationDays: 7,
      entitlements: { dailyQuestions: -1, dailyMockExams: 1, mistakeReview: true },
    });

    const first = await request(app).post('/api/quizzes').set('Authorization', authHeader(user)).send({ type: 'mock' });
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/quizzes').set('Authorization', authHeader(user)).send({ type: 'mock' });
    expect(second.status).toBe(403);
    expect(second.body.error.code).toBe('MOCK_LIMIT_REACHED');

    expect(await Quiz.countDocuments({ user: user._id, type: 'mock' })).toBe(1);
  });

  it('allows unlimited mocks when the quota is -1', async () => {
    const category = await createCategory();
    await createQuestions(category, 30);
    await ensureSettings({ examQuestionCount: 10 });

    const user = await createUser({ email: 'unlimited@test.rw' });
    await grantPremium(user, {
      code: 'unlimited_year',
      name: 'Unlimited Year',
      price: 10000,
      durationDays: 365,
      entitlements: { dailyQuestions: -1, dailyMockExams: -1, mistakeReview: true },
    });

    const first = await request(app).post('/api/quizzes').set('Authorization', authHeader(user)).send({ type: 'mock' });
    const second = await request(app).post('/api/quizzes').set('Authorization', authHeader(user)).send({ type: 'mock' });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it('rejects mocks when the plan disables them (quota 0)', async () => {
    await assertDailyMockQuota({ dailyMockExams: 0 }, 'ffffffffffffffffffffffff').catch((err) => {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.code).toBe('MOCK_LIMIT_REACHED');
    });
  });
});
