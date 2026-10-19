import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/icons.jsx';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="rounded-full bg-slate-100 p-4 text-slate-400">
        <Icon name="search" className="h-8 w-8" />
      </span>
      <h1 className="text-2xl font-bold text-slate-900">404</h1>
      <p className="text-slate-500">{t('errors.not_found')}</p>
      <Link to="/" className="btn-primary">
        {t('nav.home')}
      </Link>
    </div>
  );
}
