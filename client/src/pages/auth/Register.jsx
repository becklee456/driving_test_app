import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatApiError } from '../../lib/errors.js';
import { Button, Input } from '../../components/ui/form.jsx';
import { Alert, Card } from '../../components/ui/primitives.jsx';

const INITIAL = { fullName: '', email: '', phone: '', password: '', confirmPassword: '' };

export default function Register() {
  const { t } = useTranslation();
  const { register, verifyEmail } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState(INITIAL);
  const [step, setStep] = useState('form');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.fullName.trim().length < 3) {
      setError(t('errors.name_short'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError(t('errors.email_invalid'));
      return;
    }
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      setError(t('errors.password_weak'));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError(t('errors.password_mismatch'));
      return;
    }
    setLoading(true);
    try {
      const data = await register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
      });
      if (data?.devOtp) setDevOtp(data.devOtp);
      setStep('verify');
      toast.success(t('auth.register_success'));
    } catch (err) {
      setError(formatApiError(err, t));
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyEmail({ email: form.email, otp });
      toast.success(t('auth.login_success'));
      navigate('/app', { replace: true });
    } catch (err) {
      setError(formatApiError(err, t));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'verify') {
    return (
      <Card className="p-6 sm:p-8">
        <form onSubmit={onVerify} className="space-y-4">
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-900">{t('auth.verify_email')}</h1>
            <p className="mt-1 text-sm text-slate-500">{t('auth.verify_subtitle')}</p>
          </div>
          {devOtp ? <Alert variant="info">OTP: <strong>{devOtp}</strong></Alert> : null}
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <Input id="otp" label={t('auth.otp')} value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" autoFocus required />
          <Button type="submit" loading={loading} className="w-full">
            {t('common.confirm')}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">{t('auth.register_title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('auth.register_subtitle')}</p>
        </div>
        {error ? <Alert variant="danger">{error}</Alert> : null}
        <Input id="fullName" label={t('auth.full_name')} value={form.fullName} onChange={update('fullName')} autoComplete="name" required />
        <Input id="email" type="email" label={t('auth.email')} value={form.email} onChange={update('email')} autoComplete="email" required />
        <Input id="phone" label={`${t('auth.phone')} (${t('common.optional')})`} value={form.phone} onChange={update('phone')} autoComplete="tel" />
        <Input
          id="password"
          type="password"
          label={t('auth.password')}
          hint={t('auth.password_hint')}
          value={form.password}
          onChange={update('password')}
          autoComplete="new-password"
          required
        />
        <Input
          id="confirmPassword"
          type="password"
          label={t('auth.confirm_password')}
          value={form.confirmPassword}
          onChange={update('confirmPassword')}
          autoComplete="new-password"
          required
        />
        <Button type="submit" loading={loading} className="w-full">
          {t('nav.register')}
        </Button>
        <p className="text-center text-sm text-slate-500">
          {t('auth.have_account')}{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            {t('nav.login')}
          </Link>
        </p>
      </form>
    </Card>
  );
}
