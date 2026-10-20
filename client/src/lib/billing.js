export const PAYMENT_STATUS_COLORS = {
  PENDING_REVIEW: 'warning',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  DENIED: 'danger',
  EXPIRED: 'neutral',
};

export function paymentStatusKey(status) {
  return (
    {
      PENDING_REVIEW: 'billing.status_pending',
      UNDER_REVIEW: 'billing.status_review',
      APPROVED: 'billing.status_approved',
      DENIED: 'billing.status_denied',
      EXPIRED: 'billing.status_expired',
    }[status] || 'billing.status_pending'
  );
}

export function planDurationLabel(plan, t) {
  if (!plan) return '';
  if (plan.isLifetime) return t('pricing.lifetime');
  return t('pricing.days', { count: plan.durationDays || 0 });
}

/**
 * Badge label for a plan. The badge is DB-driven: known keys (popular,
 * best_value, forever) are translated, anything else renders as-is so
 * administrator-entered custom badges still display.
 */
export function planBadgeLabel(plan, t) {
  if (!plan) return null;
  const badge = plan.badge || (plan.isPopular ? 'popular' : null);
  if (!badge) return null;
  const key = `pricing.badge_${badge}`;
  const translated = t(key);
  return translated === key ? badge : translated;
}

/** Whole-percent savings when a plan has an originalPrice above its price. */
export function planSavingsPercent(plan) {
  if (!plan?.originalPrice || !(plan.price > 0)) return 0;
  if (plan.originalPrice <= plan.price) return 0;
  return Math.round((1 - plan.price / plan.originalPrice) * 100);
}

export function formatMoney(amount, currency = 'RWF') {
  return `${new Intl.NumberFormat('en-US').format(Number(amount) || 0)} ${currency}`;
}

/** Live countdown (in seconds) to a target timestamp; null when no target. */
export function secondsUntil(value) {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.round(diff / 1000));
}

export function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}
