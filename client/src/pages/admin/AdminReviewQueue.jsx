import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useReviewQueue } from '../../hooks/useAdmin.js';
import { useUpdateQuestion } from '../../hooks/useQuestions.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Badge, Skeleton, EmptyState } from '../../components/ui/primitives.jsx';
import { Button } from '../../components/ui/form.jsx';
import { Pagination } from '../../components/ui/nav.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Icon } from '../../components/icons.jsx';

export default function AdminReviewQueue() {
  const { t } = useTranslation();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useReviewQueue({ page, limit: 20 });
  const update = useUpdateQuestion();

  const payload = data?.data || {};
  const items = payload.items || [];
  const meta = {
    total: payload.total || 0,
    page: payload.page || 1,
    pages: Math.max(1, Math.ceil((payload.total || 0) / (payload.limit || 20))),
  };

  const approve = async (id) => {
    try {
      await update.mutateAsync({ id, status: 'active' });
      toast.success(t('common.updated'));
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  const reject = async (id) => {
    try {
      await update.mutateAsync({ id, status: 'inactive' });
      toast.success(t('common.updated'));
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('admin.review_queue')} subtitle={`${meta?.total || 0} ${t('admin.needs_review')}`} />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : items.length ? (
          <>
            <ul className="divide-y divide-slate-100">
              {items.map((q) => (
                <li key={q.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color="neutral">#{q.questionNumber}</Badge>
                    {q.needsReview ? <Badge color="warning">{t('admin.needs_review')}</Badge> : null}
                    {!q.examinable ? <Badge color="danger">{t('admin.no_answer')}</Badge> : null}
                    {q.category?.name ? <span className="text-xs text-slate-400">{q.category.name}</span> : null}
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-800">{q.questionText}</p>
                  <ul className="mt-2 space-y-1">
                    {(q.options || []).map((o) => (
                      <li key={o.id} className={o.isCorrect ? 'text-sm font-medium text-emerald-600' : 'text-sm text-slate-500'}>
                        {o.label.toUpperCase()}. {o.text}
                        {o.isCorrect ? <Icon name="check" className="ml-1 inline h-3.5 w-3.5" /> : null}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="success" onClick={() => approve(q.id)}>
                      <Icon name="check" className="h-4 w-4" /> {t('admin.approve')}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => reject(q.id)}>
                      {t('admin.reject')}
                    </Button>
                    <Link to={`/admin/questions/${q.id}`} className="btn-secondary btn-sm">
                      <Icon name="edit" className="h-4 w-4" /> {t('common.edit')}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-100 px-4 py-3">
              <Pagination page={meta?.page || 1} pages={meta?.pages || 1} onChange={setPage} />
            </div>
          </>
        ) : (
          <EmptyState icon={<Icon name="check" className="h-8 w-8" />} title={t('admin.review_empty')} />
        )}
      </Card>
    </div>
  );
}
