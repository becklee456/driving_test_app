import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminTestimonials, useTestimonialMutations } from '../../hooks/useAdmin.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Badge, Skeleton, EmptyState, Toggle } from '../../components/ui/primitives.jsx';
import { Button, Input, Textarea, Select } from '../../components/ui/form.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Icon } from '../../components/icons.jsx';

const EMPTY = {
  name: '',
  nameRw: '',
  role: '',
  roleRw: '',
  quote: '',
  quoteRw: '',
  rating: 5,
  order: 0,
  isActive: true,
};

export default function AdminTestimonials() {
  const { t } = useTranslation();
  const toast = useToast();
  const { data: testimonials, isLoading } = useAdminTestimonials();
  const { create, update, remove } = useTestimonialMutations();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const openNew = () => {
    setEditing({});
    setForm({ ...EMPTY, order: (testimonials?.length || 0) + 1 });
  };
  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name || '',
      nameRw: item.nameRw || '',
      role: item.role || '',
      roleRw: item.roleRw || '',
      quote: item.quote || '',
      quoteRw: item.quoteRw || '',
      rating: item.rating || 5,
      order: item.order || 0,
      isActive: item.isActive !== false,
    });
  };
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setBool = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));

  const save = async () => {
    try {
      const payload = { ...form, rating: Number(form.rating), order: Number(form.order) };
      if (editing?.id || editing?._id) {
        await update.mutateAsync({ id: editing.id || editing._id, ...payload });
        toast.success(t('common.updated'));
      } else {
        await create.mutateAsync(payload);
        toast.success(t('common.created'));
      }
      setEditing(null);
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  const del = async (item) => {
    try {
      await remove.mutateAsync(item.id || item._id);
      toast.success(t('common.deleted'));
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('admin.testimonials')} action={<Button onClick={openNew}><Icon name="plus" className="h-4 w-4" /> {t('common.create')}</Button>} />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : testimonials?.length ? (
          <ul className="divide-y divide-slate-100">
            {testimonials.map((item) => (
              <li key={item._id || item.id} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                  {(item.name || '').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    {item.role ? <p className="text-xs text-slate-500">{item.role}</p> : null}
                    <Badge color={item.isActive !== false ? 'success' : 'neutral'}>{item.isActive !== false ? t('common.active') : t('common.inactive')}</Badge>
                    <Badge color="warning">{item.rating || 5}★</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">"{item.quote}"</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(item)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"><Icon name="edit" className="h-4 w-4" /></button>
                  <button onClick={() => del(item)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Icon name="trash" className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Icon name="users" className="h-8 w-8" />} title={t('common.no_data')} />
        )}
      </Card>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id || editing?._id ? t('common.edit') : t('common.create')} size="lg" footer={<><Button variant="secondary" onClick={() => setEditing(null)}>{t('common.cancel')}</Button><Button onClick={save} loading={create.isPending || update.isPending}>{t('common.save')}</Button></>}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('admin.testimonial_name')} value={form.name} onChange={setField('name')} required />
            <Input label={t('admin.testimonial_name_rw')} value={form.nameRw} onChange={setField('nameRw')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('admin.testimonial_role')} value={form.role} onChange={setField('role')} />
            <Input label={t('admin.testimonial_role_rw')} value={form.roleRw} onChange={setField('roleRw')} />
          </div>
          <Textarea label={t('admin.testimonial_quote')} value={form.quote} onChange={setField('quote')} rows={3} required />
          <Textarea label={t('admin.testimonial_quote_rw')} value={form.quoteRw} onChange={setField('quoteRw')} rows={3} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label={t('admin.testimonial_rating')} value={form.rating} onChange={setField('rating')}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
            </Select>
            <Input label={t('common.order')} type="number" value={form.order} onChange={setField('order')} />
            <div className="flex items-center pt-6"><Toggle checked={form.isActive} onChange={setBool('isActive')} label={t('common.active')} /></div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
