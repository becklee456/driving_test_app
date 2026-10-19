import request from 'supertest';
import { createApp } from '../../src/app.js';
import { signAccessToken } from '../../src/middleware/auth.js';

let app;
export function getApp() {
  if (!app) app = createApp();
  return app;
}

export function authHeader(user) {
  return `Bearer ${signAccessToken(user)}`;
}

export async function api() {
  return request(getApp());
}

export async function loginRequest(email, password) {
  const res = await request(getApp()).post('/api/auth/login').send({ email, password });
  return res;
}
