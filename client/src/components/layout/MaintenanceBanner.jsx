import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export function MaintenanceBanner() {
  const { t } = useTranslation();
  const { config } = useSettings();
  const { isStaff } = useAuth();

  if (!config.maintenanceMode || isStaff) return null;

  return (
    <div role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-800">
      <div className="mx-auto flex max-w-6xl items-center gap-2 text-sm">
        <Icon name="alert" className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span className="font-semibold">{t('maintenance.title')}</span>
        <span className="hidden sm:inline">{t('maintenance.message')}</span>
      </div>
    </div>
  );
}

export default MaintenanceBanner;
