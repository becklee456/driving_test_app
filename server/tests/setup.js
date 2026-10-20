import { beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase, dropDatabase } from '../src/config/db.js';

beforeAll(async () => {
  await connectDatabase();
});

beforeEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  try {
    await dropDatabase();
  } catch {
    // The test DB user may lack dropDatabase; per-collection cleanup in
    // beforeEach already isolates tests, so teardown failure is safe to ignore.
  }
  await disconnectDatabase();
});
