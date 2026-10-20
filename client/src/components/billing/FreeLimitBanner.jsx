import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import { Icon } from '../icons.jsx';

export function FreeLimitBanner() {
  const { t } = useTranslation();
  const { isAuthenticated, access } = useAuth();

  if (!isAuthenticated || !access) return null;
  if (access.isPremium) return null;

  const allowed = access.freeQuestionsAllowed ?? 0;
  const remaining = access.freeQuestionsRemaining ?? allowed;
  const limitReached = Boolean(access.questionsLimitReached) || remaining <= 0;
  if (!limitReached && remaining > 15) return null;

  const percent = allowed > 0 ? Math.max(0, Math.min(100, ((allowed - remaining) / allowed) * 100)) : 0;

  return (
    <div
      className={`card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${
        limitReached ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`rounded-xl bg-white p-2 ${limitReached ? 'text-rose-600' : 'text-amber-600'}`}>
          <Icon name={limitReached ? 'alert' : 'clock'} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {limitReached ? t('billing.free_limit_reached') : t('billing.questions_remaining', { count: remaining, allowed })}
          </p>
          {!limitReached ? (
            <div className="mt-1.5 h-1.5 w-40 overflow-hidden rounded-full bg-white sm:w-56">
              <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${percent}%` }} />
            </div>
          ) : (
            <p className="mt-0.5 text-xs text-rose-700">{t('billing.free_limit_hint')}</p>
          )}
        </div>
      </div>
      <Link to="/pricing" className="btn-primary btn-sm shrink-0 self-start sm:self-auto">
        <Icon name="sparkles" className="h-4 w-4" /> {t('billing.upgrade')}
      </Link>
    </div>
  );
}

export default FreeLimitBanner;
