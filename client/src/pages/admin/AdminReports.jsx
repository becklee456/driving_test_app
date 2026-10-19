import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAdminReports, useUpdateReport } from '../../hooks/useAdmin.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Badge, Skeleton, EmptyState } from '../../components/ui/primitives.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { Button, Textarea } from '../../components/ui/form.jsx';
import { Pagination, Tabs } from '../../components/ui/nav.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Icon } from '../../components/icons.jsx';
import { relativeTime } from '../../lib/format.js';

const STATUS_COLOR = { pending: 'warning', under_review: 'info', resolved: 'success', rejected: 'neutral' };
const TABS = ['pending', 'under_review', 'resolved', 'rejected', 'all'];

export default function AdminReports() {
  const { t } = useTranslation();
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [note, setNote] = useState({});
  const { data, isLoading } = useAdminReports({ status, page, limit: 20 });
  const update = useUpdateReport();

  const items = data?.data || [];
  const meta = data?.meta;
  const counts = meta?.counts || {};

  const act = async (id, nextStatus) => {
    try {
      await update.mutateAsync({ id, status: nextStatus, resolutionNote: note[id] });
      toast.success(t('common.updated'));
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('admin.reports')} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('admin.pending')} value={counts.pending || 0} icon={<Icon name="flag" />} color="warning" />
        <StatCard label={t('admin.under_review')} value={counts.under_review || 0} icon={<Icon name="eye" />} color="info" />
        <StatCard label={t('admin.resolved')} value={counts.resolved || 0} icon={<Icon name="check" />} color="success" />
        <StatCard label={t('admin.rejected')} value={counts.rejected || 0} icon={<Icon name="x" />} color="neutral" />
      </div>

      <Tabs tabs={TABS.map((s) => ({ value: s, label: s.replace('_', ' ') }))} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : items.length ? (
          <>
            <ul className="divide-y divide-slate-100">
              {items.map((r) => (
                <li key={r._id || r.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={STATUS_COLOR[r.status] || 'neutral'}>{r.status.replace('_', ' ')}</Badge>
                    <Badge color="neutral">{r.reason}</Badge>
                    <span className="text-xs text-slate-400">{relativeTime(r.createdAt)}</span>
                  </div>
                  {r.question ? (
                    <Link to={`/admin/questions/${r.question._id}`} className="mt-2 block text-sm font-medium text-slate-800 hover:text-brand-700">
                      #{r.question.questionNumber} · {r.question.questionText}
                    </Link>
                  ) : null}
                  {r.message ? <p className="mt-1 text-sm text-slate-500">{r.message}</p> : null}
                  <p className="mt-1 text-xs text-slate-400">
                    {t('admin.reported_by')}: {r.user?.fullName || r.user?.email || '—'}
                  </p>
                  {['pending', 'under_review'].includes(r.status) ? (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        placeholder={t('admin.resolution_note')}
                        value={note[r._id] || ''}
                        onChange={(e) => setNote((n) => ({ ...n, [r._id]: e.target.value }))}
                        rows={2}
                      />
                      <div className="flex flex-wrap gap-2">
                        {r.status === 'pending' ? (
                          <Button size="sm" variant="secondary" onClick={() => act(r._id, 'under_review')}>
                            {t('admin.under_review')}
                          </Button>
                        ) : null}
                        <Button size="sm" variant="success" onClick={() => act(r._id, 'resolved')}>
                          <Icon name="check" className="h-4 w-4" /> {t('admin.resolve')}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => act(r._id, 'rejected')}>
                          {t('admin.reject')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    r.resolutionNote ? <p className="mt-2 text-xs text-slate-400">{r.resolutionNote}</p> : null
                  )}
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-100 px-4 py-3">
              <Pagination page={meta?.page || 1} pages={meta?.pages || 1} onChange={setPage} />
            </div>
          </>
        ) : (
          <EmptyState icon={<Icon name="flag" className="h-8 w-8" />} title={t('common.no_data')} />
        )}
      </Card>
    </div>
  );
}
