import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePlans, useSubmitPayment, useNow } from '../../hooks/useBilling.js';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Card, Alert, Skeleton, Badge } from '../../components/ui/primitives.jsx';
import { Button, Input, Textarea } from '../../components/ui/form.jsx';
import { Icon } from '../../components/icons.jsx';
import { formatMoney, formatCountdown, secondsUntil, paymentStatusKey, PAYMENT_STATUS_COLORS } from '../../lib/billing.js';
import { formatDateTime } from '../../lib/format.js';

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function Checkout() {
  const { t } = useTranslation();
  const { planId } = useParams();
  const navigate = useNavigate();
  const { config } = useSettings();
  const { user, refreshMe } = useAuth();
  const { data: plans, isLoading } = usePlans();
  const submit = useSubmitPayment();
  useNow(1000);

  const payment = config.payment || {};
  const currency = payment.currency || 'RWF';
  const plan = useMemo(() => plans?.find((p) => p._id === planId), [plans, planId]);

  const [form, setForm] = useState({
    payerName: user?.fullName || '',
    payerPhone: user?.phone || '',
    transactionReference: '',
    paymentMessage: '',
  });
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (submitted) {
    const remaining = secondsUntil(submitted.expiresAt);
    return (
      <div className="mx-auto max-w-xl space-y-4 pb-10">
        <PageHeader title={t('checkout.confirm_title')} />
        <Card className="space-y-4 p-5 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Icon name="check" className="h-7 w-7" />
          </span>
          <div>
            <p className="font-semibold text-slate-900">{t('checkout.confirm_body')}</p>
            <Badge color={PAYMENT_STATUS_COLORS[submitted.status]} className="mt-3">
              {t(paymentStatusKey(submitted.status))}
            </Badge>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-left text-sm">
            <div>
              <dt className="text-xs text-slate-500">{t('billing.plan')}</dt>
              <dd className="font-medium text-slate-900">{submitted.planName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">{t('billing.amount')}</dt>
              <dd className="font-medium text-slate-900">{formatMoney(submitted.amount, submitted.currency || currency)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-slate-500">{t('checkout.window')}</dt>
              <dd className="font-medium text-slate-900">
                {remaining > 0 ? formatCountdown(remaining) : t('billing.status_expired')} ·{' '}
                {formatDateTime(submitted.expiresAt)}
              </dd>
            </div>
          </dl>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link to="/app/billing" className="btn-primary">
              {t('checkout.go_billing')}
            </Link>
            <Link to="/app" className="btn-secondary">
              {t('nav.dashboard')}
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="mx-auto max-w-xl space-y-4 pb-10">
        <PageHeader title={t('checkout.title')} back="/pricing" backLabel={t('nav.pricing')} />
        <Alert variant="warning">{t('checkout.plan_not_found')}</Alert>
        <Button onClick={() => navigate('/pricing')}>{t('nav.pricing')}</Button>
      </div>
    );
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const pickFile = (e) => {
    setError(null);
    const next = e.target.files?.[0];
    if (!next) return;
    if (!PROOF_TYPES.includes(next.type)) {
      setError(t('checkout.proof_type_error'));
      e.target.value = '';
      return;
    }
    if (next.size > MAX_PROOF_BYTES) {
      setError(t('checkout.proof_size_error'));
      e.target.value = '';
      return;
    }
    setFile(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError(t('checkout.proof_required'));
      return;
    }
    if (!form.payerPhone.trim()) {
      setError(t('checkout.phone_required'));
      return;
    }
    try {
      const fd = new FormData();
      fd.append('planId', plan._id);
      fd.append('payerName', form.payerName.trim());
      fd.append('payerPhone', form.payerPhone.trim());
      if (form.transactionReference.trim()) fd.append('transactionReference', form.transactionReference.trim());
      if (form.paymentMessage.trim()) fd.append('paymentMessage', form.paymentMessage.trim());
      fd.append('proof', file);
      const res = await submit.mutateAsync(fd);
      await refreshMe();
      setSubmitted(res?.payment || null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || t('errors.generic'));
    }
  };

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(payment.recipientPhone || '');
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <PageHeader
        title={t('checkout.title')}
        subtitle={plan.name}
        back="/pricing"
        backLabel={t('nav.pricing')}
      />

      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-brand-50 p-2 text-brand-700">
            <Icon name="credit-card" />
          </span>
          <div>
            <h3 className="font-semibold text-slate-900">{t('checkout.instructions')}</h3>
            <p className="text-xs text-slate-500">{payment.method}</p>
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">{t('checkout.send_to')}</p>
            <p className="mt-0.5 flex items-center gap-2 font-semibold text-slate-900">
              {payment.recipientPhone} · {payment.recipientName}
              <button
                type="button"
                onClick={copyPhone}
                className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-brand-700"
                aria-label={t('common.copy')}
              >
                <Icon name="copy" className="h-4 w-4" />
              </button>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t('billing.amount')}</p>
            <p className="mt-0.5 font-semibold text-slate-900">{formatMoney(plan.price, currency)}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-slate-500">{t('checkout.window')}</p>
            <p className="mt-0.5 text-sm text-slate-700">
              {t('checkout.window_hint', { hours: payment.verificationWindowHours || 3 })}
            </p>
          </div>
        </div>

        {payment.instructions ? <p className="whitespace-pre-line text-sm text-slate-600">{payment.instructions}</p> : null}
      </Card>

      <Card className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h3 className="font-semibold text-slate-900">{t('checkout.form_title')}</h3>
          {error ? <Alert variant="danger">{error}</Alert> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('checkout.payer_name')}
              value={form.payerName}
              onChange={set('payerName')}
              required
              minLength={3}
              maxLength={120}
            />
            <Input
              label={t('checkout.payer_phone')}
              value={form.payerPhone}
              onChange={set('payerPhone')}
              required
              placeholder="07XXXXXXXX"
              maxLength={20}
            />
          </div>

          <Input
            label={t('checkout.reference_optional')}
            value={form.transactionReference}
            onChange={set('transactionReference')}
            maxLength={80}
            hint={t('checkout.reference_hint')}
          />

          <Textarea
            label={t('checkout.message_optional')}
            value={form.paymentMessage}
            onChange={set('paymentMessage')}
            rows={2}
            maxLength={500}
            hint={t('checkout.message_hint')}
          />

          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div>
              <label className="label" htmlFor="proof-file">
                {t('checkout.proof')}
                <span className="text-rose-500"> *</span>
              </label>
              <input
                ref={fileRef}
                id="proof-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={pickFile}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
              />
              <p className="mt-1 text-xs text-slate-500">{t('checkout.proof_hint')}</p>
              {previewUrl ? (
                <img src={previewUrl} alt={t('checkout.proof')} className="mt-2 max-h-48 rounded-lg border border-slate-200" />
              ) : null}
            </div>
          </div>

          <Button type="submit" loading={submit.isPending} className="w-full">
            {submit.isPending ? t('checkout.submitting') : t('checkout.submit')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
