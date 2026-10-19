import { useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/form.jsx';
import { Modal } from '../ui/Modal.jsx';
import { REPORT_REASONS } from '../../lib/constants.js';

export function ReportDialog({ open, onClose, onSubmit, submitting, questionLabel }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [message, setMessage] = useState('');

  const submit = () => {
    onSubmit?.({ reason, message: message.trim() || undefined });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('quiz.report')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={submitting}>
            {t('common.submit')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {questionLabel ? <p className="text-sm text-slate-500">{questionLabel}</p> : null}
        <fieldset className="space-y-2">
          <legend className="label">{t('common.filter')}</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
              <input
                type="radio"
                name="report-reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="h-4 w-4 text-brand-600 focus:ring-brand-500"
              />
              <span className={clsx('text-sm text-slate-700')}>{r.replace(/-/g, ' ')}</span>
            </label>
          ))}
        </fieldset>
        <div>
          <label htmlFor="report-message" className="label">
            {t('bookmarks.note')} <span className="text-slate-400">({t('common.optional')})</span>
          </label>
          <textarea
            id="report-message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            className="input resize-y"
          />
        </div>
      </div>
    </Modal>
  );
}

export default ReportDialog;
