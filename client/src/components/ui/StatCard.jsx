import clsx from 'clsx';

export function StatCard({ label, value, hint, icon, color = 'brand', className }) {
  const colors = {
    brand: 'bg-brand-50 text-brand-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-rose-50 text-rose-700',
    info: 'bg-sky-50 text-sky-700',
  };
  return (
    <div className={clsx('card p-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon ? <span className={clsx('rounded-lg p-1.5', colors[color] || colors.brand)}>{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default StatCard;
