import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Logo } from './Logo.jsx';
import { LanguageSwitcher, ThemeSwitcher } from './controls.jsx';
import { MaintenanceBanner } from './MaintenanceBanner.jsx';

export function AuthLayout() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </header>
      <MaintenanceBanner />
      <main className="flex flex-1 items-center justify-center px-4 py-6">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
      <footer className="px-4 py-6 text-center text-xs text-slate-400">
        <Link to="/" className="hover:text-brand-700">
          ← {t('nav.home')}
        </Link>
      </footer>
    </div>
  );
}

export default AuthLayout;
