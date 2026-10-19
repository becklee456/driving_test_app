import { forwardRef } from 'react';
import clsx from 'clsx';
import { Spinner } from './primitives.jsx';

export const Button = forwardRef(function Button(
  { children, variant = 'primary', size, loading = false, disabled, className, type = 'button', ...props },
  ref,
) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  };
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(variants[variant] || variants.primary, size === 'sm' && 'btn-sm', className)}
      {...props}
    >
      {loading ? <Spinner className="h-4 w-4" /> : null}
      {children}
    </button>
  );
});

export function Field({ label, htmlFor, error, hint, required, children, className }) {
  return (
    <div className={clsx('w-full', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="label">
          {label}
          {required ? <span className="text-rose-500"> *</span> : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ label, error, hint, required, className, id, ...props }, ref) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required}>
      <input ref={ref} id={id} className={clsx('input', error && 'border-rose-400 focus:border-rose-400', className)} {...props} />
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, hint, required, className, id, ...props }, ref) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required}>
      <textarea
        ref={ref}
        id={id}
        rows={4}
        className={clsx('input resize-y', error && 'border-rose-400', className)}
        {...props}
      />
    </Field>
  );
});

export const Select = forwardRef(function Select({ label, error, hint, required, className, id, children, ...props }, ref) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required}>
      <select ref={ref} id={id} className={clsx('input pr-8', error && 'border-rose-400', className)} {...props}>
        {children}
      </select>
    </Field>
  );
});

export function Checkbox({ label, description, className, id, ...props }) {
  return (
    <label htmlFor={id} className={clsx('flex cursor-pointer items-start gap-3', className)}>
      <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...props} />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description ? <span className="block text-xs text-slate-500">{description}</span> : null}
      </span>
    </label>
  );
}
