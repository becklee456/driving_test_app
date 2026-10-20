import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminPayments, useAdminPayment, useApprovePayment, useDenyPayment } from '../../hooks/useBilling.js';
import { useDebounce } from '../../hooks/useUi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Badge, Skeleton, EmptyState, Alert } from '../../components/ui/primitives.jsx';
import { Button, Input, Select, Textarea } from '../../components/ui/form.jsx';
import { Pagination } from '../../components/ui/nav.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { ProofImage } from '../../components/billing/ProofImage.jsx';
import { Icon } from '../../components/icons.jsx';
import { paymentStatusKey, PAYMENT_STATUS_COLORS, formatMoney, secondsUntil, formatCountdown } from '../../lib/billing.js';
import { formatDateTime } from '../../lib/format.js';

const STATUSES = ['all', 'PENDING_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'DENIED', 'EXPIRED'];
const PENDING = ['PENDING_REVIEW', 'UNDER_REVIEW'];

export default function AdminPayments() {
  const { t } = useTranslation();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState(null);
  const debounced = useDebounce(search);

  const params = useMemo(
    () => ({ page, limit: 20, status: status === 'all' ? undefined : status, search: debounced || undefined }),
    [page, status, debounced],
  );
  const { data, isLoading } = useAdminPayments(params);
  const { data: detail } = useAdminPayment(selectedId, { enabled: Boolean(selectedId) });
  const approve = useApprovePayment();
  const deny = useDenyPayment();

  const result = data?.data || {};
  const items = result.items || [];
  const counts = result.counts || {};
  const meta = result.meta || { page: 1, pages: 1, total: 0 };

  const listItem = items.find((p) => (p.id || p._id) === selectedId);
  const selected = detail?.payment || listItem || null;

  const openDetail = (p) => {
    setSelectedId(p.id || p._id);
    setNote('');
    setReason('');
    setActionError(null);
  };

  const run = async (mutation, payload, successMsg) => {
    setActionError(null);
    try {
      await mutation.mutateAsync(payload);
      toast.success(successMsg);
      setSelectedId(null);
    } catch (err) {
      setActionError(err.message || t('errors.generic'));
    }
  };

  const canApprove = selected && PENDING.includes(selected.status);
  const canDeny = canApprove && reason.trim().length >= 3;

  return (
    <div className="space-y-4">
      <PageHeader title={t('admin.payments')} subtitle={t('admin.payments_subtitle')} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {STATUSES.slice(1).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatus(s === status ? 'all' : s);
              setPage(1);
            }}
            className={`card p-3 text-left transition hover:shadow-md ${
              status === s ? 'ring-2 ring-brand-500' : ''
            }`}
          >
            <p className="text-lg font-bold text-slate-900">{counts[s] ?? 0}</p>
            <p className="truncate text-xs text-slate-500">{t(paymentStatusKey(s))}</p>
          </button>
        ))}
      </div>

      <Card className="p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? `${t('common.status')}: ${t('common.all')}` : t(paymentStatusKey(s))}
              </option>
            ))}
          </Select>
          <p className="self-center text-sm text-slate-500">
            {t('common.total')}: {meta.total || 0} · {t('billing.status_pending')}: {counts.PENDING_REVIEW ?? 0}
          </p>
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
              {items.map((p) => {
                const payer = p.user || {};
                const pending = PENDING.includes(p.status);
                const expired = p.status === 'EXPIRED' || (pending && secondsUntil(p.expiresAt) <= 0);
                return (
                  <li key={p.id || p._id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {payer.fullName || payer.email || '—'}
                        <span className="ml-2 text-xs font-normal text-slate-400">{p.planName}</span>
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {formatMoney(p.amount, p.currency)} · {p.payerPhone} · {formatDateTime(p.submittedAt || p.createdAt)}
                      </p>
                    </div>
                    <Badge color={PAYMENT_STATUS_COLORS[p.status]}>{t(paymentStatusKey(p.status))}</Badge>
                    <div className="flex items-center gap-1.5">
                      {pending && !expired ? (
                        <Button size="sm" variant="ghost" onClick={() => openDetail(p)}>
                          {t('admin.review')}
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={() => openDetail(p)}>
                        <Icon name="eye" className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-slate-100 px-4 py-3">
              <Pagination page={meta.page} pages={meta.pages} onChange={setPage} />
            </div>
          </>
        ) : (
          <EmptyState icon={<Icon name="credit-card" className="h-8 w-8" />} title={t('common.no_data')} />
        )}
      </Card>

      <Modal
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title={selected ? `${selected.planName} · ${formatMoney(selected.amount, selected.currency)}` : ''}
        size="lg"
        footer={
          selected ? (
            <>
              <Button variant="ghost" onClick={() => setSelectedId(null)}>
                {t('common.close')}
              </Button>
              {canApprove ? (
                <Button
                  variant="danger"
                  disabled={!canDeny}
                  loading={deny.isPending}
                  onClick={() => run(deny, { id: selectedId, reason: reason.trim() }, t('billing.status_denied'))}
                >
                  {t('admin.deny')}
                </Button>
              ) : null}
              {canApprove ? (
                <Button
                  loading={approve.isPending}
                  onClick={() => run(approve, { id: selectedId, note: note.trim() }, t('billing.status_approved'))}
                >
                  {t('admin.approve')}
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-4">
            {actionError ? <Alert variant="danger">{actionError}</Alert> : null}

            <div className="flex flex-wrap items-center gap-2">
              <Badge color={PAYMENT_STATUS_COLORS[selected.status]}>{t(paymentStatusKey(selected.status))}</Badge>
              {PENDING.includes(selected.status) ? (
                <span className="text-xs text-slate-500">
                  {t('checkout.window')}:{' '}
                  <span className="font-mono font-semibold text-amber-700">
                    {secondsUntil(selected.expiresAt) > 0 ? formatCountdown(secondsUntil(selected.expiresAt)) : t('billing.status_expired')}
                  </span>
                </span>
              ) : null}
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">{t('admin.learner')}</dt>
                <dd className="font-medium text-slate-900">{selected.user?.fullName || '—'}</dd>
                <dd className="text-xs text-slate-500">{selected.user?.email || selected.user?.phone || ''}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t('checkout.payer_phone')}</dt>
                <dd className="font-medium text-slate-900">{selected.payerPhone}</dd>
                <dd className="text-xs text-slate-500">{selected.payerName}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t('checkout.reference_optional')}</dt>
                <dd className="font-medium text-slate-900">{selected.transactionReference || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t('admin.sent_to')}</dt>
                <dd className="font-medium text-slate-900">{selected.recipientPhone || '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">{t('checkout.message_optional')}</dt>
                <dd className="whitespace-pre-line text-slate-800">{selected.paymentMessage || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t('admin.submitted')}</dt>
                <dd className="text-slate-800">{formatDateTime(selected.submittedAt || selected.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t('checkout.window')}</dt>
                <dd className="text-slate-800">{formatDateTime(selected.expiresAt)}</dd>
              </div>
              {selected.reviewedAt ? (
                <div>
                  <dt className="text-xs text-slate-500">{t('admin.reviewed')}</dt>
                  <dd className="text-slate-800">{formatDateTime(selected.reviewedAt)}</dd>
                </div>
              ) : null}
              {selected.denialReason ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">
                    {selected.status === 'APPROVED' ? t('admin.review_note') : t('admin.denial_reason')}
                  </dt>
                  <dd className={selected.status === 'APPROVED' ? 'text-slate-700' : 'text-rose-600'}>
                    {selected.denialReason}
                  </dd>
                </div>
              ) : null}
              {selected.reviewedBy ? (
                <div>
                  <dt className="text-xs text-slate-500">{t('admin.reviewed_by')}</dt>
                  <dd className="text-slate-800">{selected.reviewedBy.fullName || selected.reviewedBy.email}</dd>
                </div>
              ) : null}
              {selected.subscription ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">{t('billing.subscriptions')}</dt>
                  <dd className="text-slate-800">
                    {selected.subscription.planName} · {selected.subscription.status}
                    {selected.subscription.expiresAt
                      ? ` → ${formatDateTime(selected.subscription.expiresAt)}`
                      : selected.subscription.isLifetime
                        ? ` → ${t('pricing.lifetime')}`
                        : ''}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('billing.proof')}</p>
              {selected.proofImagePublicId ? (
                <ProofImage proofId={selected.proofImagePublicId} />
              ) : (
                <p className="text-sm text-slate-500">{t('billing.proof_none')}</p>
              )}
            </div>

            {PENDING.includes(selected.status) ? (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <Textarea
                  label={t('admin.review_note')}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={300}
                  hint={t('admin.review_note_hint')}
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    label={t('admin.deny_reason')}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={300}
                    placeholder={t('admin.deny_reason_hint')}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
