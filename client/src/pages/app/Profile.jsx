import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { request } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Alert, Badge, Divider } from '../../components/ui/primitives.jsx';
import { Button, Input } from '../../components/ui/form.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Icon } from '../../components/icons.jsx';
import { formatDateTime } from '../../lib/format.js';

export default function Profile() {
  const { t } = useTranslation();
  const { user, setUser, logout } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({ fullName: user?.fullName || '', phone: user?.phone || '' });
  const [saving, setSaving] = useState(false);

  const [twoFactor, setTwoFactor] = useState(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await request({ method: 'patch', url: '/me', data: form });
      setUser(data.user);
      toast.success(t('common.saved'));
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const start2fa = async () => {
    try {
      const data = await request({ method: 'post', url: '/me/2fa/setup' });
      setTwoFactor(data);
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  const enable2fa = async () => {
    try {
      const data = await request({ method: 'post', url: '/me/2fa/enable', data: { code } });
      setRecoveryCodes(data.recoveryCodes);
      setTwoFactor(null);
      setCode('');
      toast.success(t('common.saved'));
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  const deactivate = async () => {
    try {
      await request({ method: 'delete', url: '/me' });
      toast.success(t('common.deleted'));
      await logout();
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  const twoFactorEnabled = user?.twoFactor?.enabled;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t('profile.title')} />

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900">{t('profile.account')}</h3>
        <form onSubmit={saveProfile} className="mt-4 space-y-4">
          <Input id="fullName" label={t('auth.full_name')} value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} required />
          <Input id="email" label={t('auth.email')} value={user?.email || ''} disabled />
          <Input id="phone" label={t('auth.phone')} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <Button type="submit" loading={saving}>
            {t('common.save')}
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900">{t('profile.security')}</h3>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-800">{t('profile.two_factor')}</p>
            <p className="text-xs text-slate-500">{t('auth.two_factor_hint')}</p>
          </div>
          {twoFactorEnabled ? <Badge color="success"><Icon name="check" className="h-3.5 w-3.5" /> {t('common.yes')}</Badge> : <Badge color="neutral">{t('common.no')}</Badge>}
        </div>
        {!twoFactorEnabled ? (
          <Button variant="secondary" className="mt-3" onClick={start2fa}>
            {t('profile.enable')}
          </Button>
        ) : null}
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900">{t('profile.sessions')}</h3>
        <SessionsList onRevokeAll={logout} />
      </Card>

      <Card className="border-rose-200 p-5">
        <h3 className="text-sm font-semibold text-rose-600">{t('profile.danger_zone')}</h3>
        <p className="mt-1 text-sm text-slate-500">{t('profile.deactivate_confirm')}</p>
        <Button variant="danger" className="mt-3" onClick={() => setConfirmDelete(true)}>
          {t('profile.deactivate')}
        </Button>
      </Card>

      <Modal open={Boolean(twoFactor)} onClose={() => setTwoFactor(null)} title={t('profile.enable')}>
        <p className="text-sm text-slate-500">Enter this secret in your authenticator app:</p>
        <code className="mt-2 block break-all rounded-lg bg-slate-100 px-3 py-2 text-xs">{twoFactor?.secret}</code>
        <div className="mt-4">
          <Input id="tfcode" label={t('auth.otp')} value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setTwoFactor(null)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={enable2fa}>{t('common.confirm')}</Button>
        </div>
      </Modal>

      <Modal open={Boolean(recoveryCodes)} onClose={() => setRecoveryCodes(null)} title={t('profile.recovery_codes')}>
        <Alert variant="warning">{t('profile.recovery_codes')}</Alert>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(recoveryCodes || []).map((c) => (
            <code key={c} className="rounded-lg bg-slate-100 px-3 py-2 text-center text-sm">
              {c}
            </code>
          ))}
        </div>
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('profile.deactivate')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={deactivate}>
              {t('common.confirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{t('profile.deactivate_confirm')}</p>
      </Modal>
    </div>
  );
}

function SessionsList({ onRevokeAll }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [sessions, setSessions] = useState(null);

  useEffect(() => {
    let active = true;
    request({ url: '/me/sessions' })
      .then((data) => active && setSessions(data.sessions || []))
      .catch(() => active && setSessions([]));
    return () => {
      active = false;
    };
  }, []);

  const revoke = async (id) => {
    try {
      await request({ method: 'delete', url: `/me/sessions/${id}` });
      setSessions((prev) => prev.filter((s) => (s._id || s.id) !== id));
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  const revokeAll = async () => {
    try {
      await request({ method: 'delete', url: '/me/sessions' });
      onRevokeAll?.();
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  return (
    <div className="mt-3">
      {sessions === null ? (
        <p className="text-sm text-slate-400">{t('common.loading')}</p>
      ) : sessions.length ? (
        <ul className="divide-y divide-slate-100">
          {sessions.map((s) => (
            <li key={s._id || s.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-700">{s.userAgent || s.device || 'Device'}</p>
                <p className="text-xs text-slate-400">
                  {s.ip || ''} {s.lastUsedAt || s.createdAt ? `· ${formatDateTime(s.lastUsedAt || s.createdAt)}` : ''}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => revoke(s._id || s.id)}>
                {t('profile.revoke')}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">{t('common.no_data')}</p>
      )}
      {sessions?.length ? (
        <>
          <Divider className="my-3" />
          <Button variant="ghost" size="sm" onClick={revokeAll}>
            <Icon name="logout" className="h-4 w-4" /> {t('profile.revoke_all')}
          </Button>
        </>
      ) : null}
    </div>
  );
}
