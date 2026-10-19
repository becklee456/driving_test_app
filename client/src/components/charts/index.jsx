import clsx from 'clsx';

export function Sparkline({ data = [], height = 48, className, stroke = '#1b6ff5' }) {
  const values = data.map((d) => (typeof d === 'number' ? d : d.value || 0));
  const max = Math.max(1, ...values);
  const width = 100;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((v, i) => `${i * step},${height - (v / max) * (height - 6) - 3}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={clsx('w-full', className)} style={{ height }}>
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function LineChart({ data = [], height = 160, className, stroke = '#1b6ff5', valueKey = 'value', labelKey = 'label' }) {
  const values = data.map((d) => (typeof d === 'number' ? d : Number(d[valueKey]) || 0));
  const max = Math.max(1, ...values);
  const width = 100;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((v, i) => `${i * step},${height - (v / max) * (height - 10) - 5}`).join(' ');
  return (
    <div className={className}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        <polyline points={`0,${height} ${points} ${width},${height}`} fill="rgba(27,111,245,0.08)" stroke="none" />
        <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {data.length ? (
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>{data[0]?.[labelKey]}</span>
          <span>{data[data.length - 1]?.[labelKey]}</span>
        </div>
      ) : null}
    </div>
  );
}

export function BarChart({ data = [], height = 160, color = '#1b6ff5', valueKey = 'value', labelKey = 'label' }) {  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className="flex items-end gap-1.5 overflow-x-auto pb-1" style={{ height }}>
      {data.map((d, i) => {
        const value = Number(d[valueKey]) || 0;
        const pct = (value / max) * 100;
        return (
          <div key={i} className="group flex min-w-[34px] flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] font-medium text-slate-400 opacity-0 transition group-hover:opacity-100">{value}</span>
            <div
              className="w-full rounded-t-md transition-all hover:opacity-80"
              style={{ height: `${Math.max(2, pct)}%`, backgroundColor: color }}
              title={`${d[labelKey]}: ${value}`}
            />
            <span className="max-w-full truncate text-[10px] text-slate-400">{d[labelKey]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Ring({ value = 0, size = 96, stroke = 10, color = '#1b6ff5', label, sublabel }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-lg font-bold text-slate-900">{label ?? `${Math.round(pct)}%`}</p>
        {sublabel ? <p className="text-[10px] text-slate-500">{sublabel}</p> : null}
      </div>
    </div>
  );
}

export function Heatmap({ data = [], weeks = 18 }) {
  const recent = data.slice(-weeks * 7);
  const max = Math.max(1, ...recent.map((d) => d.answered || 0));
  const levelClass = (n) => {
    if (!n) return 'bg-slate-100';
    const ratio = n / max;
    if (ratio > 0.75) return 'bg-emerald-600';
    if (ratio > 0.5) return 'bg-emerald-500';
    if (ratio > 0.25) return 'bg-emerald-400';
    return 'bg-emerald-200';
  };
  return (
    <div className="overflow-x-auto pb-1">
      <div
        className="grid min-w-[260px] grid-flow-col grid-rows-7 gap-1"
        style={{ gridAutoColumns: 'minmax(0, 1fr)' }}
      >
        {recent.map((d, i) => (
          <div key={i} className={clsx('aspect-square w-full rounded-sm', levelClass(d.answered))} title={`${d.date}: ${d.answered}`} />
        ))}
      </div>
    </div>
  );
}
