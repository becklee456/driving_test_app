import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { getApp, authHeader } from './helpers/app.js';
import { createUser } from './helpers/fixtures.js';

const app = getApp();

describe('auth API', () => {
  let user;
  const password = 'Password123';

  beforeEach(async () => {
    user = await createUser({ email: 'student@test.rw', password });
  });

  it('rejects unauthenticated access to /api/me', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('registers a user and signs them in', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ fullName: 'Uwimana Jean', email: 'new@test.rw', password, confirmPassword: password });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('new@test.rw');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.headers['set-cookie'].join(';')).toContain('idt_access');
  });

  it('rejects a duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ fullName: 'Dupe', email: user.email, password, confirmPassword: password });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects a mismatched confirmPassword', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ fullName: 'Mismatch', email: 'mismatch@test.rw', password, confirmPassword: 'Different123' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a password equal to the email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ fullName: 'Email Pass', email: 'user4@test.rw', password: 'user4@test.rw', confirmPassword: 'user4@test.rw' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('validates the registration payload', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'bad', password: 'short' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logs in with valid credentials and returns an access token', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.headers['set-cookie'].join(';')).toContain('idt_access');
  });

  it('rejects invalid credentials without revealing the reason', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'WrongPass123' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns the current user with a bearer token', async () => {
    const res = await request(app).get('/api/me').set('Authorization', authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(user.email);
    expect(res.body.data.user.permissions).toEqual([]);
  });

  it('requires the CSRF header for cookie-authenticated writes', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: user.email, password }).expect(200);

    const blocked = await agent.patch('/api/me').send({ fullName: 'New Name' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('CSRF_REQUIRED');

    const allowed = await agent.patch('/api/me').set('x-csrf-protection', '1').send({ fullName: 'New Name' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.user.fullName).toBe('New Name');
  });

  it('locks the account after too many failed attempts', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/auth/login').send({ email: user.email, password: 'WrongPass123' });
    }
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'WrongPass123' });
    expect([423, 429]).toContain(res.status);
  });
});
