import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { getApp, authHeader } from './helpers/app.js';
import { createUser, ensureSettings } from './helpers/fixtures.js';
import { invalidateSettingsCache } from '../src/middleware/settings.js';
import { ROLES } from '../src/constants/permissions.js';

const app = getApp();

async function enableMaintenance() {
  await ensureSettings({ maintenanceMode: true });
  invalidateSettingsCache();
}

describe('maintenance mode', () => {
  let learner;

  beforeEach(async () => {
    learner = await createUser({ email: 'learner@test.rw' });
  });

  it('lets a learner sign in but blocks their writes', async () => {
    await enableMaintenance();

    const login = await request(app).post('/api/auth/login').send({ email: 'learner@test.rw', password: 'Password123' });
    expect(login.status).toBe(200);

    const write = await request(app)
      .post('/api/quizzes')
      .set({ Authorization: authHeader(learner) })
      .send({ type: 'practice', count: 5 });
    expect(write.status).toBe(403);
    expect(write.body.error.code).toBe('MAINTENANCE_MODE');
  });

  it('blocks registration while maintenance is on', async () => {
    await enableMaintenance();

    const res = await request(app)
      .post('/api/auth/register')
      .send({ fullName: 'New User', email: 'new@test.rw', password: 'Password123' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('MAINTENANCE_MODE');
  });

  it('lets an admin sign in and write while maintenance is on', async () => {
    await enableMaintenance();
    const admin = await createUser({ email: 'admin@test.rw', role: ROLES.ADMIN });

    const login = await request(app).post('/api/auth/login').send({ email: 'admin@test.rw', password: 'Password123' });
    expect(login.status).toBe(200);

    const write = await request(app)
      .post('/api/quizzes')
      .set({ Authorization: authHeader(admin) })
      .send({ type: 'practice', count: 5 });
    expect(write.status).not.toBe(403);
  });

  it('allows reads during maintenance', async () => {
    await enableMaintenance();

    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.data.maintenanceMode).toBe(true);
  });
});
