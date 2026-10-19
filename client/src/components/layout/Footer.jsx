import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Logo } from './Logo.jsx';

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Logo size="sm" />
          <p className="max-w-xs text-sm text-slate-500">{t('app.tagline')}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
          <Link to="/practice" className="hover:text-brand-700">
            {t('nav.practice')}
          </Link>
          <Link to="/mock" className="hover:text-brand-700">
            {t('nav.mock')}
          </Link>
          <Link to="/login" className="hover:text-brand-700">
            {t('nav.login')}
          </Link>
          <Link to="/register" className="hover:text-brand-700">
            {t('nav.register')}
          </Link>
        </nav>
      </div>
      <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
        © {year} {t('app.name')}
      </div>
    </footer>
  );
}

export default Footer;
