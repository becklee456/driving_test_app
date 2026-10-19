import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCategoryProgress } from '../../hooks/useProgress.js';
import { useCategories } from '../../hooks/useCategories.js';
import { Card, Skeleton, EmptyState } from '../../components/ui/primitives.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { ProgressBar } from '../../components/ui/primitives.jsx';
import { Icon } from '../../components/icons.jsx';

export default function Categories() {
  const { t } = useTranslation();
  const { data: categories } = useCategories();
  const { data: progress, isLoading } = useCategoryProgress();

  const merged = (categories || []).map((cat) => {
    const p = (progress || []).find((x) => x.slug === cat.slug) || {};
    return { ...cat, ...p };
  });

  return (
    <div>
      <PageHeader title={t('categories.title')} subtitle={t('categories.subtitle')} />
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : merged.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {merged.map((cat) => (
            <Card key={cat.slug} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color || '#2563eb' }} />
                  <h3 className="font-semibold text-slate-900">{cat.name}</h3>
                </div>
                <span className="text-xs text-slate-400">{cat.questionCount || cat.totalQuestions || 0}</span>
              </div>
              {cat.description ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{cat.description}</p> : null}
              <div className="mt-3 space-y-2">
                <div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{t('categories.coverage')}</span>
                    <span>{cat.coverage || 0}%</span>
                  </div>
                  <ProgressBar value={cat.coverage || 0} className="mt-1" />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{t('categories.accuracy')}</span>
                    <span>{cat.accuracy || 0}%</span>
                  </div>
                  <ProgressBar value={cat.accuracy || 0} color="success" className="mt-1" />
                </div>
              </div>
              <Link to={`/app/practice?category=${cat.slug}`} className="btn-secondary btn-sm mt-4 justify-center">
                {t('categories.start')}
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Icon name="grid" className="h-8 w-8" />} title={t('categories.empty')} />
      )}
    </div>
  );
}
