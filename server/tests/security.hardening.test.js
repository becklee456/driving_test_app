import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { getApp, authHeader } from './helpers/app.js';
import { createUser, createCategory, createQuestions, createPlan, ensureSettings, fakePngBuffer, grantPremium } from './helpers/fixtures.js';
import { ROLES, ALL_PERMISSIONS } from '../src/constants/permissions.js';
import { signAccessToken } from '../src/middleware/auth.js';
import { User, Quiz, Subscription } from '../src/models/index.js';

const app = getApp();

describe('security: privilege escalation via suspend/activate', () => {
  let moderator;
  let victim;

  beforeEach(async () => {
    await ensureSettings({});
    moderator = await createUser({ email: 'mod@test.rw', role: ROLES.MODERATOR });
    victim = await createUser({ email: 'victim@test.rw', role: ROLES.USER });
  });

  it('suspend ignores role/permissions in the body', async () => {
    const res = await request(app)
      .post(`/api/admin/users/${victim._id}/suspend`)
      .set('Authorization', authHeader(moderator))
      .send({ role: 'SUPER_ADMIN', permissions: ALL_PERMISSIONS, notes: 'abuse' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.status).toBe('suspended');
    expect(res.body.data.user.role).toBe(ROLES.USER);
    expect(res.body.data.user.permissions).toEqual([]);

    const fresh = await User.findById(victim._id);
    expect(fresh.role).toBe(ROLES.USER);
    expect(fresh.permissions).toEqual([]);
  });

  it('activate ignores role/permissions in the body', async () => {
    const admin = await createUser({ email: 'modadmin@test.rw', role: ROLES.ADMIN });
    await request(app)
      .post(`/api/admin/users/${victim._id}/suspend`)
      .set('Authorization', authHeader(moderator))
      .send({});
    const res = await request(app)
      .post(`/api/admin/users/${victim._id}/activate`)
      .set('Authorization', authHeader(admin))
      .send({ role: 'ADMIN', permissions: ['billing:manage'] });
    expect(res.status).toBe(200);
    expect(res.body.data.user.status).toBe('active');
    expect(res.body.data.user.role).toBe(ROLES.USER);
  });

  it('PATCH /admin/users/:id strips role and permissions', async () => {
    const admin = await createUser({ email: 'modadmin2@test.rw', role: ROLES.ADMIN });
    const res = await request(app)
      .patch(`/api/admin/users/${victim._id}`)
      .set('Authorization', authHeader(admin))
      .send({ fullName: 'New Name', role: 'ADMIN', permissions: ['users:manage'] });
    expect(res.status).toBe(200);
    expect(res.body.data.user.fullName).toBe('New Name');
    expect(res.body.data.user.role).toBe(ROLES.USER);

    const fresh = await User.findById(victim._id);
    expect(fresh.role).toBe(ROLES.USER);
    expect(fresh.permissions).toEqual([]);
  });

  it('rejects unknown permission strings on the role endpoint', async () => {
    const admin = await createUser({ email: 'root@test.rw', role: ROLES.SUPER_ADMIN });
    const res = await request(app)
      .patch(`/api/admin/users/${victim._id}/role`)
      .set('Authorization', authHeader(admin))
      .send({ role: ROLES.USER, permissions: ['not:a:permission'] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('nobody can change their own role', async () => {
    const admin = await createUser({ email: 'selfrole@test.rw', role: ROLES.SUPER_ADMIN });
    const res = await request(app)
      .patch(`/api/admin/users/${admin._id}/role`)
      .set('Authorization', authHeader(admin))
      .send({ role: ROLES.SUPER_ADMIN });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_CHANGE_OWN_ROLE');
  });
});

describe('security: question answers are never exposed publicly', () => {
  let category;

  beforeEach(async () => {
    await ensureSettings({});
    category = await createCategory();
    await createQuestions(category, 5);
  });

  it('GET /api/questions/:id omits correct answers and explanations', async () => {
    const list = await request(app).get('/api/questions?limit=1');
    const id = list.body.data[0].id;
    const res = await request(app).get(`/api/questions/${id}`);
    expect(res.status).toBe(200);
    const q = res.body.data.question;
    expect(q.correctOptionIds).toBeUndefined();
    expect(q.explanation).toBeUndefined();
    for (const opt of q.options) expect(opt.isCorrect).toBeUndefined();
  });

  it('GET /api/questions/random omits correct answers', async () => {
    const res = await request(app).get('/api/questions/random');
    expect(res.status).toBe(200);
    const q = res.body.data.question;
    expect(q.correctOptionIds).toBeUndefined();
    for (const opt of q.options) expect(opt.isCorrect).toBeUndefined();
  });

  it('staff endpoints still include correct answers', async () => {
    const admin = await createUser({ email: 'qadmin@test.rw', role: ROLES.ADMIN });
    const list = await request(app).get('/api/questions?limit=1');
    const id = list.body.data[0].id;
    const res = await request(app).get(`/api/admin/questions/${id}`).set('Authorization', authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.body.data.question.correctOptionIds).toEqual(['a']);
  });
});

describe('security: quiz integrity', () => {
  let user;
  let headers;
  let category;

  beforeEach(async () => {
    await ensureSettings({ practiceDefaultCount: 5, examQuestionCount: 10, passingScorePercent: 80, freeQuestionsAllowed: 40 });
    category = await createCategory();
    await createQuestions(category, 10);
    user = await createUser({ email: 'cheater@test.rw' });
    headers = { Authorization: authHeader(user) };
  });

  it('feedbackMode cannot be forced for mock exams', async () => {
    const premiumUser = await createUser({ email: 'premium@test.rw' });
    await grantPremium(premiumUser);
    const premiumHeaders = { Authorization: authHeader(premiumUser) };

    const start = await request(app)
      .post('/api/quizzes')
      .set(premiumHeaders)
      .send({ type: 'mock', feedbackMode: 'immediate' });
    expect(start.status).toBe(201);
    expect(start.body.data.quiz.config.feedbackMode).toBe('end');
  });

  it('saveAnswer on a mock exam never reveals correctness', async () => {
    await grantPremium(user);
    const start = await request(app).post('/api/quizzes').set(headers).send({ type: 'mock' });
    const quizId = start.body.data.quiz.id;
    const question = start.body.data.questions[0];

    const res = await request(app)
      .post(`/api/quizzes/${quizId}/answers`)
      .set(headers)
      .send({ questionId: question.id, selectedOptionId: 'a' });
    expect(res.status).toBe(200);
    expect(res.body.data.correct).toBeUndefined();
    expect(res.body.data.correctOptionIds).toBeUndefined();
    expect(res.body.data.explanation).toBeUndefined();
  });

  it('a second submit loses the race with 409', async () => {
    const start = await request(app).post('/api/quizzes').set(headers).send({ type: 'practice', count: 5 });
    const { quiz, questions } = start.body.data;
    const selections = Object.fromEntries(questions.map((q) => [q.id, 'a']));

    const [a, b] = await Promise.all([
      request(app).post(`/api/quizzes/${quiz.id}/submit`).set(headers).send({ selections }),
      request(app).post(`/api/quizzes/${quiz.id}/submit`).set(headers).send({ selections }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it('rejects answers after the exam timer has expired', async () => {
    await request(app).post('/api/quizzes').set(headers).send({ type: 'practice', count: 5 });
    const { grantPremium } = await import('./helpers/fixtures.js');
    await grantPremium(user);
    const start = await request(app).post('/api/quizzes').set(headers).send({ type: 'mock' });
    const quizId = start.body.data.quiz.id;
    const question = start.body.data.questions[0];

    await Quiz.updateOne({ _id: quizId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await request(app)
      .post(`/api/quizzes/${quizId}/answers`)
      .set(headers)
      .send({ questionId: question.id, selectedOptionId: 'a' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('QUIZ_EXPIRED');
  });

  it('submissions past the deadline ignore fresh selections', async () => {
    await request(app).post('/api/quizzes').set(headers).send({ type: 'practice', count: 5 });
    const start = await request(app).post('/api/quizzes').set(headers).send({ type: 'practice', count: 5 });
    const { quiz, questions } = start.body.data;

    // Save one correct answer, then expire the quiz.
    await request(app)
      .post(`/api/quizzes/${quiz.id}/answers`)
      .set(headers)
      .send({ questionId: questions[0].id, selectedOptionId: 'a' });
    await Quiz.updateOne({ _id: quiz.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const allCorrect = Object.fromEntries(questions.map((q) => [q.id, 'a']));
    const res = await request(app).post(`/api/quizzes/${quiz.id}/submit`).set(headers).send({ selections: allCorrect });
    expect(res.status).toBe(200);
    // Only the pre-expiry saved answer counts; the bulk selection is ignored.
    expect(res.body.data.score.correct).toBe(1);
    expect(res.body.data.score.total).toBe(5);
  });

  it('rejects a stale access token after a password change', async () => {
    const target = await createUser({ email: 'stale@test.rw' });
    const staleToken = signAccessToken(target);
    await target.setPassword('NewPassword1');
    await target.save();

    const res = await request(app)
      .post('/api/quizzes')
      .set('Authorization', `Bearer ${staleToken}`)
      .send({ type: 'practice', count: 5 });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_REVOKED');
  });
});

describe('security: payment submission hardening', () => {
  let user;
  let plan;

  beforeEach(async () => {
    await ensureSettings({ payment: { verificationWindowHours: 3 } });
    user = await createUser({ email: 'payee@test.rw' });
    plan = await createPlan({ code: 'sec_plan', name: 'Sec Plan', price: 1000, durationDays: 30 });
  });

  it('rejects a duplicate transaction reference', async () => {
    const first = await request(app)
      .post('/api/payments')
      .set('Authorization', authHeader(user))
      .field('planId', String(plan._id))
      .field('payerName', 'Alice Uwase')
      .field('payerPhone', '0781234567')
      .field('transactionReference', 'MOMO-REF-1')
      .attach('proof', fakePngBuffer(), { filename: 'p.png', contentType: 'image/png' });
    expect(first.status).toBe(201);

    const other = await createUser({ email: 'payee2@test.rw' });
    const second = await request(app)
      .post('/api/payments')
      .set('Authorization', authHeader(other))
      .field('planId', String(plan._id))
      .field('payerName', 'Bob Nkurunziza')
      .field('payerPhone', '0781234568')
      .field('transactionReference', 'MOMO-REF-1')
      .attach('proof', fakePngBuffer(), { filename: 'p.png', contentType: 'image/png' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('PAYMENT_DUPLICATE_REF');
  });

  it('rejects an image whose magic bytes do not match', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', authHeader(user))
      .field('planId', String(plan._id))
      .field('payerName', 'Alice Uwase')
      .field('payerPhone', '0781234567')
      .attach('proof', Buffer.from('<html>not an image</html>'), { filename: 'p.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PROOF_TYPE');
  });
});

describe('security: approve/deny ordering', () => {
  let admin;
  let user;
  let plan;

  beforeEach(async () => {
    await ensureSettings({ payment: { verificationWindowHours: 3 } });
    admin = await createUser({ email: 'bill@test.rw', role: ROLES.ADMIN });
    user = await createUser({ email: 'buyer@test.rw' });
    plan = await createPlan({ code: 'race_plan', name: 'Race', price: 1000, durationDays: 30 });
  });

  async function submit() {
    return request(app)
      .post('/api/payments')
      .set('Authorization', authHeader(user))
      .field('planId', String(plan._id))
      .field('payerName', 'Alice Uwase')
      .field('payerPhone', '0781234567')
      .attach('proof', fakePngBuffer(), { filename: 'p.png', contentType: 'image/png' });
  }

  it('approve after deny fails and creates no subscription', async () => {
    const created = await submit();
    const txnId = created.body.data.payment.id;

    await request(app)
      .post(`/api/admin/payments/${txnId}/deny`)
      .set('Authorization', authHeader(admin))
      .send({ reason: 'Unreadable proof screenshot' });

    const approve = await request(app)
      .post(`/api/admin/payments/${txnId}/approve`)
      .set('Authorization', authHeader(admin))
      .send({});
    expect(approve.status).toBe(409);
    expect(approve.body.error.code).toBe('PAYMENT_ALREADY_DENIED');

    expect(await Subscription.countDocuments({ payment: new mongoose.Types.ObjectId(txnId) })).toBe(0);
  });

  it('concurrent approve attempts create exactly one subscription', async () => {
    const created = await submit();
    const txnId = created.body.data.payment.id;

    const [a, b] = await Promise.all([
      request(app).post(`/api/admin/payments/${txnId}/approve`).set('Authorization', authHeader(admin)).send({}),
      request(app).post(`/api/admin/payments/${txnId}/approve`).set('Authorization', authHeader(admin)).send({}),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    expect(await Subscription.countDocuments({ payment: new mongoose.Types.ObjectId(txnId) })).toBe(1);
  });
});

describe('security: refresh CSRF', () => {
  let user;

  beforeEach(async () => {
    await ensureSettings({});
    user = await createUser({ email: 'csrf@test.rw' });
  });

  it('rejects cookie-based refresh without the CSRF header', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: user.email, password: 'Password123' }).expect(200);

    const blocked = await agent.post('/api/auth/refresh');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('CSRF_REQUIRED');

    const allowed = await agent.post('/api/auth/refresh').set('x-csrf-protection', '1');
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.accessToken).toBeTruthy();
  });
});
