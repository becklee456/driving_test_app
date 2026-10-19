import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '../../hooks/useNotifications.js';
import { Card, EmptyState, Skeleton, Badge } from '../../components/ui/primitives.jsx';
import { Button } from '../../components/ui/form.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Icon } from '../../components/icons.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { relativeTime } from '../../lib/format.js';

const TYPE_ICON = {
  test_result: 'clipboard',
  achievement: 'trophy',
  security: 'shield',
  info: 'info',
  reminder: 'bell',
};

export default function Notifications() {
  const { t } = useTranslation();
  const toast = useToast();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items = data?.data || [];
  const unread = data?.meta?.unread || 0;

  const onMarkAll = async () => {
    try {
      await markAll.mutateAsync();
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  return (
    <div>
      <PageHeader
        title={t('notifications.title')}
        action={
          unread > 0 ? (
            <Button variant="secondary" size="sm" loading={markAll.isPending} onClick={onMarkAll}>
              {t('notifications.mark_all_read')}
            </Button>
          ) : null
        }
      />
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : items.length ? (
        <Card className="divide-y divide-slate-100">
          {items.map((n) => (
            <button
              key={n._id || n.id}
              type="button"
              onClick={() => !n.read && markRead.mutate(n._id || n.id)}
              className={clsx('flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50', !n.read && 'bg-brand-50/40')}
            >
              <span className={clsx('rounded-xl p-2', n.read ? 'bg-slate-100 text-slate-400' : 'bg-brand-100 text-brand-700')}>
                <Icon name={TYPE_ICON[n.type] || 'bell'} className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-800">{n.title}</p>
                  {!n.read ? <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" /> : null}
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{n.body}</p>
                <p className="mt-1 text-xs text-slate-400">{relativeTime(n.createdAt)}</p>
              </div>
            </button>
          ))}
        </Card>
      ) : (
        <EmptyState icon={<Icon name="bell" className="h-8 w-8" />} title={t('notifications.empty')} />
      )}
      {unread > 0 ? <Badge color="brand" className="mt-3">{unread} {t('notifications.unread')}</Badge> : null}
    </div>
  );
}
