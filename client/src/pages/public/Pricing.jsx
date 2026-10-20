import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePlans } from '../../hooks/useBilling.js';
import { PlanCard } from '../../components/billing/PlanCard.jsx';
import { Skeleton, Alert, EmptyState } from '../../components/ui/primitives.jsx';
import { Icon } from '../../components/icons.jsx';
import { formatDateTime } from '../../lib/format.js';

export default function Pricing() {
  const { t } = useTranslation();
  const { config } = useSettings();
  const { isAuthenticated, access } = useAuth();
  const { data: plans, isLoading } = usePlans();

  const payment = config.payment || {};
  const currency = payment.currency || 'RWF';
  const subscription = access?.subscription;

  const steps = ['pricing.step_pay', 'pricing.step_upload', 'pricing.step_review'];

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <section className="text-center">
        <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{t('pricing.title')}</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">{t('pricing.subtitle')}</p>
        {payment.method ? (
          <span className="badge mt-3 bg-brand-50 text-brand-700">
            <Icon name="credit-card" className="h-3.5 w-3.5" /> {payment.method}
          </span>
        ) : null}
      </section>

      {access?.isPremium && subscription ? (
        <Alert variant="success" title={t('pricing.active_subscription')}>
          {subscription.isLifetime
            ? t('pricing.lifetime_active')
            : t('pricing.active_until', { date: formatDateTime(subscription.expiresAt) })}
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : plans && plans.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan._id}
              plan={plan}
              currency={currency}
              highlighted={plan.isPopular}
              action={
                isAuthenticated ? (
                  <Link to={`/app/checkout/${plan._id}`} className="btn-primary w-full">
                    {t('pricing.choose')}
                  </Link>
                ) : (
                  <Link to="/login" className="btn-secondary w-full">
                    {t('pricing.login_to_buy')}
                  </Link>
                )
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={<Icon name="tag" className="h-10 w-10" />} title={t('pricing.no_plans')} />
      )}

      <section className="card p-5 sm:p-6">
        <h2 className="section-title">{t('pricing.how_title')}</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {steps.map((key, i) => (
            <li key={key} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{t(`${key}_title`)}</p>
                <p className="mt-0.5 text-xs text-slate-500">{t(`${key}_body`)}</p>
              </div>
            </li>
          ))}
        </ol>
        {payment.instructions ? <p className="muted mt-4 whitespace-pre-line">{payment.instructions}</p> : null}
        <p className="mt-4 text-xs text-slate-400">
          {t('pricing.window_note', { hours: payment.verificationWindowHours || 3 })}{' '}
          {isAuthenticated ? (
            <Link to="/app/billing" className="link">
              {t('nav.billing')}
            </Link>
          ) : null}
        </p>
      </section>

      {!access?.isPremium ? <p className="text-center text-xs text-slate-400">{t('pricing.free_note')}</p> : null}
    </div>
  );
}
