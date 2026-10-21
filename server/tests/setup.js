import { beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import config from '../src/config/env.js';
import { connectDatabase, disconnectDatabase, dropDatabase } from '../src/config/db.js';
import * as models from '../src/models/index.js';

beforeAll(async () => {
  await connectDatabase();
  // Hard safety rail: never allow the suite to touch a production database.
  const name = mongoose.connection.name || '';
  if (config.isProduction || !name.includes('test')) {
    throw new Error(
      `Refusing to run tests against database "${name}" (env: ${config.env}). ` +
        'TEST_MONGO_URI must point at a database whose name contains "test".',
    );
  }
  // Rebuild indexes so schema-level guarantees (e.g. the partial unique index
  // on payment transactionReference) actually hold even when the shared test
  // database still has stale indexes from an older schema.
  await Promise.all(
    Object.values(models)
      .filter((m) => m?.syncIndexes instanceof Function)
      .map((m) => m.syncIndexes()),
  );
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
