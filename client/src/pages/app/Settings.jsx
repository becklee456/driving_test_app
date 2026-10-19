import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { request } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { setLanguage } from '../../i18n/index.js';
import { LANGUAGES } from '../../lib/constants.js';
import { Card, Divider, Toggle } from '../../components/ui/primitives.jsx';
import { Button, Select } from '../../components/ui/form.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuth();
  const { theme, setTheme, reduceMotion, setReduceMotion, config } = useSettings();
  const toast = useToast();

  const [dailyGoal, setDailyGoal] = useState(user?.preferences?.dailyGoal || 20);
  const [highContrast, setHighContrast] = useState(Boolean(user?.preferences?.highContrast));
  const [notif, setNotif] = useState(() => ({ ...(user?.notificationPreferences || {}) }));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const data = await request({
        method: 'patch',
        url: '/me',
        data: {
          preferences: { language: i18n.language, dailyGoal: Number(dailyGoal), reduceMotion, highContrast },
          notificationPreferences: notif,
        },
      });
      setUser(data.user);
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const enable = LANGUAGES.filter((l) => !config?.enabledLanguages || config.enabledLanguages.includes(l.code));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t('settings.title')} />

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900">{t('settings.appearance')}</h3>
        <div className="mt-4 space-y-4">
          <Select label={t('settings.appearance')} value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="light">{t('theme.light')}</option>
            <option value="dark">{t('theme.dark')}</option>
            <option value="system">{t('theme.system')}</option>
          </Select>
          <Divider />
          <Toggle id="reduce-motion" checked={reduceMotion} onChange={setReduceMotion} label={t('settings.reduce_motion')} />
          <Toggle id="high-contrast" checked={highContrast} onChange={setHighContrast} label={t('settings.high_contrast')} />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900">{t('settings.language')}</h3>
        <div className="mt-4 max-w-xs">
          <Select value={i18n.language} onChange={(e) => setLanguage(e.target.value)}>
            {enable.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
        <Divider className="my-4" />
        <Select label={t('settings.daily_goal')} value={dailyGoal} onChange={(e) => setDailyGoal(e.target.value)} className="max-w-xs">
          {[10, 20, 30, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900">{t('settings.notifications')}</h3>
        <div className="mt-4 space-y-4">
          {[
            ['studyReminders', t('settings.study_reminders')],
            ['newContent', t('settings.new_content')],
            ['achievements', t('settings.achievements')],
            ['testResults', t('settings.test_results')],
            ['securityAlerts', t('settings.security_alerts')],
          ].map(([key, label]) => (
            <Toggle
              key={key}
              id={`notif-${key}`}
              checked={notif[key] ?? true}
              onChange={(v) => setNotif((prev) => ({ ...prev, [key]: v }))}
              label={label}
            />
          ))}
        </div>
      </Card>

      <div className="sticky bottom-20 md:bottom-4">
        <Button onClick={save} loading={saving} className="w-full">
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}
