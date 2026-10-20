import { pathToFileURL } from 'node:url';
import logger from '../config/logger.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { Plan } from '../models/index.js';
import { PLANS, LEGACY_PLAN_CODES } from '../seed/plans.data.js';

/**
 * Upserts the official 8-plan premium catalogue keyed on `code`:
 *  - missing plans are created (active, with createdBy unset)
 *  - existing plans are updated in place (business fields only — `isActive`,
 *    `createdBy` and other audit fields are left untouched so administrator
 *    decisions survive re-runs)
 *  - legacy plans (quick_start_*) are soft-deactivated, never deleted
 *
 * Running this twice is a no-op: the second run reports 0 created / 0 changed.
 */

const UPSERT_FIELDS = [
  'name',
  'description',
  'price',
  'originalPrice',
  'currency',
  'durationDays',
  'isLifetime',
  'interval',
  'badge',
  'features',
  'entitlements',
  'order',
  'isPopular',
];

/** Fields whose stored value differs from the catalogue definition. */
function changedFields(existing, def) {
  const changed = [];
  for (const key of UPSERT_FIELDS) {
    const next = def[key] === undefined ? null : def[key];
    const prev = existing[key] === undefined ? null : existing[key];
    if (JSON.stringify(prev) !== JSON.stringify(next)) changed.push(key);
  }
  return changed;
}

/** Guard: a catalogue entry must be internally consistent before upserting. */
function validateDefinition(def) {
  if (def.isLifetime && def.durationDays != null) {
    throw new Error(`plan ${def.code}: lifetime plans must not set durationDays`);
  }
  if (!def.isLifetime && !(Number(def.durationDays) > 0)) {
    throw new Error(`plan ${def.code}: timed plans need durationDays >= 1`);
  }
  if (def.originalPrice != null && def.originalPrice < def.price) {
    throw new Error(`plan ${def.code}: originalPrice must be >= price`);
  }
}

/**
 * Applies the catalogue. Returns a report describing every action (and is a
 * no-op when `apply` is false — dry-run preview).
 */
export async function syncPlanCatalogue({ apply = false } = {}) {
  const report = {
    apply,
    plans: { total: PLANS.length, created: [], updated: [], unchanged: [] },
    legacy: { deactivated: [], alreadyInactive: [] },
  };

  const codes = PLANS.map((p) => p.code);
  if (new Set(codes).size !== codes.length) throw new Error('duplicate plan codes in catalogue');
  PLANS.forEach(validateDefinition);

  const existingByCode = new Map(
    (await Plan.find({ code: { $in: codes } }).lean()).map((doc) => [doc.code, doc]),
  );

  for (const def of PLANS) {
    const existing = existingByCode.get(def.code);
    if (!existing) {
      report.plans.created.push(def.code);
      if (apply) await Plan.create({ ...def, isActive: true });
      continue;
    }
    const changed = changedFields(existing, def);
    if (!changed.length) {
      report.plans.unchanged.push(def.code);
      continue;
    }
    report.plans.updated.push({ code: def.code, fields: changed });
    if (apply) {
      // Business fields only: never touch isActive/createdBy/updatedBy here.
      await Plan.updateOne({ _id: existing._id }, { $set: Object.fromEntries(changed.map((k) => [k, def[k]])) });
    }
  }

  const legacyActive = await Plan.find({ code: { $in: LEGACY_PLAN_CODES }, isActive: true }).lean();
  for (const doc of legacyActive) report.legacy.deactivated.push(doc.code);
  const legacyAll = await Plan.find({ code: { $in: LEGACY_PLAN_CODES } }).lean();
  for (const doc of legacyAll) {
    if (!doc.isActive) report.legacy.alreadyInactive.push(doc.code);
  }
  if (apply && legacyActive.length) {
    await Plan.updateMany(
      { code: { $in: legacyActive.map((d) => d.code) } },
      { $set: { isActive: false } },
    );
  }

  return report;
}

function printReport(report) {
  const { plans, legacy } = report;
  logger.info(
    `plan catalogue (${report.apply ? 'APPLY' : 'DRY-RUN'}): ` +
      `${plans.total} plans — created ${plans.created.length}, updated ${plans.updated.length}, unchanged ${plans.unchanged.length}`,
  );
  for (const code of plans.created) logger.info(`  + create ${code}`);
  for (const { code, fields } of plans.updated) logger.info(`  ~ update ${code} (${fields.join(', ')})`);
  for (const code of legacy.deactivated) logger.info(`  - deactivate legacy ${code}`);
  for (const code of legacy.alreadyInactive) logger.info(`  = legacy ${code} already inactive`);
}

async function main() {
  const apply = process.argv.includes('--apply');
  await connectDatabase();
  try {
    const report = await syncPlanCatalogue({ apply });
    printReport(report);
    if (apply) {
      const total = await Plan.countDocuments();
      const active = await Plan.countDocuments({ isActive: true });
      logger.info(`plan table after apply: ${total} rows (${active} active)`);
    } else {
      logger.info('Dry run only. Re-run with --apply to write changes.');
    }
  } finally {
    await disconnectDatabase();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(async (err) => {
    logger.error(err);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  });
}

export default syncPlanCatalogue;
