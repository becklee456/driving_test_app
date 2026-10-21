import fs from 'node:fs/promises';
import config from '../config/env.js';
import logger from '../config/logger.js';
import { connectDatabase, disconnectDatabase, dropDatabase } from '../config/db.js';
import { User, Category, Question, Achievement, Settings, Plan } from '../models/index.js';
import { ROLES } from '../constants/permissions.js';
import { CATEGORIES } from './categories.data.js';
import { ACHIEVEMENTS } from './achievements.data.js';
import { PLANS } from './plans.data.js';
import { normalizeQuestionText } from '../utils/slug.js';
import { normalizeImages } from '../services/question.service.js';

const flags = new Set(process.argv.slice(2));
const FRESH = flags.has('--fresh');
const WITH_QUESTIONS = !flags.has('--no-questions');
const WITH_USERS = !flags.has('--no-users');

async function seedCategories() {
  let created = 0;
  for (let i = 0; i < CATEGORIES.length; i += 1) {
    const cat = CATEGORIES[i];
    const result = await Category.updateOne(
      { slug: cat.slug },
      {
        $set: {
          name: cat.name,
          nameEn: cat.nameEn || '',
          description: cat.description || '',
          icon: cat.icon,
          color: cat.color,
          order: i,
          isActive: true,
        },
        $setOnInsert: { slug: cat.slug },
      },
      { upsert: true },
    );
    if (result.upsertedCount) created += 1;
  }
  logger.info(`Categories: ${CATEGORIES.length} (${created} bishya)`);
  return Category.find();
}

async function seedAchievements() {
  let created = 0;
  for (const def of ACHIEVEMENTS) {
    const result = await Achievement.updateOne(
      { code: def.code },
      { $set: { ...def, isActive: true } },
      { upsert: true },
    );
    if (result.upsertedCount) created += 1;
  }
  logger.info(`Achievements: ${ACHIEVEMENTS.length} (${created} bishya)`);
}

async function seedSettings() {
  const settings = await Settings.getSettings();
  await settings.save();
  logger.info('Settings: byateguwe (passing score ' + settings.passingScorePercent + '%)');
  return settings;
}

/**
 * Upserts the default plan catalogue. Existing plans are left untouched on
 * `$setOnInsert` semantics so administrator price/feature edits survive.
 */
async function seedPlans() {
  let created = 0;
  for (const plan of PLANS) {
    const result = await Plan.updateOne(
      { code: plan.code },
      { $setOnInsert: { ...plan, currency: 'RWF', isActive: true } },
      { upsert: true },
    );
    if (result.upsertedCount) created += 1;
  }
  logger.info(`Plans: ${PLANS.length} (${created} bishya)`);
}

const KNOWN_DEFAULT_PASSWORDS = new Set([
  'Admin@12345',
  'Editor@12345',
  'Mod@12345',
  'Student@12345',
  'Manager@12345',
]);

async function seedUsers() {
  const { seed } = config;
  const accounts = [
    { fullName: 'Super Admin', email: seed.adminEmail, password: seed.adminPassword, role: ROLES.SUPER_ADMIN },
    { fullName: 'Umuyobozi', email: 'manager@ikizamini.rw', password: 'Manager@12345', role: ROLES.ADMIN },
    { fullName: 'Umwanditsi', email: seed.editorEmail, password: seed.editorPassword, role: ROLES.EDITOR },
    { fullName: 'Umugenzuzi', email: seed.moderatorEmail, password: seed.moderatorPassword, role: ROLES.MODERATOR },
    { fullName: 'Umunyeshuri', email: seed.studentEmail, password: seed.studentPassword, role: ROLES.USER },
  ];

  // Never create well-known credentials in production.
  if (config.isProduction) {
    const usingDefaults = accounts.filter((a) => KNOWN_DEFAULT_PASSWORDS.has(a.password));
    if (usingDefaults.length) {
      throw new Error(
        'Refusing to seed default credentials in production. Set strong SEED_*_PASSWORD ' +
          `env vars for: ${usingDefaults.map((a) => a.email).join(', ')}`,
      );
    }
  }

  const created = [];
  for (const account of accounts) {
    const email = account.email.toLowerCase();
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ fullName: account.fullName, email, role: account.role });
      await user.setPassword(account.password);
      user.emailVerified = true;
      user.status = 'active';
      await user.save();
      created.push(email);
    } else if (user.role !== account.role) {
      user.role = account.role;
      await user.save();
    }
  }
  logger.info(`Users: ${accounts.length} (${created.length} bishya: ${created.join(', ') || 'nta na umwe'})`);
}

async function importQuestions() {
  let raw;
  try {
    raw = await fs.readFile(config.questionsFile, 'utf8');
  } catch {
    logger.warn(`Nta dosiye y’ibibazo ibonetse: ${config.questionsFile}. Irengagijwe.`);
    return;
  }

  const records = JSON.parse(raw);
  const categories = await Category.find().select('slug _id');
  const bySlug = new Map(categories.map((c) => [c.slug, c._id]));
  const existing = new Set(
    (await Question.find().select('sourceId').lean()).map((q) => q.sourceId).filter(Boolean),
  );

  let inserted = 0;
  let skipped = 0;
  let active = 0;
  let review = 0;
  const buffer = [];

  for (const q of records) {
    if (q.id && existing.has(q.id)) {
      skipped += 1;
      continue;
    }
    const category = bySlug.get(q.category) || null;
    const doc = {
      sourceId: q.id || null,
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      normalizedText: normalizeQuestionText(q.questionText),
      category,
      categorySlug: q.category || null,
      options: (q.options || []).map((o, i) => ({
        id: o.id || String.fromCharCode(97 + i),
        label: o.label || String.fromCharCode(97 + i),
        text: o.text || '',
        isCorrect: Boolean(o.isCorrect),
      })),
      explanation: q.explanation || null,
      difficulty: q.difficulty || 'medium',
      tags: q.tags || [],
      image: q.image || { url: null, alt: '' },
      images: normalizeImages(q.images),
      source: q.source || 'official-document',
      status: q.examinable ? q.status || 'active' : 'review',
      flags: q.flags || [],
      needsReview: Boolean(q.needsReview) || !q.examinable,
    };
    if (doc.status === 'active') active += 1;
    else review += 1;

    try {
      buffer.push(doc);
      if (buffer.length >= 200) {
        await Question.insertMany(buffer, { ordered: false });
        inserted += buffer.length;
        buffer.length = 0;
      }
    } catch (err) {
      logger.warn('Ikibazo kimwe cyanze kwandikwa', { error: err.message, number: q.questionNumber });
      skipped += 1;
    }
  }

  if (buffer.length) {
    // Insert one-by-one fallback so a single bad record cannot drop the batch.
    for (const doc of buffer) {
      try {
        await Question.create(doc);
        inserted += 1;
      } catch (err) {
        skipped += 1;
        logger.warn('Ikibazo cyanze kwandikwa', { error: err.message, number: doc.questionNumber });
      }
    }
  }

  // Refresh denormalised counters.
  const counts = await Question.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$category', count: { $sum: 1 } } }]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  await Promise.all(
    categories.map((c) => Category.updateOne({ _id: c._id }, { $set: { questionCount: countMap.get(String(c._id)) || 0 } })),
  );

  logger.info(`Questions: ${inserted} byinjijwe, ${skipped} byasibwe (active: ${active}, review: ${review})`);
}

async function setUnassignedCategory() {
  const fallback = await Category.findOne({ slug: 'road-rules' });
  if (!fallback) return;
  const res = await Question.updateMany({ category: null }, { $set: { category: fallback._id, categorySlug: fallback.slug } });
  if (res.modifiedCount) logger.info(`Questions: ${res.modifiedCount} zahawe icyiciro rusange (road-rules)`);
}

async function main() {
  logger.info('Gutangira gushinga amakuru (seed)...');
  await connectDatabase();
  if (FRESH) {
    logger.warn('--fresh: gusiba database yose...');
    await dropDatabase();
  }

  await seedCategories();
  await seedAchievements();
  await seedSettings();
  await seedPlans();
  if (WITH_USERS) await seedUsers();
  if (WITH_QUESTIONS) {
    await importQuestions();
    await setUnassignedCategory();
  }

  const summary = {
    categories: await Category.countDocuments(),
    achievements: await Achievement.countDocuments(),
    plans: await Plan.countDocuments(),
    users: await User.countDocuments(),
    questions: await Question.countDocuments(),
    activeQuestions: await Question.countDocuments({ status: 'active' }),
  };
  logger.info('Byarangiye. Incamake:', summary);
  await disconnectDatabase();
  process.exit(0);
}

main().catch(async (err) => {
  logger.error('Gushinga amakuru byanze', { message: err.message, stack: err.stack });
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
