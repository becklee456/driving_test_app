import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProgress } from '../../hooks/useProgress.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Card, Badge, ProgressBar, Skeleton, EmptyState } from '../../components/ui/primitives.jsx';
import { Ring } from '../../components/charts/index.jsx';
import { Icon } from '../../components/icons.jsx';
import { formatDuration, formatDate } from '../../lib/format.js';

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: progress, isLoading } = useProgress();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const overview = progress?.overview || {};
  const coverage = progress?.coverage || {};
  const gamification = progress?.gamification || {};
  const dailyGoal = progress?.dailyGoal || { goal: 20, answeredToday: 0, percent: 0 };
  const activeQuiz = progress?.activeQuiz;
  const recentQuizzes = progress?.recentQuizzes || [];
  const weak = progress?.weakCategories || [];
  const strong = progress?.strongCategories || [];

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 px-5 py-6 text-white sm:px-7">
        <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-rwanda-yellow/20 blur-2xl" />
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-brand-100">{t('dashboard.greeting')}</p>
            <h1 className="mt-1 text-2xl font-bold">{t('dashboard.welcome', { name: user?.fullName?.split(' ')[0] || '' })}</h1>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5">
                <Icon name="fire" className="h-4 w-4" /> {gamification.currentStreak || 0} {t('dashboard.streak')}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5">
                <Icon name="sparkles" className="h-4 w-4" /> {t('dashboard.level')} {gamification.level || 1}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5">
                <Icon name="trophy" className="h-4 w-4" /> {gamification.xp || 0} {t('dashboard.xp')}
              </span>
            </div>
          </div>
          <div className="shrink-0">
            <Ring value={dailyGoal.percent} size={104} stroke={10} color="#ffffff" sublabel={t('dashboard.daily_goal')} />
          </div>
        </div>
      </section>

      {activeQuiz ? (
        <Card className="flex items-center justify-between gap-4 border-brand-200 bg-brand-50 p-4">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-white p-2 text-brand-700">
              <Icon name="play" />
            </span>
            <div>
              <p className="font-semibold text-brand-900">{t('dashboard.resume_quiz')}</p>
              <p className="text-xs text-brand-700">{activeQuiz.type} · {activeQuiz.questions?.length || 0} {t('common.questions')}</p>
            </div>
          </div>
          <Link to={`/quiz/${activeQuiz._id}`} className="btn-primary btn-sm">
            {t('common.continue')}
          </Link>
        </Card>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Link to="/app/practice" className="card flex items-center gap-3 p-4 transition hover:shadow-pop">
          <span className="rounded-xl bg-brand-50 p-2 text-brand-700">
            <Icon name="play" />
          </span>
          <span className="font-semibold text-slate-800">{t('dashboard.start_practice')}</span>
        </Link>
        <Link to="/app/mock" className="card flex items-center gap-3 p-4 transition hover:shadow-pop">
          <span className="rounded-xl bg-amber-50 p-2 text-amber-600">
            <Icon name="clipboard" />
          </span>
          <span className="font-semibold text-slate-800">{t('dashboard.start_mock')}</span>
        </Link>
        <Link to="/app/categories" className="card flex items-center gap-3 p-4 transition hover:shadow-pop">
          <span className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
            <Icon name="grid" />
          </span>
          <span className="font-semibold text-slate-800">{t('dashboard.browse_categories')}</span>
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-slate-500">{t('dashboard.accuracy')}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{overview.accuracy || 0}%</p>
          <ProgressBar value={overview.accuracy || 0} color="success" className="mt-2" />
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">{t('dashboard.coverage')}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{coverage.coveragePercent || 0}%</p>
          <p className="mt-1 text-xs text-slate-400">{coverage.studied || 0} / {coverage.totalQuestions || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">{t('dashboard.mastered')}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{coverage.mastered || 0}</p>
          <p className="mt-1 text-xs text-slate-400">{coverage.needsWork || 0} {t('dashboard.needs_work').toLowerCase()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">{t('dashboard.study_time')}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatDuration(overview.totalStudySeconds || 0)}</p>
          <p className="mt-1 text-xs text-slate-400">{overview.testsCompleted || 0} {t('dashboard.tests_completed').toLowerCase()}</p>
        </Card>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">{t('dashboard.weak_areas')}</h3>
          </div>
          <div className="p-4">
            {weak.length ? (
              <ul className="space-y-3">
                {weak.slice(0, 4).map((c) => (
                  <li key={c.slug}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{c.name}</span>
                      <span className="text-slate-500">{c.accuracy}%</span>
                    </div>
                    <ProgressBar value={c.accuracy} color="danger" className="mt-1" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">{t('common.no_data')}</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">{t('dashboard.strong_areas')}</h3>
          </div>
          <div className="p-4">
            {strong.length ? (
              <ul className="space-y-3">
                {strong.slice(0, 4).map((c) => (
                  <li key={c.slug}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{c.name}</span>
                      <span className="text-slate-500">{c.accuracy}%</span>
                    </div>
                    <ProgressBar value={c.accuracy} color="success" className="mt-1" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">{t('common.no_data')}</p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">{t('dashboard.recent_quizzes')}</h3>
          <Link to="/app/progress" className="text-xs font-medium text-brand-700 hover:underline">
            {t('nav.progress')} →
          </Link>
        </div>
        {recentQuizzes.length ? (
          <ul className="divide-y divide-slate-100">
            {recentQuizzes.map((q) => (
              <li key={q._id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium capitalize text-slate-800">{q.type}{q.title ? ` · ${q.title}` : ''}</p>
                  <p className="text-xs text-slate-400">{formatDate(q.submittedAt)} · {formatDuration(q.durationSec || 0)}</p>
                </div>
                <div className="text-right">
                  <Badge color={(q.score?.percentage || 0) >= 80 ? 'success' : (q.score?.percentage || 0) >= 50 ? 'warning' : 'danger'}>
                    {q.score?.percentage || 0}%
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Icon name="clipboard" className="h-8 w-8" />} title={t('dashboard.no_quizzes')} description={t('dashboard.start_practice')} />
        )}
      </Card>
    </div>
  );
}
