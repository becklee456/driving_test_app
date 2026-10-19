import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatApiError } from '../../lib/errors.js';
import { Button, Input } from '../../components/ui/form.jsx';
import { Alert, Card } from '../../components/ui/primitives.jsx';
import { Icon } from '../../components/icons.jsx';

export default function Login() {
  const { t } = useTranslation();
  const { login, loginTwoFactor } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || '/app';

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(form);
      if (data?.twoFactorRequired || data?.twoFactorSetupRequired) {
        setChallenge(data);
        return;
      }
      toast.success(t('auth.login_success'));
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(formatApiError(err, t));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit2fa = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginTwoFactor({ challengeToken: challenge.challengeToken, code });
      toast.success(t('auth.login_success'));
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(formatApiError(err, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      {challenge ? (
        <form onSubmit={onSubmit2fa} className="space-y-4">
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-900">{t('auth.two_factor')}</h1>
            <p className="mt-1 text-sm text-slate-500">{t('auth.two_factor_hint')}</p>
          </div>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <Input
            id="code"
            label={t('auth.otp')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
          />
          <Button type="submit" loading={loading} className="w-full">
            {t('nav.login')}
          </Button>
          <button type="button" onClick={() => setChallenge(null)} className="w-full text-center text-sm text-slate-500 hover:text-slate-800">
            {t('common.back')}
          </button>
        </form>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-900">{t('auth.login_title')}</h1>
            <p className="mt-1 text-sm text-slate-500">{t('auth.login_subtitle')}</p>
          </div>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <Input
            id="email"
            type="email"
            label={t('auth.email')}
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            autoComplete="email"
            required
          />
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              label={t('auth.password')}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-9 text-slate-400 hover:text-slate-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <Icon name={showPassword ? 'eyeOff' : 'eye'} className="h-4 w-4" />
            </button>
          </div>
          <div className="flex justify-start py-3">
            <p className="text-sm font-medium text-gray-400 hover:underline">
                imyirondoro yawe ningenzi nukayi hanehane
            </p>
          </div>
          <Button type="submit" loading={loading} className="w-full">
            {t('nav.login')}
          </Button>
          <p className="text-center text-sm text-slate-500">
            {t('auth.no_account')}{' '}
            <Link to="/register" className="font-semibold text-brand-700 hover:underline">
              {t('nav.register')}
            </Link>
          </p>
        </form>
      )}
    </Card>
  );
}
