import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useImportPreview, useImportCommit } from '../../hooks/useAdmin.js';
import { request } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Badge, Alert, EmptyState } from '../../components/ui/primitives.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { Button, Select } from '../../components/ui/form.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Icon } from '../../components/icons.jsx';

const FORMATS = ['txt', 'csv', 'json', 'xlsx'];

export default function AdminImports() {
  const { t } = useTranslation();
  const toast = useToast();
  const preview = useImportPreview();
  const commit = useImportCommit();

  const [source, setSource] = useState('bundled-dataset');
  const [format, setFormat] = useState('txt');
  const [file, setFile] = useState(null);
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [report, setReport] = useState(null);
  const [exporting, setExporting] = useState(false);

  const buildPayload = async () => {
    if (source === 'bundled-dataset') return { source: 'bundled-dataset', sourceName: 'bundled-dataset' };
    if (!content) throw new Error(t('admin.choose_file'));
    return { format, content, fileName: fileName || `import.${format}`, sourceName: fileName || 'upload' };
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFileName(f.name);
    const ext = f.name.split('.').pop().toLowerCase();
    if (['xlsx', 'xls'].includes(ext)) setFormat('xlsx');
    else if (FORMATS.includes(ext)) setFormat(ext);
    const reader = new FileReader();
    reader.onload = () => setContent(String(reader.result));
    if (['xlsx', 'xls'].includes(ext)) reader.readAsDataURL(f);
    else reader.readAsText(f, 'utf-8');
  };

  const runPreview = async () => {
    try {
      const payload = await buildPayload();
      const data = await preview.mutateAsync(payload);
      setResult(data);
      setReport(null);
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  const runCommit = async () => {
    try {
      const payload = await buildPayload();
      const data = await commit.mutateAsync({ ...payload, skipDuplicateNumbers: true });
      setReport(data.report);
      toast.success(t('admin.import_done'));
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  const doExport = async (fmt) => {
    setExporting(true);
    try {
      const body = await request({ url: '/admin/imports/export', params: { format: fmt }, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([body]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `questions.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    } finally {
      setExporting(false);
    }
  };

  const summary = result?.summary;

  return (
    <div className="space-y-4">
      <PageHeader title={t('admin.imports')} subtitle={t('admin.import_hint')} />

      <Card className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label={t('admin.source')} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="bundled-dataset">{t('admin.bundled_dataset')}</option>
            <option value="upload">{t('admin.upload_file')}</option>
          </Select>
          {source === 'upload' ? (
            <Select label={t('admin.format')} value={format} onChange={(e) => setFormat(e.target.value)}>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f.toUpperCase()}
                </option>
              ))}
            </Select>
          ) : null}
        </div>

        {source === 'upload' ? (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-6 py-8 text-center hover:border-brand-400">
            <Icon name="upload" className="h-7 w-7 text-slate-400" />
            <span className="text-sm text-slate-600">{file ? file.name : t('admin.choose_file')}</span>
            <span className="text-xs text-slate-400">{FORMATS.join(', ')}</span>
            <input type="file" accept=".txt,.csv,.json,.xlsx,.xls" className="hidden" onChange={onFile} />
          </label>
        ) : (
          <Alert variant="info">{t('admin.bundled_hint')}</Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={runPreview} loading={preview.isPending}>
            <Icon name="eye" className="h-4 w-4" /> {t('admin.preview')}
          </Button>
          <Button onClick={runCommit} loading={commit.isPending} disabled={!summary && source !== 'bundled-dataset'}>
            <Icon name="upload" className="h-4 w-4" /> {t('admin.commit')}
          </Button>
          <Button variant="ghost" onClick={() => doExport('csv')} disabled={exporting}>
            <Icon name="download" className="h-4 w-4" /> CSV
          </Button>
          <Button variant="ghost" onClick={() => doExport('json')} disabled={exporting}>
            <Icon name="download" className="h-4 w-4" /> JSON
          </Button>
        </div>
      </Card>

      {summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={t('admin.total')} value={summary.total} icon={<Icon name="database" />} />
            <StatCard label={t('admin.importable')} value={summary.importable} icon={<Icon name="check" />} color="success" />
            <StatCard label={t('admin.blocked')} value={summary.blocked} icon={<Icon name="x" />} color="danger" />
            <StatCard label={t('admin.needs_review')} value={summary.needsReview} icon={<Icon name="alert" />} color="warning" />
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
              {t('admin.preview')} ({result.preview?.length || 0})
            </div>
            {result.preview?.length ? (
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                {result.preview.map((p) => (
                  <li key={p.index} className="flex items-start gap-3 px-4 py-2.5">
                    <Badge color="neutral">#{p.questionNumber}</Badge>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{p.questionText}</span>
                    {p.importable ? <Badge color="success">ok</Badge> : <Badge color="danger">blocked</Badge>}
                    {p.examinable ? null : <Badge color="warning">review</Badge>}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </>
      ) : null}

      {report ? (
        <Card className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Icon name="check" className="h-5 w-5 text-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-900">{t('admin.import_done')}</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={t('admin.imported')} value={report.imported} color="success" />
            <StatCard label={t('admin.skipped')} value={report.skipped} color="warning" />
            <StatCard label={t('admin.total')} value={report.total} />
            <StatCard label={t('admin.needs_review')} value={report.needsReview} color="warning" />
          </div>
          {report.skipDetails?.length ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-slate-500">{t('admin.skipped')} ({report.skipDetails.length})</summary>
              <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto text-xs text-slate-500">
                {report.skipDetails.map((s, i) => (
                  <li key={i}>#{s.questionNumber}: {s.issues?.join(', ')}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </Card>
      ) : null}

      {!summary && !report ? (
        <EmptyState icon={<Icon name="database" className="h-8 w-8" />} title={t('admin.import_hint')} />
      ) : null}
    </div>
  );
}
