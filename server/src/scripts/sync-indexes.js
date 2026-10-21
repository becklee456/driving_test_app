/**
 * One-time (idempotent) index maintenance for production.
 *
 * Production runs with autoIndex disabled, so schema index changes - like the
 * partial unique index on PaymentTransaction.transactionReference - must be
 * applied manually. Run once after each deploy that changes indexes:
 *
 *   ALLOW_PRODUCTION_SYNC_INDEXES=1 node src/scripts/sync-indexes.js
 *
 * For each model we compare the indexes the schema wants against the ones that
 * exist and:
 *   - drop any existing index that shares a name with a desired index but has
 *     different options (e.g. an old non-unique index named
 *     transactionReference_1 blocking the new partial-unique one), then
 *   - createIndex for every desired index (createIndex is a no-op when it
 *     already matches).
 * It never touches documents.
 */
import { pathToFileURL } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import config from '../config/env.js';
import logger from '../config/logger.js';
import * as models from '../models/index.js';

function normalizeOptions(opts = {}) {
  const { key, name, unique, sparse, partialFilterExpression, expireAfterSeconds, collation } = opts;
  return JSON.stringify({
    key,
    name,
    unique: Boolean(unique),
    sparse: Boolean(sparse),
    partialFilterExpression: partialFilterExpression || null,
    expireAfterSeconds: expireAfterSeconds ?? null,
    collation: collation || null,
  });
}

async function syncModelIndexes(name, model) {
  const collection = model.collection;
  const desired = model.schema.indexes().map(([key, opts]) => ({ key, opts: opts || {} }));

  const existing = await collection.indexes().catch(() => []);
  const existingByName = new Map(existing.map((idx) => [idx.name, idx]));

  let dropped = 0;
  for (const { opts } of desired) {
    const existingIdx = existingByName.get(opts.name);
    if (existingIdx && normalizeOptions(existingIdx) !== normalizeOptions({ ...opts, key: existingIdx.key })) {
      await collection.dropIndex(existingIdx.name);
      dropped += 1;
    }
  }

  await model.createIndexes();
  logger.info(`Synced indexes: ${name}${dropped ? ` (replaced ${dropped})` : ''}`);
}

async function main() {
  if (config.isProduction && !process.env.ALLOW_PRODUCTION_SYNC_INDEXES) {
    logger.error('Refusing to sync indexes in production without ALLOW_PRODUCTION_SYNC_INDEXES=1.');
    process.exitCode = 1;
    return;
  }

  await connectDatabase();

  const entries = Object.entries(models).filter(([, m]) => m?.schema?.indexes instanceof Function);
  for (const [name, model] of entries) {
    try {
      await syncModelIndexes(name, model);
    } catch (err) {
      logger.error(`Failed to sync indexes for ${name}: ${err.message}`);
      process.exitCode = 1;
    }
  }

  await disconnectDatabase();
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(async (err) => {
    logger.error(err);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  });
}
