import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

const ToastContext = createContext(null);

const ICONS = {
  success: 'M5 13l4 4L19 7',
  error: 'M6 18L18 6M6 6l12 12',
  info: 'M13 16h-1v-4h-1m1-4h.01',
  warning: 'M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
};

const STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-brand-200 bg-brand-50 text-brand-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = (idRef.current += 1);
      const item = typeof toast === 'string' ? { message: toast, type: 'info' } : toast;
      setToasts((list) => [...list, { id, type: 'info', duration: 4000, ...item }]);
      if (item.duration !== 0) {
        window.setTimeout(() => dismiss(id), item.duration ?? 4000);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      push,
      dismiss,
      success: (message, opts) => push({ message, type: 'success', ...opts }),
      error: (message, opts) => push({ message, type: 'error', ...opts }),
      info: (message, opts) => push({ message, type: 'info', ...opts }),
      warning: (message, opts) => push({ message, type: 'warning', ...opts }),
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={clsx(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-pop animate-slide-up',
              STYLES[toast.type] || STYLES.info,
            )}
          >
            <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <path d={ICONS[toast.type] || ICONS.info} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="flex-1 font-medium">{toast.message}</p>
            <button type="button" onClick={() => dismiss(toast.id)} className="opacity-60 hover:opacity-100" aria-label="Close">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export default ToastContext;
