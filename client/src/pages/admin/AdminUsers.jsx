import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminUsers, useUserMutations } from '../../hooks/useAdmin.js';
import { useDebounce } from '../../hooks/useUi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Badge, Skeleton, EmptyState, Avatar } from '../../components/ui/primitives.jsx';
import { Button, Input, Select } from '../../components/ui/form.jsx';
import { Pagination } from '../../components/ui/nav.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Icon } from '../../components/icons.jsx';
import { ROLES } from '../../lib/constants.js';
import { formatDate } from '../../lib/format.js';

const ROLE_COLOR = { SUPER_ADMIN: 'danger', ADMIN: 'brand', MODERATOR: 'info', EDITOR: 'warning', USER: 'neutral' };
const STATUS_COLOR = { active: 'success', suspended: 'danger', deactivated: 'neutral', pending: 'warning' };

export default function AdminUsers() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user: me } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const debounced = useDebounce(search);

  const params = useMemo(
    () => ({ page, limit: 20, search: debounced || undefined, role, status }),
    [page, debounced, role, status],
  );
  const { data, isLoading } = useAdminUsers(params);
  const { changeRole, suspend, activate, resetProgress, remove } = useUserMutations();

  const items = data?.data || [];
  const meta = data?.meta;

  const run = (mutation, payload) => async () => {
    try {
      await mutation.mutateAsync(payload);
      toast.success(t('common.updated'));
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('admin.users')} subtitle={`${meta?.total || 0} ${t('admin.total_users')}`} />

      <Card className="p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
            <option value="all">{t('admin.role')}: {t('common.all')}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">{t('common.status')}: {t('common.all')}</option>
            {['active', 'pending', 'suspended', 'deactivated'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : items.length ? (
          <>
            <ul className="divide-y divide-slate-100">
              {items.map((u) => {
                const self = u.id === me?.id || u._id === me?._id;
                return (
                  <li key={u.id || u._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <Avatar name={u.fullName || u.email} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {u.fullName || u.email}
                        {self ? <span className="ml-1 text-xs text-slate-400">(you)</span> : null}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {u.email} · {t('admin.joined')} {formatDate(u.createdAt)}
                      </p>
                    </div>
                    <Badge color={ROLE_COLOR[u.role] || 'neutral'}>{u.role}</Badge>
                    <Badge color={STATUS_COLOR[u.status] || 'neutral'}>{u.status}</Badge>
                    <div className="flex items-center gap-1">
                      <Select
                        value={u.role}
                        onChange={(e) => changeRole.mutateAsync({ id: u.id || u._id, role: e.target.value }).then(() => toast.success(t('common.updated'))).catch((err) => toast.error(err.message))}
                        className="w-32"
                        aria-label={t('admin.change_role')}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                      {u.status === 'suspended' ? (
                        <Button size="sm" variant="ghost" onClick={run(activate, u.id || u._id)}>
                          {t('admin.activate')}
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" disabled={self} onClick={run(suspend, u.id || u._id)}>
                          {t('admin.suspend')}
                        </Button>
                      )}
                      <button type="button" onClick={run(resetProgress, u.id || u._id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label={t('admin.reset_progress')} title={t('admin.reset_progress')}>
                        <Icon name="refresh" className="h-4 w-4" />
                      </button>
                      <button type="button" disabled={self} onClick={run(remove, u.id || u._id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30" aria-label={t('common.delete')}>
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-slate-100 px-4 py-3">
              <Pagination page={meta?.page || 1} pages={meta?.pages || 1} onChange={setPage} />
            </div>
          </>
        ) : (
          <EmptyState icon={<Icon name="users" className="h-8 w-8" />} title={t('common.no_data')} />
        )}
      </Card>
    </div>
  );
}
