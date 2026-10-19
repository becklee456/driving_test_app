import clsx from 'clsx';

export function Pagination({ page = 1, pages = 1, onChange, className }) {
  if (pages <= 1) return null;
  const windowed = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, start + 4);
  for (let i = start; i <= end; i += 1) windowed.push(i);

  return (
    <nav className={clsx('flex items-center justify-center gap-1', className)} aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="btn-ghost btn-sm disabled:opacity-40"
      >
        ‹
      </button>
      {start > 1 ? <span className="px-2 text-slate-400">…</span> : null}
      {windowed.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-current={n === page ? 'page' : undefined}
          className={clsx('btn-sm min-w-[2rem] rounded-lg', n === page ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100')}
        >
          {n}
        </button>
      ))}
      {end < pages ? <span className="px-2 text-slate-400">…</span> : null}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
        className="btn-ghost btn-sm disabled:opacity-40"
      >
        ›
      </button>
    </nav>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={clsx('flex gap-1 overflow-x-auto border-b border-slate-200', className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          type="button"
          aria-selected={tab.value === value}
          onClick={() => onChange(tab.value)}
          className={clsx(
            'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition',
            tab.value === value
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
          )}
        >
          {tab.label}
          {tab.count != null ? <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
