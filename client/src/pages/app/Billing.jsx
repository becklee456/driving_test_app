import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMyPaymentStatus, useMyPayments, useMySubscriptions, useNow } from '../../hooks/useBilling.js';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Card, Badge, ProgressBar, Skeleton, EmptyState, Alert, Divider } from '../../components/ui/primitives.jsx';
import { Pagination, Tabs } from '../../components/ui/nav.jsx';
import { Icon } from '../../components/icons.jsx';
import { formatMoney, paymentStatusKey, PAYMENT_STATUS_COLORS, formatCountdown, secondsUntil } from '../../lib/billing.js';
import { formatDateTime, formatDate, formatNumber } from '../../lib/format.js';

const STATUS_TABS = ['all', 'PENDING_REVIEW', 'APPROVED', 'DENIED', 'EXPIRED'];

export default function Billing() {
  const { t } = useTranslation();
  useNow(1000);
  const { data: status, isLoading } = useMyPaymentStatus();
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const { data: history, isLoading: historyLoading } = useMyPayments({ page, status: tab });
  const { data: subscriptions, isLoading: subsLoading } = useMySubscriptions();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const access = status?.access || {};
  const payment = status?.payment || null;
  const subscription = access.subscription;
  const pending =
    payment && ['PENDING_REVIEW', 'UNDER_REVIEW'].includes(payment.status)
      ? payment
      : null;
  const stillPending = pending ? secondsUntil(pending.expiresAt) : 0;

  const items = history?.data?.items || [];
  const meta = history?.data?.meta || history?.meta || { page: 1, pages: 1, total: 0 };

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-10">
      <PageHeader
        title={t('billing.title')}
        subtitle={t('billing.subtitle')}
        action={
          <Link to="/pricing" className="btn-primary btn-sm">
            <Icon name="sparkles" className="h-4 w-4" /> {access.isPremium ? t('billing.extend') : t('billing.upgrade')}
          </Link>
        }
      />

      {/* Current access */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`rounded-xl p-2 ${access.isPremium ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}
            >
              <Icon name={access.isPremium ? 'crown' : 'user'} />
            </span>
            <div>
              <p className="text-xs text-slate-500">{t('billing.status')}</p>
              <p className="font-bold text-slate-900">
                {access.isPremium
                  ? subscription?.planName || t('billing.premium')
                  : t('billing.free_plan')}
              </p>
            </div>
          </div>
          <Badge color={access.isPremium ? 'success' : 'neutral'}>
            {access.isPremium ? t('billing.premium_active') : t('billing.free')}
          </Badge>
        </div>

        {access.isPremium && subscription ? (
          <div className="mt-4 grid gap-3 rounded-xl bg-emerald-50/60 p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">{t('billing.activated')}</p>
              <p className="mt-0.5 font-medium text-slate-800">{formatDate(subscription.activatedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">{t('billing.expires')}</p>
              <p className="mt-0.5 font-medium text-slate-800">
                {subscription.isLifetime || !subscription.expiresAt
                  ? t('pricing.lifetime')
                  : secondsUntil(subscription.expiresAt) > 0
                    ? `${formatDateTime(subscription.expiresAt)} · ${formatCountdown(secondsUntil(subscription.expiresAt))}`
                    : t('billing.status_expired')}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">
                {t('billing.questions_used', {
                  used: formatNumber(access.freeQuestionsUsed || 0),
                  allowed: formatNumber(access.freeQuestionsAllowed || 0),
                })}
              </span>
              <span className="font-semibold text-slate-900">
                {t('billing.questions_remaining', {
                  count: access.freeQuestionsRemaining ?? 0,
                  allowed: access.freeQuestionsAllowed ?? 0,
                })}
              </span>
            </div>
            <ProgressBar value={access.freeQuestionsUsed || 0} max={Math.max(1, access.freeQuestionsAllowed || 1)} color="brand" />
            <p className="text-xs text-slate-500">
              {t('billing.attempts_used', {
                used: access.freePracticeAttemptsUsed || 0,
                allowed: access.freePracticeAttemptsAllowed || 0,
              })}
            </p>
            {access.questionsLimitReached ? (
              <Alert variant="danger" title={t('billing.free_limit_reached')}>
                {t('billing.free_limit_hint')}
              </Alert>
            ) : null}
          </div>
        )}
      </Card>

      {/* Pending payment with countdown */}
      {pending ? (
        <Card
          className={`p-5 ${stillPending > 0 ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200'}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-amber-100 p-2 text-amber-700">
                <Icon name="clock" />
              </span>
              <div>
                <p className="font-semibold text-slate-900">{pending.planName}</p>
                <p className="text-xs text-slate-500">
                  {formatMoney(pending.amount, pending.currency)} · {formatDateTime(pending.submittedAt || pending.createdAt)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <Badge color={PAYMENT_STATUS_COLORS[pending.status]}>{t(paymentStatusKey(pending.status))}</Badge>
              <p className="mt-1 font-mono text-lg font-bold text-amber-700">
                {stillPending > 0 ? formatCountdown(stillPending) : t('billing.status_expired')}
              </p>
              <p className="text-[11px] text-slate-500">{t('checkout.window')}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* History */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 sm:px-5">
          <h3 className="text-base font-semibold text-slate-900">{t('billing.history')}</h3>
          <span className="text-xs text-slate-500">{meta.total || 0}</span>
        </div>
        <Tabs
          className="mt-1 px-2"
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(1);
          }}
          tabs={STATUS_TABS.map((s) => ({
            value: s,
            label: s === 'all' ? t('common.all') : t(paymentStatusKey(s)),
          }))}
        />

        {historyLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Icon name="credit-card" className="h-9 w-9" />}
            title={t('billing.no_payments')}
            action={
              <Link to="/pricing" className="btn-secondary btn-sm">
                {t('nav.pricing')}
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((p) => (
              <li key={p._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{p.planName}</p>
                  <p className="text-xs text-slate-500">
                    {formatMoney(p.amount, p.currency)} · {formatDateTime(p.submittedAt || p.createdAt)}
                  </p>
                  {p.denialReason ? <p className="mt-0.5 text-xs text-rose-600">{p.denialReason}</p> : null}
                </div>
                <Badge color={PAYMENT_STATUS_COLORS[p.status]}>{t(paymentStatusKey(p.status))}</Badge>
              </li>
            ))}
          </ul>
        )}
        <div className="px-4 pb-4 sm:px-5">
          <Pagination page={meta.page} pages={meta.pages} onChange={setPage} />
        </div>
      </Card>

      {/* Subscriptions */}
      <Card className="overflow-hidden">
        <h3 className="border-b border-slate-100 px-4 py-3 text-base font-semibold text-slate-900 sm:px-5">
          {t('billing.subscriptions')}
        </h3>
        {subsLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-14" />
          </div>
        ) : !subscriptions || subscriptions.length === 0 ? (
          <EmptyState icon={<Icon name="tag" className="h-9 w-9" />} title={t('billing.no_subscriptions')} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {subscriptions.map((sub) => (
              <li key={sub._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div>
                  <p className="text-sm font-medium text-slate-900">{sub.planName}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(sub.activatedAt)} →{' '}
                    {sub.isLifetime || !sub.expiresAt ? t('pricing.lifetime') : formatDate(sub.expiresAt)}
                  </p>
                </div>
                <Badge color={sub.status === 'active' ? 'success' : 'neutral'}>{sub.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Divider />
    </div>
  );
}
