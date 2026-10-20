import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminSettings, useUpdateSettings } from '../../hooks/useAdmin.js';
import { useUpdatePaymentSettings } from '../../hooks/useBilling.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
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

export default function AdminSettings() {
  const { t } = useTranslation();
  const toast = useToast();
  const { refresh } = useSettings();
  const { data: settings, isLoading } = useAdminSettings();
  const update = useUpdateSettings();
  const updatePayment = useUpdatePaymentSettings();
  const [form, setForm] = useState(null);
  const [payForm, setPayForm] = useState(null);

  useEffect(() => {
    if (settings) {
      setForm(settings);
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

  if (isLoading || !form || !payForm) return <Skeleton className="h-96" />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setBool = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const setPay = (key) => (e) => setPayForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
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
        ...Object.fromEntries(BOOLEAN_KEYS.map(([k]) => [k, Boolean(form[k])])),
      });
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

      <div className="sticky bottom-20 md:bottom-4">
        <Button onClick={save} loading={update.isPending} className="w-full">
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}
