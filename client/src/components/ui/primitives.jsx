import clsx from 'clsx';

export function Spinner({ className = 'h-5 w-5', label }) {
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
      <svg className={clsx('animate-spin text-brand-600', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
      </svg>
      {label ? <span className="text-sm text-slate-500">{label}</span> : null}
    </span>
  );
}

export function PageLoader({ label = 'Biratunganywa…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
      <Spinner className="h-8 w-8" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

export function Card({ as: Tag = 'div', className, children, ...props }) {
  return (
    <Tag className={clsx('card', className)} {...props}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={clsx('flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5', className)}>
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

const BADGE_STYLES = {
  neutral: 'bg-slate-100 text-slate-700',
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  info: 'bg-sky-50 text-sky-700',
};

export function Badge({ children, color = 'neutral', className }) {
  return <span className={clsx('badge', BADGE_STYLES[color] || BADGE_STYLES.neutral, className)}>{children}</span>;
}

const ALERT_STYLES = {
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
};

export function Alert({ children, variant = 'info', title, className }) {
  return (
    <div className={clsx('rounded-xl border px-4 py-3 text-sm', ALERT_STYLES[variant] || ALERT_STYLES.info, className)} role="alert">
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={clsx(title && 'mt-1')}>{children}</div> : null}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      {icon ? <div className="text-slate-300">{icon}</div> : null}
      <div>
        <p className="font-semibold text-slate-700">{title}</p>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={clsx('animate-pulse rounded-lg bg-slate-200', className)} />;
}

export function ProgressBar({ value = 0, max = 100, color = 'brand', className, showLabel = false }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const colorClass =
    { brand: 'bg-brand-600', success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-rose-500' }[color] ||
    'bg-brand-600';
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={clsx('h-full rounded-full transition-all', colorClass)} style={{ width: `${pct}%` }} />
      </div>
      {showLabel ? <span className="w-10 text-right text-xs font-medium text-slate-500">{pct}%</span> : null}
    </div>
  );
}

export function Avatar({ name = '', size = 'md', className }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' };
  const label = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700',
        sizes[size] || sizes.md,
        className,
      )}
    >
      {label || '?'}
    </span>
  );
}

export function Toggle({ checked, onChange, label, description, id }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description ? <span className="block text-xs text-slate-500">{description}</span> : null}
      </span>
      <span className="relative inline-flex">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(checked)}
          onChange={(e) => onChange?.(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-brand-600" />
        <span className="toggle-knob pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Divider({ className }) {
  return <hr className={clsx('border-slate-100', className)} />;
}
