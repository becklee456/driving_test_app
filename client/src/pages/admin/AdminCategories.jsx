import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminCategories, useCategoryMutations } from '../../hooks/useAdmin.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Badge, Skeleton, EmptyState } from '../../components/ui/primitives.jsx';
import { Button, Input, Textarea } from '../../components/ui/form.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Icon } from '../../components/icons.jsx';

const EMPTY = { name: '', description: '', color: '#2563eb', icon: '', order: 0 };

export default function AdminCategories() {
  const { t } = useTranslation();
  const toast = useToast();
  const { data: categories, isLoading } = useAdminCategories();
  const { create, update, remove } = useCategoryMutations();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const openNew = () => {
    setEditing({});
    setForm({ ...EMPTY, order: (categories?.length || 0) + 1 });
  };
  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, description: c.description || '', color: c.color || '#2563eb', icon: c.icon || '', order: c.order || 0 });
  };
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    try {
      if (editing?.id || editing?._id) {
        await update.mutateAsync({ id: editing.id || editing._id, ...form, order: Number(form.order) });
        toast.success(t('common.updated'));
      } else {
        await create.mutateAsync({ ...form, order: Number(form.order) });
        toast.success(t('common.created'));
      }
      setEditing(null);
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  const del = async (c) => {
    try {
      await remove.mutateAsync(c.id || c._id);
      toast.success(t('common.deleted'));
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('admin.categories')}
        action={
          <Button onClick={openNew}>
            <Icon name="plus" className="h-4 w-4" /> {t('common.create')}
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : categories?.length ? (
          <ul className="divide-y divide-slate-100">
            {categories.map((c) => (
              <li key={c.id || c._id} className="flex items-center gap-3 px-4 py-3">
                <span className="h-8 w-8 shrink-0 rounded-lg" style={{ backgroundColor: c.color || '#94a3b8' }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{c.name}</p>
                  <p className="truncate text-xs text-slate-400">{c.slug}</p>
                </div>
                <Badge color="neutral">{c.questionCount || 0}</Badge>
                <button type="button" onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label={t('common.edit')}>
                  <Icon name="edit" className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => del(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500" aria-label={t('common.delete')}>
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Icon name="grid" className="h-8 w-8" />} title={t('common.no_data')} />
        )}
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id || editing?._id ? t('common.edit') : t('common.create')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save} loading={create.isPending || update.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label={t('common.name')} value={form.name} onChange={setField('name')} required />
          <Textarea label={t('common.description')} value={form.description} onChange={setField('description')} rows={2} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label={t('common.color')} type="color" value={form.color} onChange={setField('color')} />
            <Input label={t('common.icon')} value={form.icon} onChange={setField('icon')} />
            <Input label={t('common.order')} type="number" value={form.order} onChange={setField('order')} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
