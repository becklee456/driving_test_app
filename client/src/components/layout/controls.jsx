import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { setLanguage } from '../../i18n/index.js';
import { LANGUAGES } from '../../lib/constants.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { Icon } from '../icons.jsx';

export function LanguageSwitcher({ className }) {
  const { i18n } = useTranslation();
  const { config } = useSettings();
  const enabled = LANGUAGES.filter((l) => !config?.enabledLanguages || config.enabledLanguages.includes(l.code));
  return (
    <div className={clsx('inline-flex rounded-lg border border-slate-200 bg-white p-0.5', className)}>
      {enabled.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => setLanguage(lang.code)}
          className={clsx(
            'rounded-md px-2.5 py-1 text-xs font-semibold uppercase transition',
            i18n.language === lang.code ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-800',
          )}
          aria-pressed={i18n.language === lang.code}
        >
          {lang.code}
        </button>
      ))}
    </div>
  );
}

const THEME_ORDER = ['light', 'dark', 'system'];
const THEME_ICON = { light: 'sun', dark: 'moon', system: 'monitor' };

export function ThemeSwitcher({ className }) {
  const { t } = useTranslation();
  const { theme, setTheme } = useSettings();
  const next = () => setTheme(THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]);
  return (
    <button
      type="button"
      onClick={next}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50',
        className,
      )}
      title={t(`theme.${theme}`)}
      aria-label={t(`theme.${theme}`)}
    >
      <Icon name={THEME_ICON[theme] || 'monitor'} className="h-4 w-4" />
      {t(`theme.${theme}`)}
    </button>
  );
}
