import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Logo } from './Logo.jsx';
import { LanguageSwitcher } from './controls.jsx';
import { Icon } from '../icons.jsx';
import { Avatar } from '../ui/primitives.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ADMIN_NAV } from '../../lib/navigation.js';

export function AdminLayout() {
  const { t } = useTranslation();
  const { user, can, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = ADMIN_NAV.filter((item) => !item.permission || can(item.permission));

  const NavList = ({ onNavigate }) => (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
              isActive ? 'bg-brand-600 text-white shadow-card' : 'text-slate-600 hover:bg-slate-100',
            )
          }
        >
          <Icon name={item.icon} className="h-5 w-5" />
          {t(item.labelKey)}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-100 px-4">
          <Logo size="sm" to="/admin" withText={false} />
          <span className="ml-2 text-sm font-bold text-slate-900">{t('admin.dashboard')}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavList />
        </div>
        <div className="border-t border-slate-100 p-3">
          <Link to="/app" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
            <Icon name="home" className="h-5 w-5" /> {t('nav.dashboard')}
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
          >
            <Icon name="logout" className="h-5 w-5" /> {t('nav.logout')}
          </button>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-60 bg-white shadow-pop">
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
              <span className="text-sm font-bold text-slate-900">{t('admin.dashboard')}</span>
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-1 text-slate-400">
                <Icon name="x" />
              </button>
            </div>
            <NavList onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
            <Icon name="menu" />
          </button>
          <p className="hidden text-sm text-slate-500 sm:block">{t('admin.dashboard')}</p>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <div className="flex items-center gap-2">
              <Avatar name={user?.fullName || user?.email} size="sm" />
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold leading-tight text-slate-800">{user?.fullName}</p>
                <p className="text-xs text-slate-500">{user?.role}</p>
              </div>
            </div>
          </div>
        </header>
        <main key={location.pathname} className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
