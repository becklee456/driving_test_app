import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminPlans, usePlanMutations } from '../../hooks/useBilling.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Badge, Skeleton, EmptyState } from '../../components/ui/primitives.jsx';
import { Button, Input, Textarea, Checkbox, Select } from '../../components/ui/form.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Icon } from '../../components/icons.jsx';
import { formatMoney, planDurationLabel, planBadgeLabel } from '../../lib/billing.js';

const INTERVAL_OPTIONS = ['day', 'week', 'month', 'year', 'lifetime'];

const EMPTY_ENTITLEMENTS = {
  dailyQuestions: -1,
  dailyMockExams: -1,
  dailyAIAnswers: 0,
  mistakeReview: true,
  advancedAnalytics: false,
  downloadableReports: false,
  adFree: true,
  prioritySupport: false,
};

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  price: '',
  originalPrice: '',
  durationDays: 30,
  isLifetime: false,
  interval: 'month',
  badge: '',
  features: '',
  order: 0,
  isActive: true,
  isPopular: false,
  entitlements: EMPTY_ENTITLEMENTS,
};

export default function AdminPlans() {
  const { t } = useTranslation();
  const toast = useToast();
  const { data: plans, isLoading } = useAdminPlans();
  const { create, update, deactivate } = usePlanMutations();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (plan) => {
    setEditingId(plan._id);
    setForm({
      code: plan.code || '',
      name: plan.name || '',
      description: plan.description || '',
      price: String(plan.price ?? ''),
      originalPrice: plan.originalPrice != null ? String(plan.originalPrice) : '',
      durationDays: plan.durationDays ?? 30,
      isLifetime: Boolean(plan.isLifetime),
      interval: plan.interval || (plan.isLifetime ? 'lifetime' : 'month'),
      badge: plan.badge || '',
      features: (plan.features || []).join('\n'),
      order: plan.order ?? 0,
      isActive: plan.isActive !== false,
      isPopular: Boolean(plan.isPopular),
      entitlements: { ...EMPTY_ENTITLEMENTS, ...(plan.entitlements || {}) },
    });
    setError(null);
    setModalOpen(true);
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setBool = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.checked }));
  const setEnt = (key) => (e) =>
    setForm((f) => ({
      ...f,
      entitlements: { ...f.entitlements, [key]: e.target.value },
    }));
  const setEntBool = (key) => (e) =>
    setForm((f) => ({
      ...f,
      entitlements: { ...f.entitlements, [key]: e.target.checked },
    }));
  const setLifetime = (e) => {
    const v = e.target.checked;
    setForm((f) => ({
      ...f,
      isLifetime: v,
      durationDays: v ? '' : f.durationDays === '' ? 30 : f.durationDays,
      interval: v ? 'lifetime' : f.interval === 'lifetime' ? 'month' : f.interval,
    }));
  };

  const save = async () => {
    setError(null);
    const ent = form.entitlements;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      originalPrice: form.originalPrice === '' ? null : Number(form.originalPrice),
      isLifetime: Boolean(form.isLifetime),
      durationDays: form.isLifetime ? null : Number(form.durationDays),
      interval: form.isLifetime ? 'lifetime' : form.interval,
      badge: form.badge.trim() || null,
      features: form.features
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean),
      entitlements: {
        dailyQuestions: Number(ent.dailyQuestions),
        dailyMockExams: Number(ent.dailyMockExams),
        dailyAIAnswers: Number(ent.dailyAIAnswers),
        mistakeReview: Boolean(ent.mistakeReview),
        advancedAnalytics: Boolean(ent.advancedAnalytics),
        downloadableReports: Boolean(ent.downloadableReports),
        adFree: Boolean(ent.adFree),
        prioritySupport: Boolean(ent.prioritySupport),
      },
      order: Number(form.order) || 0,
      isActive: Boolean(form.isActive),
      isPopular: Boolean(form.isPopular),
    };
    if (!payload.name || !Number.isFinite(payload.price) || payload.price < 0) {
      setError(t('admin.plan_invalid'));
      return;
    }
    if (
      payload.originalPrice != null &&
      (!Number.isFinite(payload.originalPrice) || payload.originalPrice < payload.price)
    ) {
      setError(t('admin.plan_original_price_invalid'));
      return;
    }
    if (!form.isLifetime && (!Number.isFinite(payload.durationDays) || payload.durationDays <= 0)) {
      setError(t('admin.plan_invalid'));
      return;
    }
    if (payload.entitlements.dailyQuestions < -1 || payload.entitlements.dailyMockExams < -1 || payload.entitlements.dailyAIAnswers < -1) {
      setError(t('admin.plan_invalid'));
      return;
    }
    try {
      if (editingId) {
        await update.mutateAsync({ id: editingId, ...payload });
      } else {
        await create.mutateAsync({ ...payload, code: form.code.trim().toLowerCase() });
      }
      toast.success(t('common.saved'));
      setModalOpen(false);
    } catch (err) {
      setError(err.message || t('errors.generic'));
    }
  };

  const runDeactivate = async (plan) => {
    try {
      await deactivate.mutateAsync(plan._id);
      toast.success(t('admin.plan_deactivated'));
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('admin.plans')}
        subtitle={t('admin.plans_subtitle')}
        action={
          <Button onClick={openCreate} size="sm">
            <Icon name="plus" className="h-4 w-4" /> {t('admin.new_plan')}
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : plans && plans.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan._id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-900">{plan.name}</p>
                  <p className="font-mono text-xs text-slate-400">{plan.code}</p>
                </div>
                <div className="flex gap-1.5">
                  {plan.isActive ? <Badge color="success">{t('common.active')}</Badge> : <Badge>{t('common.inactive')}</Badge>}
                  {planBadgeLabel(plan, t) ? <Badge color="brand">{planBadgeLabel(plan, t)}</Badge> : null}
                </div>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-slate-900">{formatMoney(plan.price)}</span>
                <span className="text-xs text-slate-500">{planDurationLabel(plan, t)}</span>
              </div>

              {plan.description ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{plan.description}</p> : null}

              <div className="mt-2 flex flex-wrap gap-1">
                {(plan.features || []).slice(0, 3).map((f) => (
                  <span key={f} className="badge bg-slate-100 text-slate-600">
                    {f}
                  </span>
                ))}
                {(plan.features || []).length > 3 ? (
                  <span className="badge bg-slate-100 text-slate-500">+{plan.features.length - 3}</span>
                ) : null}
              </div>

              <div className="mt-auto flex gap-2 pt-3">
                <Button size="sm" variant="secondary" onClick={() => openEdit(plan)} className="flex-1">
                  <Icon name="edit" className="h-4 w-4" /> {t('common.edit')}
                </Button>
                {plan.isActive ? (
                  <Button size="sm" variant="ghost" onClick={() => runDeactivate(plan)}>
                    {t('admin.deactivate')}
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Icon name="tag" className="h-9 w-9" />}
            title={t('admin.no_plans')}
            action={
              <Button onClick={openCreate} size="sm">
                {t('admin.new_plan')}
              </Button>
            }
          />
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? t('admin.edit_plan') : t('admin.new_plan')}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save} loading={create.isPending || update.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {!editingId ? (
              <Input label={t('admin.plan_code')} value={form.code} onChange={set('code')} required placeholder="monthly_pro_30d" hint={t('admin.plan_code_hint')} />
            ) : (
              <Input label={t('admin.plan_code')} value={form.code} disabled />
            )}
            <Input label={t('admin.plan_name')} value={form.name} onChange={set('name')} required maxLength={80} />
          </div>

          <Textarea label={t('common.description')} value={form.description} onChange={set('description')} rows={2} maxLength={400} />

          <div className="grid gap-4 sm:grid-cols-3">
            <Input label={t('admin.price')} type="number" min="0" value={form.price} onChange={set('price')} required />
            <Input label={t('admin.original_price')} type="number" min="0" value={form.originalPrice} onChange={set('originalPrice')} hint={t('admin.original_price_hint')} />
            <Input label={t('admin.order')} type="number" value={form.order} onChange={set('order')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('admin.plan_badge')} value={form.badge} onChange={set('badge')} maxLength={40} placeholder="popular" hint={t('admin.plan_badge_hint')} />
            {!form.isLifetime ? (
              <Select
                label={t('admin.plan_interval')}
                value={form.interval}
                onChange={(e) => setForm((f) => ({ ...f, interval: e.target.value }))}
              >
                {INTERVAL_OPTIONS.filter((opt) => opt !== 'lifetime').map((opt) => (
                  <option key={opt} value={opt}>
                    {t(`admin.interval_${opt}`)}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>

          <div className="space-y-3">
            <Checkbox
              id="plan-lifetime"
              label={t('admin.is_lifetime')}
              description={t('admin.is_lifetime_hint')}
              checked={form.isLifetime}
              onChange={setLifetime}
            />
            {!form.isLifetime ? (
              <Input label={t('admin.duration_days')} type="number" min="1" value={form.durationDays} onChange={set('durationDays')} required />
            ) : null}
            <Checkbox id="plan-active" label={t('common.active')} checked={form.isActive} onChange={setBool('isActive')} />
            <Checkbox id="plan-popular" label={t('admin.is_popular')} checked={form.isPopular} onChange={setBool('isPopular')} />
          </div>

          <Textarea
            label={t('admin.plan_features')}
            value={form.features}
            onChange={set('features')}
            rows={5}
            hint={t('admin.plan_features_hint')}
          />

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-800">{t('admin.entitlements')}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t('admin.entitlements_hint')}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Input
                label={t('admin.ent_daily_questions')}
                type="number"
                min="-1"
                value={form.entitlements.dailyQuestions}
                onChange={setEnt('dailyQuestions')}
                hint={t('admin.unlimited_hint')}
              />
              <Input
                label={t('admin.ent_daily_mocks')}
                type="number"
                min="-1"
                value={form.entitlements.dailyMockExams}
                onChange={setEnt('dailyMockExams')}
                hint={t('admin.unlimited_hint')}
              />
              <Input
                label={t('admin.ent_daily_ai')}
                type="number"
                min="-1"
                value={form.entitlements.dailyAIAnswers}
                onChange={setEnt('dailyAIAnswers')}
                hint={t('admin.unlimited_hint')}
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Checkbox id="ent-mistakes" label={t('admin.ent_mistake_review')} checked={Boolean(form.entitlements.mistakeReview)} onChange={setEntBool('mistakeReview')} />
              <Checkbox id="ent-analytics" label={t('admin.ent_advanced_analytics')} checked={Boolean(form.entitlements.advancedAnalytics)} onChange={setEntBool('advancedAnalytics')} />
              <Checkbox id="ent-reports" label={t('admin.ent_downloadable_reports')} checked={Boolean(form.entitlements.downloadableReports)} onChange={setEntBool('downloadableReports')} />
              <Checkbox id="ent-adfree" label={t('admin.ent_ad_free')} checked={Boolean(form.entitlements.adFree)} onChange={setEntBool('adFree')} />
              <Checkbox id="ent-priority" label={t('admin.ent_priority_support')} checked={Boolean(form.entitlements.prioritySupport)} onChange={setEntBool('prioritySupport')} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
