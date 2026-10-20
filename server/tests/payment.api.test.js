import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { getApp, authHeader } from './helpers/app.js';
import { createCategory, createQuestions, createUser, createPlan, ensureSettings, grantPremium } from './helpers/fixtures.js';
import { PaymentTransaction } from '../src/models/index.js';

const app = getApp();

async function submitProofPayment(user, plan, overrides = {}) {
  const req = request(app)
    .post('/api/payments')
    .set('Authorization', authHeader(user))
    .field('planId', String(plan._id))
    .field('payerName', overrides.payerName || 'John Doe')
    .field('payerPhone', overrides.payerPhone || '0781234567');
  if (overrides.transactionReference) req.field('transactionReference', overrides.transactionReference);
  if (overrides.noProof) req.field('noProof', 'true');
  if (overrides.noProof || overrides.withoutProof) return req;
  return req.attach('proof', Buffer.from('fake-image-bytes'), {
    filename: 'proof.png',
    contentType: 'image/png',
  });
}

describe('payments API (learner)', () => {
  let user;
  let plan;

  beforeEach(async () => {
    await ensureSettings({
      freeQuestionsAllowed: 40,
      freePracticeAttemptsAllowed: 1,
      payment: { verificationWindowHours: 3, recipientPhone: '0783632506', recipientName: 'Test Payee' },
    });
    user = await createUser({ email: 'payer@test.rw' });
    plan = await createPlan({ code: 'monthly_pro_30d', name: 'Monthly Pro', price: 2500, durationDays: 30 });
  });

  it('lists active plans publicly without auth', async () => {
    await createPlan({ code: 'hidden_plan', name: 'Hidden', price: 100, isActive: false });
    const res = await request(app).get('/api/payments/plans');
    expect(res.status).toBe(200);
    expect(res.body.data.plans).toHaveLength(1);
    expect(res.body.data.plans[0].code).toBe('monthly_pro_30d');
  });

  it('submits a payment with proof and returns PENDING_REVIEW', async () => {
    const res = await submitProofPayment(user, plan);
    expect(res.status).toBe(201);
    const payment = res.body.data.payment;
    expect(payment.status).toBe('PENDING_REVIEW');
    expect(payment.amount).toBe(2500);
    expect(payment.payerPhone).toBe('0781234567');
    expect(payment.proofImagePublicId).toBeTruthy();
    expect(payment.proofImageUrl).toMatch(/^\/api\/payments\/proof\//);
    expect(new Date(payment.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a payment without proof or noProof flag', async () => {
    const res = await submitProofPayment(user, plan, { withoutProof: true });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PROOF_REQUIRED');
  });

  it('rejects an invalid phone number', async () => {
    const res = await submitProofPayment(user, plan, { payerPhone: '123456789' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PHONE');
  });

  it('rejects purchase of an inactive plan', async () => {
    const inactive = await createPlan({ code: 'retired', name: 'Retired', isActive: false });
    const res = await submitProofPayment(user, inactive);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PLAN_INACTIVE');
  });

  it('rejects duplicate submissions within the cooldown window', async () => {
    const first = await submitProofPayment(user, plan);
    expect(first.status).toBe(201);
    const second = await submitProofPayment(user, plan);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('PAYMENT_DUPLICATE');
  });

  it('lists my payments and shows latest pending status', async () => {
    await submitProofPayment(user, plan);
    const list = await request(app).get('/api/payments/my').set('Authorization', authHeader(user));
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(1);

    const status = await request(app).get('/api/payments/my/status').set('Authorization', authHeader(user));
    expect(status.status).toBe(200);
    expect(status.body.data.payment.status).toBe('PENDING_REVIEW');
    expect(status.body.data.access.isPremium).toBe(false);
  });

  it('does not leak another learner’s payment', async () => {
    const other = await createUser({ email: 'other@test.rw' });
    const created = await submitProofPayment(user, plan);
    const res = await request(app)
      .get(`/api/payments/${created.body.data.payment.id}`)
      .set('Authorization', authHeader(other));
    expect(res.status).toBe(404);
  });

  it('streams proof to the owner but not to strangers', async () => {
    const created = await submitProofPayment(user, plan);
    const proofId = created.body.data.payment.proofImagePublicId;

    const owner = await request(app).get(`/api/payments/proof/${proofId}`).set('Authorization', authHeader(user));
    expect(owner.status).toBe(200);
    expect(owner.headers['content-type']).toContain('image/png');

    const other = await createUser({ email: 'nosy@test.rw' });
    const stranger = await request(app).get(`/api/payments/proof/${proofId}`).set('Authorization', authHeader(other));
    expect(stranger.status).toBe(403);
    expect(stranger.body.error.code).toBe('PROOF_FORBIDDEN');
  });

  it('accepts submission without proof when noProof is set', async () => {
    const res = await submitProofPayment(user, plan, { noProof: true });
    expect(res.status).toBe(201);
    expect(res.body.data.payment.proofImagePublicId).toBeNull();
  });

  it('exposes access state on /me and payment config on /config', async () => {
    const me = await request(app).get('/api/me').set('Authorization', authHeader(user));
    expect(me.status).toBe(200);
    expect(me.body.data.access.isPremium).toBe(false);
    expect(me.body.data.access.freeQuestionsAllowed).toBe(40);

    const config = await request(app).get('/api/config');
    expect(config.status).toBe(200);
    expect(config.body.data.payment.recipientPhone).toBe('0783632506');
    expect(config.body.data.plans.length).toBeGreaterThan(0);
  });
});

describe('payments API (free-question limit)', () => {
  let user;
  let headers;
  let category;

  beforeEach(async () => {
    await ensureSettings({ freeQuestionsAllowed: 5, freePracticeAttemptsAllowed: 1, practiceDefaultCount: 5 });
    category = await createCategory();
    await createQuestions(category, 10);
    user = await createUser({ email: 'freebie@test.rw' });
    headers = { Authorization: authHeader(user) };
  });

  it('blocks a new quiz once the free allowance is exhausted', async () => {
    const start = await request(app).post('/api/quizzes').set(headers).send({ type: 'practice', count: 5 });
    expect(start.status).toBe(201);
    const { quiz, questions } = start.body.data;
    const selections = Object.fromEntries(questions.map((q) => [q.id, 'a']));
    await request(app).post(`/api/quizzes/${quiz.id}/submit`).set(headers).send({ selections });

    const again = await request(app).post('/api/quizzes').set(headers).send({ type: 'practice', count: 5 });
    expect(again.status).toBe(403);
    expect(again.body.error.code).toBe('FREE_LIMIT_REACHED');
  });

  it('keeps premium learners unlimited', async () => {
    await grantPremium(user);
    const start = await request(app).post('/api/quizzes').set(headers).send({ type: 'practice', count: 5 });
    expect(start.status).toBe(201);
  });
});

describe('payments API (expiry)', () => {
  let user;
  let plan;

  beforeEach(async () => {
    await ensureSettings({ payment: { verificationWindowHours: 1 } });
    user = await createUser({ email: 'expiring@test.rw' });
    plan = await createPlan({ code: 'weekly', name: 'Weekly', price: 1000, durationDays: 7 });
  });

  it('flips an overdue pending transaction to EXPIRED on read', async () => {
    const created = await submitProofPayment(user, plan);
    const txnId = created.body.data.payment.id;
    await PaymentTransaction.updateOne({ _id: txnId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await request(app).get(`/api/payments/${txnId}`).set('Authorization', authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('EXPIRED');
  });
});
