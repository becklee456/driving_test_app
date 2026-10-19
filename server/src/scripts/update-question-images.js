import fs from 'node:fs';
import path from 'node:path';
import config from '../config/env.js';
import logger from '../config/logger.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { Question } from '../models/index.js';
import { normalizeImages } from '../services/question.service.js';

/**
 * Copies the `images` arrays from data/questions.json onto the matching
 * Question documents (matched by `sourceId`).
 *
 * Dry-run by default (prints a preview + writes nothing):
 *   npm run update:images
 *
 * Apply (writes a JSON backup, then updates):
 *   npm run update:images -- --apply
 */
const APPLY = process.argv.includes('--apply');

async function loadSource() {
  const raw = await fs.promises.readFile(config.questionsFile, 'utf8');
  const records = JSON.parse(raw);
  return records
    .map((q) => ({ sourceId: q.id, questionNumber: q.questionNumber, images: normalizeImages(q.images) }))
    .filter((q) => q.images.length);
}

async function main() {
  await connectDatabase();
  const source = await loadSource();

  const report = { ok: 0, update: 0, missing: 0, unchanged: [] };
  const pending = [];
  const backups = [];

  for (const item of source) {
    const doc = await Question.findOne({ sourceId: item.sourceId }).lean();
    if (!doc) {
      report.missing += 1;
      logger.warn(`Ikibazo nticyabonetse kuri sourceId=${item.sourceId} (#${item.questionNumber})`);
      continue;
    }
    const current = (doc.images || []).filter((i) => i.url).map((i) => i.url);
    const next = item.images.map((i) => i.url);
    if (JSON.stringify(current) === JSON.stringify(next)) {
      report.ok += 1;
      continue;
    }
    report.update += 1;
    report.unchanged.push(`#${doc.questionNumber} ${current.length} -> ${next.length}`);
    pending.push({ id: doc._id, sourceId: doc.sourceId, questionNumber: doc.questionNumber, images: item.images });
    backups.push({ _id: doc._id, sourceId: doc.sourceId, questionNumber: doc.questionNumber, image: doc.image, images: doc.images });
  }

  logger.info(
    `images source: ${source.length} | already: ${report.ok} | to update: ${report.update} | missing: ${report.missing}`,
  );

  if (!APPLY) {
    for (const line of report.unchanged) logger.info(`  would update ${line}`);
    logger.info('DRY-RUN: nta guhindura byakozwe. Ongera utangize --apply kugira ubikore.');
    await disconnectDatabase();
    return;
  }

  if (!pending.length) {
    logger.info('Nta guhindura bikenewe.');
    await disconnectDatabase();
    return;
  }

  const backupDir = path.resolve(config.serverRoot, '..', 'data', 'backup');
  await fs.promises.mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `question-images-backup-${stamp}.json`);
  await fs.promises.writeFile(backupFile, JSON.stringify(backups, null, 2), 'utf8');
  logger.info(`Backup: ${backupFile} (${backups.length} documents)`);

  let modified = 0;
  for (const p of pending) {
    const first = p.images[0];
    const res = await Question.updateOne(
      { _id: p.id },
      {
        $set: {
          images: p.images,
          image: first ? { url: first.url, alt: first.alt || '', publicId: null } : { url: null, alt: '' },
        },
      },
    );
    modified += res.modifiedCount || 0;
  }
  logger.info(`Byarangiye: ${modified} ibibazo byahinduwe.`);
  await disconnectDatabase();
}

main().catch(async (err) => {
  logger.error('Guhuza amashusho y’ibibazo byanze', { message: err.message, stack: err.stack });
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
