import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { request } from '../../lib/api.js';
import { formatApiError } from '../../lib/errors.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button, Input } from '../../components/ui/form.jsx';
import { Alert, Card } from '../../components/ui/primitives.jsx';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await request({ method: 'post', url: '/auth/forgot-password', data: { email } });
      if (data?.devOtp || data?.token) setDevToken(data.devOtp || data.token);
      setSent(true);
      toast.success(t('auth.code_sent'));
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
          <p className="mt-1 text-sm text-slate-500">{t('auth.forgot_subtitle')}</p>
        </div>
        {error ? <Alert variant="danger">{error}</Alert> : null}
        {sent ? (
          <>
            <Alert variant="success">{t('auth.code_sent')}</Alert>
            {devToken ? <Alert variant="info">Code: <strong>{devToken}</strong></Alert> : null}
            <Link to={`/reset-password?email=${encodeURIComponent(email)}`} className="btn-primary w-full">
              {t('auth.reset_password')}
            </Link>
          </>
        ) : (
          <>
            <Input id="email" type="email" label={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Button type="submit" loading={loading} className="w-full">
              {t('auth.send_code')}
            </Button>
          </>
        )}
        <p className="text-center text-sm text-slate-500">
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            {t('nav.login')}
          </Link>
        </p>
      </form>
    </Card>
  );
}
