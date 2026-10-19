import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBookmarks, useRemoveBookmark } from '../../hooks/useBookmarks.js';
import { Card, EmptyState, Skeleton, Badge } from '../../components/ui/primitives.jsx';
import { Button } from '../../components/ui/form.jsx';
import { Pagination } from '../../components/ui/nav.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Icon } from '../../components/icons.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function Bookmarks() {
  const { t } = useTranslation();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useBookmarks({ page });
  const remove = useRemoveBookmark();
  const items = data?.data || [];
  const meta = data?.meta;

  const onRemove = async (questionId) => {
    try {
      await remove.mutateAsync(questionId);
      toast.success(t('common.deleted'));
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  return (
    <div>
      <PageHeader title={t('bookmarks.title')} />
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : items.length ? (
        <div className="space-y-4">
          {items.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color="neutral">#{b.question.questionNumber}</Badge>
                  {b.question.categorySlug ? <Badge color="brand">{b.question.categorySlug}</Badge> : null}
                </div>
                <Button variant="ghost" size="sm" onClick={() => onRemove(b.question.id)}>
                  <Icon name="trash" className="h-4 w-4" /> {t('bookmarks.remove')}
                </Button>
              </div>
              <p className="mt-2 font-medium text-slate-900">{b.question.questionText}</p>
              {b.note ? <p className="mt-1 text-sm italic text-slate-500">“{b.note}”</p> : null}
              <ul className="mt-3 space-y-1.5">
                {(b.question.options || []).map((o) => (
                  <li key={o.id} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="font-semibold uppercase text-slate-400">{o.label}</span>
                    {o.text}
                  </li>
                ))}
              </ul>
              {b.question.explanation ? (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{b.question.explanation}</p>
              ) : null}
            </Card>
          ))}
          <Pagination page={meta?.page || 1} pages={meta?.pages || 1} onChange={setPage} />
        </div>
      ) : (
        <EmptyState icon={<Icon name="bookmark" className="h-8 w-8" />} title={t('bookmarks.empty')} />
      )}
    </div>
  );
}
