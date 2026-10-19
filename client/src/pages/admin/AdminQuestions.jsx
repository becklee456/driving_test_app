import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useAdminQuestions, useDeleteQuestion, useBulkQuestions } from '../../hooks/useQuestions.js';
import { useAdminCategories } from '../../hooks/useAdmin.js';
import { useDebounce } from '../../hooks/useUi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Badge, Skeleton, EmptyState } from '../../components/ui/primitives.jsx';
import { Button, Input, Select } from '../../components/ui/form.jsx';
import { Pagination } from '../../components/ui/nav.jsx';
import { Icon } from '../../components/icons.jsx';
import { QuestionPreviewModal } from '../../components/admin/QuestionPreviewModal.jsx';
import { QUESTION_STATUS, DIFFICULTIES } from '../../lib/constants.js';

const STATUS_COLOR = { active: 'success', review: 'warning', inactive: 'neutral' };

export default function AdminQuestions() {
  const { t } = useTranslation();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('all');
  const [hasImage, setHasImage] = useState('all');
  const [selected, setSelected] = useState([]);
  const [preview, setPreview] = useState(null);
  const debounced = useDebounce(search);

  const { data: categories } = useAdminCategories();
  const params = useMemo(
    () => ({
      page,
      limit: 20,
      search: debounced || undefined,
      status,
      category: category || undefined,
      difficulty,
      hasImage: hasImage === 'all' ? undefined : hasImage,
    }),
    [page, debounced, status, category, difficulty, hasImage],
  );
  const { data, isLoading } = useAdminQuestions(params);
  const del = useDeleteQuestion();
  const bulk = useBulkQuestions();

  const items = data?.data || [];
  const meta = data?.meta;
  const allSelected = items.length > 0 && selected.length === items.length;

  const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () => setSelected(allSelected ? [] : items.map((q) => q.id));

  const runBulk = async (action, extra = {}) => {
    try {
      await bulk.mutateAsync({ action, ids: selected, ...extra });
      toast.success(t('common.updated'));
      setSelected([]);
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  const onDelete = async (id) => {
    try {
      await del.mutateAsync(id);
      toast.success(t('common.deleted'));
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">{t('admin.questions')}</h1>
        <Link to="/admin/questions/new" className="btn-primary btn-sm">
          <Icon name="plus" className="h-4 w-4" /> {t('admin.new_question')}
        </Link>
      </div>

      <Card className="p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">{t('common.status')}: {t('common.all')}</option>
            {QUESTION_STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
            <option value="">{t('common.category')}: {t('common.all')}</option>
            {(categories || []).map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={difficulty} onChange={(e) => { setDifficulty(e.target.value); setPage(1); }}>
            <option value="all">{t('common.difficulty')}: {t('common.all')}</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Select value={hasImage} onChange={(e) => { setHasImage(e.target.value); setPage(1); }}>
            <option value="all">{t('admin.images', { defaultValue: 'Images' })}: {t('common.all')}</option>
            <option value="true">{t('admin.with_images', { defaultValue: 'With images' })}</option>
            <option value="false">{t('admin.without_images', { defaultValue: 'Without images' })}</option>
          </Select>
        </div>
      </Card>

      {selected.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5">
          <span className="text-sm font-medium text-brand-800">{selected.length} selected</span>
          <Button size="sm" variant="secondary" onClick={() => runBulk('publish')}>
            {t('admin.bulk_publish')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => runBulk('unpublish')}>
            {t('admin.bulk_unpublish')}
          </Button>
          <Button size="sm" variant="danger" onClick={() => runBulk('delete')}>
            {t('admin.bulk_delete')}
          </Button>
          <button type="button" className="ml-auto text-xs text-brand-700 hover:underline" onClick={() => setSelected([])}>
            {t('common.reset')}
          </button>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : items.length ? (
          <>
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded border-slate-300" aria-label={t('admin.select_all')} />
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('admin.select_all')}</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map((q) => (
                <li key={q.id} className="flex items-start gap-3 px-4 py-3">
                  <input type="checkbox" checked={selected.includes(q.id)} onChange={() => toggle(q.id)} className="mt-1 h-4 w-4 rounded border-slate-300" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color="neutral">#{q.questionNumber}</Badge>
                      <Badge color={STATUS_COLOR[q.status] || 'neutral'}>{q.status}</Badge>
                      {q.needsReview ? <Badge color="warning">review</Badge> : null}
                      {!q.examinable ? <Badge color="danger">no answer</Badge> : null}
                      {q.images?.length || q.image?.url ? (
                        <Badge color="brand">
                          <Icon name="image" className="mr-1 inline h-3 w-3" />
                          {q.images?.length || 1}
                        </Badge>
                      ) : null}
                      {q.category?.name ? <span className="text-xs text-slate-400">{q.category.name}</span> : null}
                      <span className="text-xs capitalize text-slate-400">{q.difficulty}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-700">{q.questionText}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => setPreview(q)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label={t('common.preview', { defaultValue: 'Preview' })} title={t('common.preview', { defaultValue: 'Preview' })}>
                      <Icon name="eye" className="h-4 w-4" />
                    </button>
                    <Link to={`/admin/questions/${q.id}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label={t('common.edit')}>
                      <Icon name="edit" className="h-4 w-4" />
                    </Link>
                    <button type="button" onClick={() => onDelete(q.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500" aria-label={t('common.delete')}>
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-100 px-4 py-3">
              <Pagination page={meta?.page || 1} pages={meta?.pages || 1} onChange={setPage} />
            </div>
          </>
        ) : (
          <EmptyState icon={<Icon name="clipboard" className="h-8 w-8" />} title={t('common.no_data')} />
        )}
      </Card>
      <p className={clsx('text-center text-xs text-slate-400', !meta && 'hidden')}>{meta?.total || 0} {t('common.questions')}</p>

      <QuestionPreviewModal question={preview} open={Boolean(preview)} onClose={() => setPreview(null)} />
    </div>
  );
}
