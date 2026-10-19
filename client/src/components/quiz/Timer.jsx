import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { Icon } from '../icons.jsx';
import { useCountdown } from '../../hooks/useUi.js';

function format(seconds) {
  if (seconds == null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function Timer({ expiresAt, onExpire, className }) {
  const remaining = useCountdown(expiresAt);
  const firedRef = useRef(false);

  useEffect(() => {
    if (remaining === 0 && !firedRef.current) {
      firedRef.current = true;
      onExpire?.();
    }
  }, [remaining, onExpire]);

  const urgent = remaining != null && remaining <= 60;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold tabular-nums',
        urgent ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-700',
        className,
      )}
      aria-live="polite"
    >
      <Icon name="clock" className="h-4 w-4" />
      {format(remaining)}
    </span>
  );
}

export default Timer;
