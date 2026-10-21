/**
 * One-time (idempotent) index maintenance for production.
 *
 * Production runs with autoIndex disabled, so schema index changes - like the
 * partial unique index on PaymentTransaction.transactionReference - must be
 * applied manually. Run once after each deploy that changes indexes:
 *
 *   node src/scripts/sync-indexes.js
 *
 * syncIndexes() drops indexes that no longer match the schema and builds the
 * current set. It never touches documents.
 */
import { pathToFileURL } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import config from '../config/env.js';
import logger from '../config/logger.js';
import * as models from '../models/index.js';

async function main() {
  if (config.isProduction && !process.env.ALLOW_PRODUCTION_SYNC_INDEXES) {
    logger.error('Refusing to sync indexes in production without ALLOW_PRODUCTION_SYNC_INDEXES=1.');
    process.exitCode = 1;
    return;
  }

  await connectDatabase();

  const entries = Object.entries(models).filter(([, m]) => m?.syncIndexes instanceof Function);
  for (const [name, model] of entries) {
    try {
      await model.syncIndexes();
      logger.info(`Synced indexes: ${name}`);
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
