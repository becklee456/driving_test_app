import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAdminQuestion, useCreateQuestion, useUpdateQuestion } from '../../hooks/useQuestions.js';
import { useAdminCategories } from '../../hooks/useAdmin.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Alert, Skeleton } from '../../components/ui/primitives.jsx';
import { Button, Input, Textarea, Select } from '../../components/ui/form.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Icon } from '../../components/icons.jsx';
import { QUESTION_STATUS, DIFFICULTIES } from '../../lib/constants.js';

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const emptyOption = (i) => ({ id: LETTERS[i], label: LETTERS[i], text: '', isCorrect: false });

export default function AdminQuestionEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: categories } = useAdminCategories();
  const { data: existing, isLoading } = useAdminQuestion(id, { enabled: !isNew });
  const create = useCreateQuestion();
  const update = useUpdateQuestion();

  const [form, setForm] = useState({
    questionNumber: '',
    questionText: '',
    category: '',
    difficulty: 'medium',
    status: 'active',
    explanation: '',
    tags: '',
    imageUrls: '',
    options: [emptyOption(0), emptyOption(1)],
  });

  useEffect(() => {
    if (existing) {
      setForm({
        questionNumber: existing.questionNumber || '',
        questionText: existing.questionText || '',
        category: existing.category?.id || existing.category?._id || '',
        difficulty: existing.difficulty || 'medium',
        status: existing.status || 'active',
        explanation: existing.explanation || '',
        tags: (existing.tags || []).join(', '),
        imageUrls: (
          existing.images?.length
            ? existing.images.map((i) => i.url)
            : existing.image?.url
              ? [existing.image.url]
              : []
        ).join('\n'),
        options:
          existing.options?.length >= 2
            ? existing.options.map((o) => ({ id: o.id, label: o.label, text: o.text, isCorrect: Boolean(o.isCorrect) }))
            : [emptyOption(0), emptyOption(1)],
      });
    }
  }, [existing]);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const setOption = (index, patch) => {
    setForm((f) => ({
      ...f,
      options: f.options.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    }));
  };

  const setCorrect = (index) => {
    setForm((f) => ({ ...f, options: f.options.map((o, i) => ({ ...o, isCorrect: i === index })) }));
  };

  const addOption = () => {
    setForm((f) => (f.options.length >= 8 ? f : { ...f, options: [...f.options, emptyOption(f.options.length)] }));
  };

  const removeOption = (index) => {
    setForm((f) => {
      if (f.options.length <= 2) return f;
      const next = f.options.filter((_, i) => i !== index).map((o, i) => ({ ...o, id: LETTERS[i], label: LETTERS[i] }));
      return { ...f, options: next };
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      questionNumber: form.questionNumber ? Number(form.questionNumber) : undefined,
      questionText: form.questionText.trim(),
      category: form.category || undefined,
      difficulty: form.difficulty,
      status: form.status,
      explanation: form.explanation.trim() || null,
      tags: form.tags ? form.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
      images: form.imageUrls
        ? form.imageUrls.split('\n').map((s) => s.trim()).filter(Boolean).map((url) => ({ url, alt: '' }))
        : [],
      options: form.options.map((o) => ({ id: o.id, label: o.label, text: o.text.trim(), isCorrect: o.isCorrect })),
    };
    try {
      if (isNew) {
        const data = await create.mutateAsync(payload);
        toast.success(t('common.created'));
        navigate(`/admin/questions/${data.question.id}`, { replace: true });
      } else {
        await update.mutateAsync({ id, ...payload });
        toast.success(t('common.updated'));
      }
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  if (!isNew && isLoading) return <Skeleton className="h-96" />;

  const hasCorrect = form.options.some((o) => o.isCorrect);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={isNew ? t('admin.new_question') : t('admin.edit_question')} back="/admin/questions" backLabel={t('admin.questions')} />
      <form onSubmit={onSubmit} className="space-y-4">
        <Card className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="# Number" type="number" value={form.questionNumber} onChange={setField('questionNumber')} />
            <Select label={t('common.category')} value={form.category} onChange={setField('category')}>
              <option value="">—</option>
              {(categories || []).map((c) => (
                <option key={c.id || c._id} value={c.id || c._id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select label={t('common.difficulty')} value={form.difficulty} onChange={setField('difficulty')}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
          <Textarea label={t('common.question')} value={form.questionText} onChange={setField('questionText')} rows={3} required />
          <Textarea label="Image URLs (one per line)" value={form.imageUrls} onChange={setField('imageUrls')} rows={2} placeholder="https://…" />
        </Card>

        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{t('common.options')}</h3>
            <Button type="button" variant="secondary" size="sm" onClick={addOption} disabled={form.options.length >= 8}>
              <Icon name="plus" className="h-4 w-4" /> {t('common.create')}
            </Button>
          </div>
          {form.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCorrect(i)}
                className={
                  o.isCorrect
                    ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white'
                    : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 text-slate-400'
                }
                aria-label={t('common.correct')}
                title={t('common.correct')}
              >
                {o.isCorrect ? <Icon name="check" className="h-4 w-4" strokeWidth={3} /> : o.label.toUpperCase()}
              </button>
              <input
                value={o.text}
                onChange={(e) => setOption(i, { text: e.target.value })}
                className="input"
                placeholder={`${t('common.options')} ${o.label.toUpperCase()}`}
                required
              />
              <button type="button" onClick={() => removeOption(i)} disabled={form.options.length <= 2} className="rounded-lg p-1.5 text-slate-400 hover:text-rose-500 disabled:opacity-30" aria-label={t('common.delete')}>
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </div>
          ))}
          {!hasCorrect ? <Alert variant="warning">{t('common.correct')} — {t('common.required')}</Alert> : null}
        </Card>

        <Card className="space-y-4 p-5">
          <Textarea label={t('quiz.explanation')} value={form.explanation} onChange={setField('explanation')} rows={2} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Tags (comma separated)" value={form.tags} onChange={setField('tags')} />
            <Select label={t('common.status')} value={form.status} onChange={setField('status')}>
              {QUESTION_STATUS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={() => navigate('/admin/questions')}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending} disabled={!hasCorrect}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
