import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminSettings, useUpdateSettings } from '../../hooks/useAdmin.js';
import { useUpdatePaymentSettings } from '../../hooks/useBilling.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { applyBrandPalette } from '../../lib/branding.js';
import { Card, Skeleton, Alert, Divider, Toggle } from '../../components/ui/primitives.jsx';
import { Button, Input, Textarea, Select } from '../../components/ui/form.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';

const BOOLEAN_KEYS = [
  ['allowRegistration', 'settings.allow_registration'],
  ['requireEmailVerification', 'settings.require_email_verification'],
  ['require2FAForAdmins', 'settings.require_2fa_admins'],
  ['allowSelfServiceReset', 'settings.allow_self_reset'],
  ['maintenanceMode', 'settings.maintenance_mode'],
];

const COLOR_PRESETS = [
  { key: 'blue', color: '#1b6ff5' },
  { key: 'indigo', color: '#4f46e5' },
  { key: 'violet', color: '#7c3aed' },
  { key: 'rose', color: '#e11d48' },
  { key: 'emerald', color: '#059669' },
  { key: 'teal', color: '#0d9488' },
  { key: 'amber', color: '#d97706' },
  { key: 'slate', color: '#334155' },
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export default function AdminSettings() {
  const { t } = useTranslation();
  const toast = useToast();
  const { refresh } = useSettings();
  const { data: settings, isLoading } = useAdminSettings();
  const update = useUpdateSettings();
  const updatePayment = useUpdatePaymentSettings();
  const [form, setForm] = useState(null);
  const [payForm, setPayForm] = useState(null);
  const [primaryColor, setPrimaryColor] = useState('#1b6ff5');

  useEffect(() => {
    if (settings) {
      setForm(settings);
      setPrimaryColor(settings.theme?.primaryColor || '#1b6ff5');
      setPayForm({
        freeQuestionsAllowed: settings.freeQuestionsAllowed ?? 40,
        freePracticeAttemptsAllowed: settings.freePracticeAttemptsAllowed ?? 10,
        method: settings.payment?.method || 'Manual Mobile Money',
        recipientPhone: settings.payment?.recipientPhone || '',
        recipientName: settings.payment?.recipientName || '',
        currency: settings.payment?.currency || 'RWF',
        verificationWindowHours: settings.payment?.verificationWindowHours || 3,
        instructions: settings.payment?.instructions || '',
      });
    }
  }, [settings]);

  useEffect(() => {
    if (!HEX_RE.test(primaryColor)) return undefined;
    applyBrandPalette(primaryColor);
    return () => applyBrandPalette(settings?.theme?.primaryColor || '#1b6ff5');
  }, [primaryColor, settings?.theme?.primaryColor]);

  if (isLoading || !form || !payForm) return <Skeleton className="h-96" />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setBool = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const setPay = (key) => (e) => setPayForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    if (!HEX_RE.test(primaryColor)) {
      toast.error(t('settings.invalid_color'));
      return;
    }
    try {
      await update.mutateAsync({
        passingScorePercent: Number(form.passingScorePercent),
        examQuestionCount: Number(form.examQuestionCount),
        examDurationMinutes: Number(form.examDurationMinutes),
        practiceDefaultCount: Number(form.practiceDefaultCount),
        xpPerCorrectAnswer: Number(form.xpPerCorrectAnswer),
        xpPerTest: Number(form.xpPerTest),
        defaultLanguage: form.defaultLanguage,
        enabledLanguages: form.enabledLanguages,
        announcement: form.announcement,
        theme: { primaryColor },
        ...Object.fromEntries(BOOLEAN_KEYS.map(([k]) => [k, Boolean(form[k])])),
      });
      await refresh();
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  const savePayment = async () => {
    try {
      await updatePayment.mutateAsync({
        freeQuestionsAllowed: Number(payForm.freeQuestionsAllowed),
        freePracticeAttemptsAllowed: Number(payForm.freePracticeAttemptsAllowed),
        payment: {
          method: payForm.method,
          recipientPhone: payForm.recipientPhone,
          recipientName: payForm.recipientName,
          currency: payForm.currency,
          verificationWindowHours: Number(payForm.verificationWindowHours),
          instructions: payForm.instructions,
        },
      });
      await refresh();
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={t('admin.platform_settings')} />

      {form.maintenanceMode ? <Alert variant="warning">{t('settings.maintenance_mode')}</Alert> : null}

      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-semibold text-slate-900">{t('admin.exam_settings')}</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label={t('settings.passing_score')} type="number" value={form.passingScorePercent} onChange={set('passingScorePercent')} />
          <Input label={t('settings.exam_questions')} type="number" value={form.examQuestionCount} onChange={set('examQuestionCount')} />
          <Input label={t('settings.exam_duration')} type="number" value={form.examDurationMinutes} onChange={set('examDurationMinutes')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label={t('settings.practice_default')} type="number" value={form.practiceDefaultCount} onChange={set('practiceDefaultCount')} />
          <Input label="XP / correct" type="number" value={form.xpPerCorrectAnswer} onChange={set('xpPerCorrectAnswer')} />
          <Input label="XP / test" type="number" value={form.xpPerTest} onChange={set('xpPerTest')} />
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-semibold text-slate-900">{t('admin.language_settings')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label={t('settings.default_language')} value={form.defaultLanguage} onChange={set('defaultLanguage')}>
            <option value="rw">Kinyarwanda</option>
            <option value="en">English</option>
          </Select>
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">{t('settings.enabled_languages')}</p>
            <div className="flex gap-4">
              {['rw', 'en'].map((lang) => (
                <label key={lang} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={(form.enabledLanguages || []).includes(lang)}
                    onChange={(e) =>
                      setForm((f) => {
                        const next = new Set(f.enabledLanguages || []);
                        e.target.checked ? next.add(lang) : next.delete(lang);
                        return { ...f, enabledLanguages: [...next] };
                      })
                    }
                  />
                  {lang === 'rw' ? 'Kinyarwanda' : 'English'}
                </label>
              ))}
            </div>
          </div>
        </div>
        <Textarea label={t('settings.announcement')} value={form.announcement} onChange={set('announcement')} rows={2} />
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-semibold text-slate-900">{t('admin.access_settings')}</h3>
        {BOOLEAN_KEYS.map(([key, label]) => (
          <div key={key}>
            <Toggle id={key} checked={Boolean(form[key])} onChange={setBool(key)} label={t(label)} />
            <Divider className="mt-3" />
          </div>
        ))}
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-semibold text-slate-900">{t('admin.payment_settings')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('admin.pay_method')} value={payForm.method} onChange={setPay('method')} />
          <Input label={t('admin.pay_recipient_phone')} value={payForm.recipientPhone} onChange={setPay('recipientPhone')} />
          <Input label={t('admin.pay_recipient_name')} value={payForm.recipientName} onChange={setPay('recipientName')} />
          <Input label={t('admin.pay_currency')} value={payForm.currency} onChange={setPay('currency')} maxLength={8} />
          <Input
            label={t('admin.pay_window')}
            type="number"
            min="1"
            max="168"
            value={payForm.verificationWindowHours}
            onChange={setPay('verificationWindowHours')}
          />
          <Input
            label={t('admin.free_questions_allowed')}
            type="number"
            min="0"
            max="1000"
            value={payForm.freeQuestionsAllowed}
            onChange={setPay('freeQuestionsAllowed')}
          />
        </div>
        <Input
          label={t('admin.free_attempts_allowed')}
          type="number"
          min="0"
          max="1000"
          value={payForm.freePracticeAttemptsAllowed}
          onChange={setPay('freePracticeAttemptsAllowed')}
        />
        <Textarea
          label={t('admin.pay_instructions')}
          value={payForm.instructions}
          onChange={setPay('instructions')}
          rows={3}
          hint={t('admin.pay_instructions_hint')}
        />
        <Button onClick={savePayment} loading={updatePayment.isPending} size="sm">
          {t('admin.save_payment_settings')}
        </Button>
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-semibold text-slate-900">{t('settings.appearance')}</h3>
        <p className="text-xs text-slate-500">{t('settings.appearance_hint')}</p>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">{t('settings.preset_colors')}</p>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                title={preset.key}
                onClick={() => setPrimaryColor(preset.color)}
                className={`h-9 w-9 rounded-full border-2 transition ${
                  primaryColor.toLowerCase() === preset.color ? 'border-slate-900' : 'border-transparent'
                }`}
                style={{ backgroundColor: preset.color }}
              />
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-end gap-3">
            <div>
              <p className="label">{t('settings.custom_color')}</p>
              <input
                type="color"
                value={HEX_RE.test(primaryColor) ? primaryColor : '#1b6ff5'}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-16 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
              />
            </div>
            <Input
              label={t('settings.hex_code')}
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              maxLength={7}
              className="font-mono uppercase"
            />
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="mb-2 text-xs font-medium text-slate-500">{t('settings.preview')}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: HEX_RE.test(primaryColor) ? primaryColor : '#1b6ff5' }}
              >
                {t('common.save')}
              </button>
              <span className="link text-sm" style={{ color: HEX_RE.test(primaryColor) ? primaryColor : '#1b6ff5' }}>
                {t('common.view')}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div className="sticky bottom-20 md:bottom-4">
        <Button onClick={save} loading={update.isPending} className="w-full">
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}
