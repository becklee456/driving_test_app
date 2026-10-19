import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

export function Logo({ size = 'md', withText = true, to = '/' }) {
  const { t } = useTranslation();
  const sizes = { sm: 'h-8 w-8', md: 'h-9 w-9', lg: 'h-11 w-11' };
  const content = (
    <span className="inline-flex items-center gap-2.5">
      <span className={clsx('rounded-xl bg-brand-700 p-1.5 text-white shadow-card', sizes[size] || sizes.md)}>
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" className="opacity-60" />
          <path d="M6 14c0-2.5 2-4.5 5-5l.7-2.2A1.1 1.1 0 0 1 12.8 6h2.4a1.1 1.1 0 0 1 1.1.8L17 9c3 .5 5 2.5 5 5" />
          <circle cx="9" cy="15" r="1.4" />
          <circle cx="16.5" cy="15" r="1.4" />
        </svg>
      </span>
      {withText ? (
        <span className="text-base font-bold leading-tight text-slate-900">
          {t('app.name', 'Ikizamini cyo Gutwara')}
        </span>
      ) : null}
    </span>
  );
  return to ? (
    <Link to={to} className="inline-flex">
      {content}
    </Link>
  ) : (
    content
  );
}

export default Logo;
