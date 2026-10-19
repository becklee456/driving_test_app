import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { request } from '../../lib/api.js';
import { formatApiError } from '../../lib/errors.js';
import storage from '../../lib/storage.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Button, Input } from '../../components/ui/form.jsx';
import { Alert, Card } from '../../components/ui/primitives.jsx';

export default function ResetPassword() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { setUser } = useAuth();

  const [email, setEmail] = useState(params.get('email') || '');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await request({ method: 'post', url: '/auth/reset-password', data: { email, token, password } });
      if (data?.accessToken) storage.setToken(data.accessToken);
      if (data?.user) setUser(data.user);
      toast.success(t('auth.login_success'));
      navigate('/app', { replace: true });
    } catch (err) {
      setError(formatApiError(err, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">{t('auth.reset_password')}</h1>
        </div>
        {error ? <Alert variant="danger">{error}</Alert> : null}
        <Input id="email" type="email" label={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input id="token" label={t('auth.otp')} value={token} onChange={(e) => setToken(e.target.value)} inputMode="numeric" required />
        <Input
          id="password"
          type="password"
          label={t('auth.new_password')}
          hint={t('auth.password_hint')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" loading={loading} className="w-full">
          {t('auth.reset_password')}
        </Button>
        <p className="text-center text-sm text-slate-500">
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            {t('nav.login')}
          </Link>
        </p>
      </form>
    </Card>
  );
}
