import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Logo } from './Logo.jsx';
import { LanguageSwitcher } from './controls.jsx';
import { MaintenanceBanner } from './MaintenanceBanner.jsx';
import { Icon } from '../icons.jsx';
import { Avatar } from '../ui/primitives.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { APP_NAV, APP_BOTTOM_NAV } from '../../lib/navigation.js';

function UserMenu() {
  const { t } = useTranslation();
  const { user, isStaff, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-100"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={user?.fullName || user?.email} size="sm" />
        <Icon name="chevronDown" className="hidden h-4 w-4 text-slate-400 sm:block" />
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop animate-fade-in" role="menu">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-800">{user?.fullName || user?.email}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
          <div className="py-1">
            <Link to="/app/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50" role="menuitem">
              <Icon name="user" className="h-4 w-4" /> {t('nav.profile')}
            </Link>
            <Link to="/app/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50" role="menuitem">
              <Icon name="settings" className="h-4 w-4" /> {t('nav.settings')}
            </Link>
            {isStaff ? (
              <Link to="/admin" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50" role="menuitem">
                <Icon name="shield" className="h-4 w-4" /> {t('nav.admin')}
              </Link>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
            role="menuitem"
          >
            <Icon name="logout" className="h-4 w-4" /> {t('nav.logout')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const { user, unreadNotifications } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Logo size="sm" to="/app" />
          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {APP_NAV.map((item) => (
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
          <div className="flex items-center gap-2">
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <Link to="/app/notifications" className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100">
              <Icon name="bell" />
              {unreadNotifications > 0 ? (
                <span className="absolute right-1 top-1 min-w-[1.1rem] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold text-white">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              ) : null}
            </Link>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={t('nav.menu')}
              aria-expanded={mobileOpen}
            >
              <Icon name={mobileOpen ? 'x' : 'menu'} />
            </button>
            <UserMenu />
          </div>
        </div>
        {mobileOpen ? (
          <div className="border-t border-slate-100 bg-white px-4 py-3 lg:hidden">
            <nav className="grid grid-cols-2 gap-1">
              {APP_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium',
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
                    )
                  }
                >
                  <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t(item.labelKey)}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        ) : null}
      </header>

      <MaintenanceBanner />

      <div className="mx-auto max-w-6xl px-4 py-6 pb-24 md:pb-10">
        <Outlet context={{ user }} />
      </div>

      <nav
        key={location.pathname}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {APP_BOTTOM_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition', isActive ? 'text-brand-700' : 'text-slate-500')
              }
            >
              <Icon name={item.icon} className="h-5 w-5" strokeWidth={2} />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default AppLayout;
