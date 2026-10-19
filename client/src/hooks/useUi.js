import { useEffect, useRef, useState } from 'react';

export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);
    setMatches(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Ticks once per second; used by the exam timer. */
export function useCountdown(targetTime) {
  const [remaining, setRemaining] = useState(() =>
    targetTime ? Math.max(0, Math.round((new Date(targetTime).getTime() - Date.now()) / 1000)) : null,
  );
  const ref = useRef(targetTime);
  ref.current = targetTime;

  useEffect(() => {
    if (!ref.current) {
      setRemaining(null);
      return undefined;
    }
    const tick = () => setRemaining(Math.max(0, Math.round((new Date(ref.current).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetTime]);

  return remaining;
}
