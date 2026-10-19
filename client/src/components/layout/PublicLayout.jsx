import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Logo } from './Logo.jsx';
import { Footer } from './Footer.jsx';
import { MaintenanceBanner } from './MaintenanceBanner.jsx';
import { LanguageSwitcher, ThemeSwitcher } from './controls.jsx';
import { Icon } from '../icons.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { PUBLIC_NAV } from '../../lib/navigation.js';

export function PublicLayout() {
  const { t } = useTranslation();
  const { isAuthenticated, isStaff, user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {PUBLIC_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                  )
                }
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <LanguageSwitcher />
            {isAuthenticated ? (
              <>
                {isStaff ? (
                  <Link to="/admin" className="btn-ghost btn-sm">
                    {t('nav.admin')}
                  </Link>
                ) : null}
                <Link to="/app" className="btn-primary btn-sm">
                  {t('nav.dashboard')}
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost btn-sm">
                  {t('nav.login')}
                </Link>
                <Link to="/register" className="btn-primary btn-sm">
                  {t('nav.register')}
                </Link>
              </>
            )}
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={t('nav.home')}
            aria-expanded={open}
          >
            <Icon name={open ? 'x' : 'menu'} />
          </button>
        </div>
        {open ? (
          <div className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1">
              {PUBLIC_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    clsx('rounded-lg px-3 py-2 text-sm font-medium', isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600')
                  }
                >
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <LanguageSwitcher />
              <ThemeSwitcher />
            </div>
            <div className="mt-3 flex gap-2">
              {isAuthenticated ? (
                <Link to="/app" className="btn-primary flex-1" onClick={() => setOpen(false)}>
                  {t('nav.dashboard')}
                </Link>
              ) : (
                <>
                  <Link to="/login" className="btn-secondary flex-1" onClick={() => setOpen(false)}>
                    {t('nav.login')}
                  </Link>
                  <Link to="/register" className="btn-primary flex-1" onClick={() => setOpen(false)}>
                    {t('nav.register')}
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}
      </header>

      <MaintenanceBanner />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-10">
        <Outlet context={{ user }} />
      </main>

      <Footer />
    </div>
  );
}

export default PublicLayout;
