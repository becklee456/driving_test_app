import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { getApp, authHeader } from './helpers/app.js';
import { createCategory, createQuestions, createUser } from './helpers/fixtures.js';
import { Question } from '../src/models/index.js';
import { ROLES } from '../src/constants/permissions.js';

const app = getApp();

describe('question API', () => {
  let category;
  let admin;
  let editor;
  let student;

  beforeEach(async () => {
    category = await createCategory();
    admin = await createUser({ email: 'admin@test.rw', role: ROLES.ADMIN });
    editor = await createUser({ email: 'editor@test.rw', role: ROLES.EDITOR });
    student = await createUser({ email: 'student2@test.rw' });
  });

  it('lists only published questions for the public', async () => {
    await createQuestions(category, 3);
    await Question.create({
      questionNumber: 50,
      questionText: 'Ikibazo kirimo gusubirwamo?',
      category: category._id,
      categorySlug: category.slug,
      options: [
        { id: 'a', label: 'a', text: 'A', isCorrect: true },
        { id: 'b', label: 'b', text: 'B', isCorrect: false },
      ],
      status: 'review',
    });

    const res = await request(app).get('/api/questions');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.meta.total).toBe(3);
  });

  it('hides non-active questions from the public detail endpoint', async () => {
    const q = await Question.create({
      questionNumber: 51,
      questionText: 'Ikibazo kitatangajwe?',
      options: [
        { id: 'a', label: 'a', text: 'A', isCorrect: true },
        { id: 'b', label: 'b', text: 'B', isCorrect: false },
      ],
      status: 'review',
    });
    const res = await request(app).get(`/api/questions/${q._id}`);
    expect(res.status).toBe(404);
  });

  it('lets an editor create a question and rejects invalid options', async () => {
    const ok = await request(app)
      .post('/api/admin/questions')
      .set('Authorization', authHeader(editor))
      .send({
        questionNumber: 200,
        questionText: 'Ikibazo gishya cyakozwe n’umwanditsi?',
        options: [
          { label: 'a', text: 'Igisubizo cy’ukuri', isCorrect: true },
          { label: 'b', text: 'Ikindi gisubizo' },
        ],
      });
    expect(ok.status).toBe(201);
    expect(ok.body.data.question.correctOptionIds).toEqual(['a']);

    const bad = await request(app)
      .post('/api/admin/questions')
      .set('Authorization', authHeader(editor))
      .send({ questionText: 'Ikibazo kitari cyo?', options: [{ label: 'a', text: 'A' }] });
    expect(bad.status).toBe(422);

    const noCorrect = await request(app)
      .post('/api/admin/questions')
      .set('Authorization', authHeader(editor))
      .send({ questionText: 'Nta gisubizo cy’ukuri?', options: [{ label: 'a', text: 'A' }, { label: 'b', text: 'B' }] });
    expect(noCorrect.status).toBe(400);
    expect(noCorrect.body.error.code).toBe('NO_CORRECT_ANSWER');
  });

  it('rejects duplicate question text with a clear conflict', async () => {
    await createQuestions(category, 1);
    const body = {
      questionText: 'Ikibazo nimero 1 gisaba igisubizo cy’ukuri?',
      options: [
        { label: 'a', text: 'A', isCorrect: true },
        { label: 'b', text: 'B' },
      ],
    };
    const res = await request(app).post('/api/admin/questions').set('Authorization', authHeader(admin)).send(body);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_QUESTION');
  });

  it('forbids a student from admin endpoints', async () => {
    const res = await request(app).get('/api/admin/questions').set('Authorization', authHeader(student));
    expect(res.status).toBe(403);
  });

  it('refuses to publish a question without exactly one correct answer', async () => {
    const broken = await Question.create({
      questionNumber: 60,
      questionText: 'Ikibazo gifite ibisubizo bibiri by’ukuri?',
      category: category._id,
      options: [
        { id: 'a', label: 'a', text: 'A', isCorrect: true },
        { id: 'b', label: 'b', text: 'B', isCorrect: true },
      ],
      status: 'review',
    });
    const res = await request(app)
      .post('/api/admin/questions/bulk')
      .set('Authorization', authHeader(admin))
      .send({ action: 'publish', ids: [String(broken._id)] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NOT_EXAMINABLE');
  });

  it('allows a learner to report a question', async () => {
    const [q] = await createQuestions(category, 1);
    const res = await request(app)
      .post('/api/me/reports')
      .set('Authorization', authHeader(student))
      .send({ questionId: String(q._id), reason: 'typo', message: 'Hari ikosa mu nyuguti' });
    expect(res.status).toBe(201);

    const dupe = await request(app)
      .post('/api/me/reports')
      .set('Authorization', authHeader(student))
      .send({ questionId: String(q._id), reason: 'typo' });
    expect(dupe.status).toBe(409);
  });
});
