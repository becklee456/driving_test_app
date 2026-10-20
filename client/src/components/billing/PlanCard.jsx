import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { Badge } from '../ui/primitives.jsx';
import { formatMoney, planDurationLabel, planBadgeLabel, planSavingsPercent } from '../../lib/billing.js';

export function PlanCard({ plan, currency = 'RWF', action, highlighted = false }) {
  const { t } = useTranslation();
  const features = plan.features || [];
  const badgeLabel = planBadgeLabel(plan, t);
  const savings = planSavingsPercent(plan);

  return (
    <div
      className={`card relative flex flex-col p-5 transition ${
        highlighted ? 'ring-2 ring-brand-500 shadow-lg' : 'hover:shadow-md'
      }`}
    >
      {badgeLabel ? (
        <Badge color="brand" className="absolute -top-3 left-5">
          {badgeLabel}
        </Badge>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{planDurationLabel(plan, t)}</p>
        </div>
        {plan.isLifetime ? <Icon name="crown" className="h-5 w-5 text-rwanda-yellow" /> : null}
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-slate-900">{formatMoney(plan.price, currency)}</span>
        {plan.originalPrice && plan.originalPrice > plan.price ? (
          <span className="text-sm text-slate-400 line-through">{formatMoney(plan.originalPrice, currency)}</span>
        ) : null}
        {savings > 0 ? (
          <Badge color="success" className="text-[11px]">
            {t('pricing.save_percent', { percent: savings })}
          </Badge>
        ) : null}
      </div>

      {plan.description ? <p className="mt-2 text-sm text-slate-500">{plan.description}</p> : null}

      {features.length > 0 ? (
        <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex-1" />
      )}

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export default PlanCard;
