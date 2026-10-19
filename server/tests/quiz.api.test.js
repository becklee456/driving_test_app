import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { getApp, authHeader } from './helpers/app.js';
import { createCategory, createQuestions, createUser, ensureSettings } from './helpers/fixtures.js';

const app = getApp();

describe('quiz API', () => {
  let user;
  let headers;
  let category;

  beforeEach(async () => {
    await ensureSettings({ practiceDefaultCount: 5, examQuestionCount: 10, passingScorePercent: 80 });
    category = await createCategory();
    await createQuestions(category, 10);
    user = await createUser({ email: 'quizzer@test.rw' });
    headers = { Authorization: authHeader(user) };
  });

  it('starts a practice quiz without revealing correct answers', async () => {
    const res = await request(app).post('/api/quizzes').set(headers).send({ type: 'practice', count: 5 });
    expect(res.status).toBe(201);
    expect(res.body.data.quiz.id).toBeTruthy();
    expect(res.body.data.questions).toHaveLength(5);
    for (const q of res.body.data.questions) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.options[0].isCorrect).toBeUndefined();
    }
  });

  it('saves an answer with immediate feedback in practice mode', async () => {
    const start = await request(app).post('/api/quizzes').set(headers).send({ type: 'practice', count: 5 });
    const quizId = start.body.data.quiz.id;
    const question = start.body.data.questions[0];

    const res = await request(app)
      .post(`/api/quizzes/${quizId}/answers`)
      .set(headers)
      .send({ questionId: question.id, selectedOptionId: 'a', timeSpentMs: 3000 });

    expect(res.status).toBe(200);
    expect(res.body.data.answered).toBe(true);
    expect(res.body.data.correct).toBe(true);
    expect(res.body.data.correctOptionIds).toEqual(['a']);
  });

  it('submits a quiz and reports the score', async () => {
    const start = await request(app).post('/api/quizzes').set(headers).send({ type: 'practice', count: 5 });
    const { quiz, questions } = start.body.data;
    const selections = Object.fromEntries(questions.map((q) => [q.id, 'a']));

    const res = await request(app).post(`/api/quizzes/${quiz.id}/submit`).set(headers).send({ selections, durationSec: 60 });
    expect(res.status).toBe(200);
    expect(res.body.data.score.correct).toBe(5);
    expect(res.body.data.score.percentage).toBe(100);
    expect(res.body.data.details).toHaveLength(5);

    const again = await request(app).post(`/api/quizzes/${quiz.id}/submit`).set(headers).send({ selections });
    expect(again.status).toBe(409);
  });

  it('grades a mock exam against the passing score', async () => {
    const start = await request(app).post('/api/quizzes').set(headers).send({ type: 'mock' });
    expect(start.status).toBe(201);
    const { quiz, questions } = start.body.data;
    expect(quiz.config.passingScore).toBe(80);

    const selections = Object.fromEntries(questions.map((q) => [q.id, 'a']));
    const res = await request(app).post(`/api/quizzes/${quiz.id}/submit`).set(headers).send({ selections });
    expect(res.body.data.score.passed).toBe(true);
  });

  it('returns the active quiz so a learner can resume', async () => {
    await request(app).post('/api/quizzes').set(headers).send({ type: 'practice', count: 5 });
    const res = await request(app).get('/api/quizzes/active').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.data.quiz).toBeTruthy();
    expect(res.body.data.questions.length).toBe(5);
  });

  it('fails when fewer than five questions are available', async () => {
    await createCategory({ slug: 'empty', name: 'Empty' });
    const res = await request(app)
      .post('/api/quizzes')
      .set(headers)
      .send({ type: 'practice', count: 5, categories: ['empty'] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INSUFFICIENT_QUESTIONS');
  });
});
