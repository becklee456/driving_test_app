import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/form.jsx';
import { QuestionPanel } from '../quiz/QuestionPanel.jsx';

export function QuestionPreviewModal({ question, open, onClose }) {
  const { t } = useTranslation();
  const [reveal, setReveal] = useState(false);
  if (!question) return null;

  const correctOptionIds = question.correctOptionIds || (question.options || []).filter((o) => o.isCorrect).map((o) => o.id);
  const imageCount = question.images?.length || (question.image?.url ? 1 : 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t('common.preview', { defaultValue: 'Preview' })} • #${question.questionNumber}`}
      size="lg"
      footer={
        <>
          <span className="mr-auto self-center text-xs text-slate-400">
            {imageCount ? `${imageCount} image${imageCount > 1 ? 's' : ''}` : t('admin.no_images', { defaultValue: 'No images' })}
          </span>
          <Button variant="secondary" type="button" onClick={() => setReveal((r) => !r)}>
            {reveal ? t('admin.student_view', { defaultValue: 'Student view' }) : t('admin.show_answer', { defaultValue: 'Show answer' })}
          </Button>
          <Button variant="secondary" type="button" onClick={onClose}>
            {t('common.close', { defaultValue: 'Close' })}
          </Button>
        </>
      }
    >
      <QuestionPanel question={question} revealed={reveal} correctOptionIds={correctOptionIds} disabled />
    </Modal>
  );
}

export default QuestionPreviewModal;
