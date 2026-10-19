import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { request } from '../../lib/api.js';
import { useSaveAnswer, useSubmitQuiz } from '../../hooks/useQuiz.js';
import { useReportQuestion } from '../../hooks/useNotifications.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Button } from '../../components/ui/form.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { PageLoader, Spinner, Badge } from '../../components/ui/primitives.jsx';
import { QuestionPanel } from '../../components/quiz/QuestionPanel.jsx';
import { QuestionNavigator } from '../../components/quiz/QuestionNavigator.jsx';
import { Timer } from '../../components/quiz/Timer.jsx';
import { ResultPanel } from '../../components/quiz/ResultPanel.jsx';
import { ReportDialog } from '../../components/quiz/ReportDialog.jsx';
import { Icon } from '../../components/icons.jsx';

export default function QuizRunner() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const saveAnswer = useSaveAnswer();
  const submitQuiz = useSubmitQuiz();
  const report = useReportQuestion();

  const { data, isLoading, error } = useQuery({
    queryKey: ['quiz', id],
    queryFn: () => request({ url: `/quizzes/${id}` }),
  });

  const inProgress = Boolean(data?.questions && data?.quiz);
  const resultPayload = !inProgress && data?.score ? data : null;

  const [index, setIndex] = useState(0);
  const [selections, setSelections] = useState({});
  const [revealed, setRevealed] = useState({});
  const [flagged, setFlagged] = useState(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const startedAtRef = useRef(Date.now());
  const questionShownAtRef = useRef(Date.now());
  const expiredRef = useRef(false);

  const questions = useMemo(() => data?.questions || [], [data]);
  const quiz = data?.quiz;
  const current = questions[index];
  const feedbackMode = quiz?.config?.feedbackMode || 'immediate';

  useEffect(() => {
    if (inProgress && questions.length) {
      const initial = {};
      for (const q of questions) if (q.selectedOptionId) initial[q.id] = q.selectedOptionId;
      setSelections(initial);
      questionShownAtRef.current = Date.now();
    }
  }, [inProgress, questions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCloseResult = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['quizzes'] });
    qc.invalidateQueries({ queryKey: ['progress'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }, [qc]);

  const doSubmit = useCallback(async () => {
    if (expiredRef.current && submitQuiz.isPending) return;
    try {
      const payload = await submitQuiz.mutateAsync({ quizId: id, selections, durationSec: Math.round((Date.now() - startedAtRef.current) / 1000) });
      qc.setQueryData(['quiz', id], payload);
      handleCloseResult();
      toast.success(t('result.title'));
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  }, [id, selections, submitQuiz, qc, toast, t, handleCloseResult]);

  const onExpire = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    toast.warning(t('quiz.time_left'));
    doSubmit();
  }, [doSubmit, toast, t]);

  const selectOption = async (optionId) => {
    if (!current) return;
    const qid = current.id;
    const timeSpentMs = Date.now() - questionShownAtRef.current;
    setSelections((prev) => ({ ...prev, [qid]: optionId }));
    setRevealed((prev) => ({ ...prev, [qid]: undefined }));
    if (feedbackMode === 'immediate') {
      try {
        const res = await saveAnswer.mutateAsync({ quizId: id, questionId: qid, selectedOptionId: optionId, timeSpentMs });
        setRevealed((prev) => ({
          ...prev,
          [qid]: { correct: res.correct, correctOptionIds: res.correctOptionIds || [], explanation: res.explanation },
        }));
      } catch (err) {
        toast.error(err.message || t('errors.generic'));
      }
    }
  };

  const toggleFlag = () => {
    if (!current) return;
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(current.id)) next.delete(current.id);
      else next.add(current.id);
      return next;
    });
  };

  const goto = (i) => {
    setIndex(Math.max(0, Math.min(questions.length - 1, i)));
    questionShownAtRef.current = Date.now();
  };

  const answeredCount = useMemo(
    () => questions.filter((q) => selections[q.id]).length,
    [questions, selections],
  );

  if (isLoading) return <PageLoader />;
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-slate-600">{error.message}</p>
        <Button onClick={() => navigate('/app')}>{t('result.back_to_dashboard')}</Button>
      </div>
    );
  }

  if (resultPayload) {
    return (
      <div className="mx-auto min-h-screen max-w-3xl p-4 sm:p-6">
        <ResultPanel result={resultPayload} backTo="/app" retakeTo={resultPayload.type === 'mock' ? '/app/mock' : '/app/practice'} />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-slate-500">{t('common.no_data')}</p>
      </div>
    );
  }

  const revealInfo = revealed[current.id];
  const isRevealed = feedbackMode === 'immediate' && Boolean(revealInfo);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <button type="button" onClick={() => navigate(-1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label={t('common.back')}>
            <Icon name="arrowLeft" />
          </button>
          <div className="flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
            </div>
          </div>
          {quiz?.expiresAt ? <Timer expiresAt={quiz.expiresAt} onExpire={onExpire} /> : <Badge color="brand">{answeredCount}/{questions.length}</Badge>}
          <button type="button" onClick={() => setConfirmOpen(true)} className="btn-primary btn-sm">
            {t('quiz.finish')}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 p-4 pb-32">
        <QuestionPanel
          question={current}
          index={index + 1}
          total={questions.length}
          selectedOptionId={selections[current.id]}
          onSelect={selectOption}
          revealed={isRevealed}
          correctOptionIds={revealInfo?.correctOptionIds || []}
          onToggleFlag={toggleFlag}
          flagged={flagged.has(current.id)}
          disabled={saveAnswer.isPending}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('quiz.navigator')}</p>
          <QuestionNavigator questions={questions} currentIndex={index} answers={selections} flagged={flagged} onJump={goto} />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => goto(index - 1)} disabled={index === 0} className="flex-1">
            {t('quiz.previous')}
          </Button>
          {index < questions.length - 1 ? (
            <Button onClick={() => goto(index + 1)} className="flex-1">
              {t('quiz.next')}
            </Button>
          ) : (
            <Button onClick={() => setConfirmOpen(true)} className="flex-1">
              {t('quiz.finish')}
            </Button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className="mx-auto flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600"
        >
          <Icon name="alert" className="h-3.5 w-3.5" /> {t('quiz.report')}
        </button>
      </main>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('quiz.submit_confirm_title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              loading={submitQuiz.isPending}
              onClick={() => {
                setConfirmOpen(false);
                doSubmit();
              }}
            >
              {t('common.submit')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          {t('quiz.submit_confirm_body', { count: questions.length - answeredCount })}
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <Badge color="success">{answeredCount} {t('quiz.answered')}</Badge>
          <Badge color="neutral">{questions.length - answeredCount} {t('quiz.unanswered')}</Badge>
        </div>
        {submitQuiz.isPending ? <Spinner className="mt-3 h-4 w-4" /> : null}
      </Modal>

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        submitting={report.isPending}
        questionLabel={current.questionText?.slice(0, 80)}
        onSubmit={async (payload) => {
          try {
            await report.mutateAsync({ questionId: current.id, ...payload });
            toast.success(t('common.saved'));
            setReportOpen(false);
          } catch (err) {
            toast.error(err.message || t('errors.generic'));
          }
        }}
      />
    </div>
  );
}
