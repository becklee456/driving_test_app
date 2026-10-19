import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuditLog } from '../../hooks/useAdmin.js';
import { useDebounce } from '../../hooks/useUi.js';
import { Card, Badge, Skeleton, EmptyState } from '../../components/ui/primitives.jsx';
import { Input, Select } from '../../components/ui/form.jsx';
import { Pagination } from '../../components/ui/nav.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Icon } from '../../components/icons.jsx';
import { formatDateTime } from '../../lib/format.js';

export default function AdminAudit() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [result, setResult] = useState('all');
  const debouncedAction = useDebounce(action);

  const params = useMemo(
    () => ({ page, limit: 30, action: debouncedAction || undefined, result }),
    [page, debouncedAction, result],
  );
  const { data, isLoading } = useAuditLog(params);
  const items = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <PageHeader title={t('admin.audit')} subtitle={`${meta?.total || 0}`} />

      <Card className="p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="action e.g. auth.login" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
          <Select value={result} onChange={(e) => { setResult(e.target.value); setPage(1); }}>
            <option value="all">{t('common.status')}: {t('common.all')}</option>
            <option value="success">success</option>
            <option value="failure">failure</option>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : items.length ? (
          <>
            <ul className="divide-y divide-slate-100">
              {items.map((a) => (
                <li key={a._id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 rounded-lg bg-slate-100 p-1.5 text-slate-500">
                    <Icon name="activity" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{a.action}</span>
                      {a.result ? <Badge color={a.result === 'success' ? 'success' : 'danger'}>{a.result}</Badge> : null}
                      {a.resource ? <Badge color="neutral">{a.resource}</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {a.actor?.fullName || a.actor?.email || 'system'}
                      {a.ip ? ` · ${a.ip}` : ''} · {formatDateTime(a.createdAt)}
                    </p>
                    {a.meta ? <p className="mt-0.5 truncate text-xs text-slate-400">{JSON.stringify(a.meta)}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-100 px-4 py-3">
              <Pagination page={meta?.page || 1} pages={meta?.pages || 1} onChange={setPage} />
            </div>
          </>
        ) : (
          <EmptyState icon={<Icon name="activity" className="h-8 w-8" />} title={t('common.no_data')} />
        )}
      </Card>
    </div>
  );
}
