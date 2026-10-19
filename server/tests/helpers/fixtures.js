import { User, Category, Question, Settings } from '../../src/models/index.js';
import { ROLES } from '../../src/constants/permissions.js';

export async function createCategory(overrides = {}) {
  return Category.create({
    name: 'Ibimenyetso by’umuhanda',
    slug: 'traffic-signs',
    icon: 'sign',
    color: '#2563eb',
    order: 0,
    ...overrides,
  });
}

export function questionData(category, overrides = {}) {
  return {
    questionNumber: 1,
    questionText: 'Ikinyabiziga kigomba kugira iki?',
    category: category?._id || null,
    categorySlug: category?.slug || null,
    options: [
      { id: 'a', label: 'a', text: 'Umuyobozi', isCorrect: true },
      { id: 'b', label: 'b', text: 'Umuherekeza', isCorrect: false },
      { id: 'c', label: 'c', text: 'Nta muntu', isCorrect: false },
    ],
    difficulty: 'medium',
    status: 'active',
    source: 'test',
    ...overrides,
  };
}

export async function createQuestions(category, count = 10) {
  const docs = [];
  for (let i = 0; i < count; i += 1) {
    docs.push(
      questionData(category, {
        questionNumber: i + 1,
        questionText: `Ikibazo nimero ${i + 1} gisaba igisubizo cy’ukuri?`,
      }),
    );
  }
  return Question.insertMany(docs);
}

export async function createUser(overrides = {}) {
  const user = new User({
    fullName: overrides.fullName || 'Umunyeshuri',
    email: overrides.email || `user${Math.random().toString(36).slice(2, 8)}@test.rw`,
    role: overrides.role || ROLES.USER,
  });
  await user.setPassword(overrides.password || 'Password123');
  user.emailVerified = overrides.emailVerified ?? true;
  user.status = overrides.status || 'active';
  await user.save();
  return user;
}

export async function ensureSettings(overrides = {}) {
  const settings = await Settings.getSettings();
  Object.assign(settings, overrides);
  await settings.save();
  return settings;
}
