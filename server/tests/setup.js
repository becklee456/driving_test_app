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
  await dropDatabase();
  await disconnectDatabase();
});
