import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { getApp, authHeader } from './helpers/app.js';
import { createCategory, createQuestions, createUser, createPlan, ensureSettings, grantPremium } from './helpers/fixtures.js';
import { ROLES } from '../src/constants/permissions.js';
import { getAccessState } from '../src/services/entitlement.service.js';
import { PaymentTransaction } from '../src/models/index.js';

const app = getApp();

async function submitPayment(user, plan) {
  return request(app)
    .post('/api/payments')
    .set('Authorization', authHeader(user))
    .field('planId', String(plan._id))
    .field('payerName', 'Jane Doe')
    .field('payerPhone', '0781234567')
    .attach('proof', Buffer.from('fake-image-bytes'), { filename: 'proof.png', contentType: 'image/png' });
}

describe('admin billing API', () => {
  let admin;
  let adminHeaders;
  let user;
  let plan;

  beforeEach(async () => {
    await ensureSettings({
      freeQuestionsAllowed: 40,
      freePracticeAttemptsAllowed: 1,
      payment: { verificationWindowHours: 3, recipientPhone: '0783632506', recipientName: 'Test Payee' },
    });
    admin = await createUser({ email: 'billing@test.rw', role: ROLES.ADMIN });
    adminHeaders = { Authorization: authHeader(admin) };
    user = await createUser({ email: 'learner@test.rw' });
    plan = await createPlan({ code: 'monthly_pro_30d', name: 'Monthly Pro', price: 2500, durationDays: 30 });
  });

  it('forbids learners from admin payment endpoints', async () => {
    const res = await request(app).get('/api/admin/payments').set('Authorization', authHeader(user));
    expect(res.status).toBe(403);
  });

  it('lists payments with status counts for billing admins', async () => {
    await submitPayment(user, plan);
    const res = await request(app).get('/api/admin/payments').set(adminHeaders);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.counts.PENDING_REVIEW).toBe(1);
    expect(res.body.data.items[0].user?.fullName).toBeTruthy();
  });

  it('approves a payment, activates a subscription and unlocks premium', async () => {
    const created = await submitPayment(user, plan);
    const txnId = created.body.data.payment.id;

    const res = await request(app).post(`/api/admin/payments/${txnId}/approve`).set(adminHeaders).send({ note: 'ok' });
    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('APPROVED');
    expect(res.body.data.subscription.status).toBe('active');
    expect(res.body.data.subscription.expiresAt).toBeTruthy();

    const access = await getAccessState(user._id);
    expect(access.isPremium).toBe(true);
    expect(access.subscription.planCode).toBe('monthly_pro_30d');

    const status = await request(app).get('/api/payments/my/status').set('Authorization', authHeader(user));
    expect(status.body.data.access.isPremium).toBe(true);
  });

  it('rejects a second approval of the same payment', async () => {
    const created = await submitPayment(user, plan);
    const txnId = created.body.data.payment.id;
    await request(app).post(`/api/admin/payments/${txnId}/approve`).set(adminHeaders).send({});

    const again = await request(app).post(`/api/admin/payments/${txnId}/approve`).set(adminHeaders).send({});
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('PAYMENT_ALREADY_APPROVED');
  });

  it('denies a payment with a reason and never unlocks premium', async () => {
    const created = await submitPayment(user, plan);
    const txnId = created.body.data.payment.id;

    const res = await request(app)
      .post(`/api/admin/payments/${txnId}/deny`)
      .set(adminHeaders)
      .send({ reason: 'Proof screenshot unreadable' });
    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('DENIED');
    expect(res.body.data.payment.denialReason).toBe('Proof screenshot unreadable');

    const access = await getAccessState(user._id);
    expect(access.isPremium).toBe(false);

    const denyAgain = await request(app)
      .post(`/api/admin/payments/${txnId}/deny`)
      .set(adminHeaders)
      .send({ reason: 'Another reason here' });
    expect(denyAgain.status).toBe(409);
  });

  it('requires a reason to deny', async () => {
    const created = await submitPayment(user, plan);
    const res = await request(app)
      .post(`/api/admin/payments/${created.body.data.payment.id}/deny`)
      .set(adminHeaders)
      .send({ reason: 'x' });
    expect(res.status).toBe(422);
  });

  it('cannot approve an expired payment', async () => {
    const created = await submitPayment(user, plan);
    const txnId = created.body.data.payment.id;
    await PaymentTransaction.updateOne({ _id: txnId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await request(app).post(`/api/admin/payments/${txnId}/approve`).set(adminHeaders).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_EXPIRED');
  });

  it('returns 404 for a missing payment', async () => {
    const res = await request(app)
      .get(`/api/admin/payments/${new mongoose.Types.ObjectId()}`)
      .set(adminHeaders);
    expect(res.status).toBe(404);
  });
});

describe('admin plans API', () => {
  let admin;
  let adminHeaders;

  beforeEach(async () => {
    await ensureSettings({});
    admin = await createUser({ email: 'planner@test.rw', role: ROLES.ADMIN });
    adminHeaders = { Authorization: authHeader(admin) };
  });

  it('forbids learners from plan management', async () => {
    const user = await createUser({ email: 'plain@test.rw' });
    const res = await request(app).get('/api/admin/plans').set('Authorization', authHeader(user));
    expect(res.status).toBe(403);
  });

  it('creates a plan, lowercasing the code and rejecting duplicates', async () => {
    const create = await request(app)
      .post('/api/admin/plans')
      .set(adminHeaders)
      .send({ code: 'STUDENT_SPECIAL', name: 'Student Special', price: 500, durationDays: 7 });
    expect(create.status).toBe(201);
    expect(create.body.data.plan.code).toBe('student_special');

    const dup = await request(app)
      .post('/api/admin/plans')
      .set(adminHeaders)
      .send({ code: 'student_special', name: 'Copycat', price: 900, durationDays: 10 });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('PLAN_CODE_TAKEN');
  });

  it('updates plan pricing and deactivates instead of deleting', async () => {
    const plan = await createPlan({ code: 'to_update', name: 'Old Name', price: 1000, durationDays: 30 });

    const patch = await request(app)
      .patch(`/api/admin/plans/${plan._id}`)
      .set(adminHeaders)
      .send({ price: 1750, name: 'New Name' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.plan.price).toBe(1750);

    const del = await request(app).delete(`/api/admin/plans/${plan._id}`).set(adminHeaders);
    expect(del.status).toBe(200);
    expect(del.body.data.plan.isActive).toBe(false);

    const publicList = await request(app).get('/api/payments/plans');
    expect(publicList.body.data.plans.find((p) => p.code === 'to_update')).toBeUndefined();

    const adminList = await request(app).get('/api/admin/plans').set(adminHeaders);
    expect(adminList.body.data.plans.find((p) => p.code === 'to_update')).toBeTruthy();
  });

  it('sets lifetime plans without durationDays', async () => {
    const create = await request(app)
      .post('/api/admin/plans')
      .set(adminHeaders)
      .send({ code: 'life', name: 'Lifetime', price: 15000, isLifetime: true, durationDays: 30 });
    expect(create.status).toBe(201);
    expect(create.body.data.plan.durationDays).toBeNull();
    expect(create.body.data.plan.isLifetime).toBe(true);
  });
});

describe('admin payment settings API', () => {
  let admin;

  beforeEach(async () => {
    await ensureSettings({});
    admin = await createUser({ email: 'settings@test.rw', role: ROLES.ADMIN });
  });

  it('updates payment settings and immediately reflects them in /config', async () => {
    const res = await request(app)
      .patch('/api/admin/payment-settings')
      .set('Authorization', authHeader(admin))
      .send({
        freeQuestionsAllowed: 25,
        payment: { recipientPhone: '0788000111', verificationWindowHours: 6 },
      });
    expect(res.status).toBe(200);
    expect(res.body.data.settings.freeQuestionsAllowed).toBe(25);

    const config = await request(app).get('/api/config');
    expect(config.body.data.freeQuestionsAllowed).toBe(25);
    expect(config.body.data.payment.recipientPhone).toBe('0788000111');
    expect(config.body.data.payment.verificationWindowHours).toBe(6);
  });

  it('forbids non-settings admins', async () => {
    const editor = await createUser({ email: 'ed@test.rw', role: ROLES.EDITOR });
    const res = await request(app)
      .patch('/api/admin/payment-settings')
      .set('Authorization', authHeader(editor))
      .send({ freeQuestionsAllowed: 10 });
    expect(res.status).toBe(403);
  });
});

describe('subscription lifecycle API', () => {
  let admin;
  let user;
  let plan;

  beforeEach(async () => {
    await ensureSettings({});
    admin = await createUser({ email: 'sub-admin@test.rw', role: ROLES.ADMIN });
    user = await createUser({ email: 'sub-learner@test.rw' });
    plan = await createPlan({ code: 'weekly_pass_7d', name: 'Weekly Pass', price: 1000, durationDays: 7 });
  });

  it('lists subscriptions and flags expiry correctly', async () => {
    await grantPremium(user, { plan, expiresAt: new Date(Date.now() - 1000) });
    await grantPremium(user, { plan });

    const res = await request(app).get('/api/payments/my/subscriptions').set('Authorization', authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.data.subscriptions).toHaveLength(2);
    const flags = res.body.data.subscriptions.map((s) => s.isCurrentlyActive);
    expect(flags).toContain(true);
    expect(flags).toContain(false);
  });

  it('lifetime subscriptions never expire', async () => {
    const lifePlan = await createPlan({ code: 'lifetime_access', name: 'Lifetime', price: 15000, isLifetime: true, durationDays: null });
    await grantPremium(user, { plan: lifePlan });
    const access = await getAccessState(user._id);
    expect(access.isPremium).toBe(true);
    expect(access.subscription.isLifetime).toBe(true);
    expect(access.subscription.expiresAt).toBeNull();
  });

  it('unlocks premium-only quiz types after approval', async () => {
    await ensureSettings({ practiceDefaultCount: 5, examQuestionCount: 10, passingScorePercent: 80 });
    const category = await createCategory();
    await createQuestions(category, 10);
    const headers = { Authorization: authHeader(user) };

    const blocked = await request(app).post('/api/quizzes').set(headers).send({ type: 'mock' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('PREMIUM_REQUIRED');

    const created = await submitPayment(user, plan);
    await request(app)
      .post(`/api/admin/payments/${created.body.data.payment.id}/approve`)
      .set('Authorization', authHeader(admin))
      .send({});

    const allowed = await request(app).post('/api/quizzes').set(headers).send({ type: 'mock' });
    expect(allowed.status).toBe(201);
  });
});
