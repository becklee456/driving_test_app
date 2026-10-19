import { useTranslation } from 'react-i18next';
import { useMistakes } from '../../hooks/useProgress.js';
import { EmptyState, Skeleton, Badge } from '../../components/ui/primitives.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { QuestionPanel } from '../../components/quiz/QuestionPanel.jsx';
import { Icon } from '../../components/icons.jsx';
import { useStartQuiz } from '../../hooks/useQuiz.js';
import { Button } from '../../components/ui/form.jsx';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext.jsx';

export default function Mistakes() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: mistakes, isLoading } = useMistakes({ limit: 50 });
  const startQuiz = useStartQuiz();

  const practise = async () => {
    try {
      const data = await startQuiz.mutateAsync({ type: 'mistakes', mode: 'incorrect' });
      navigate(`/quiz/${data.quiz.id}`, { state: { questions: data.questions } });
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  return (
    <div>
      <PageHeader
        title={t('mistakes.title')}
        action={
          mistakes?.length ? (
            <Button onClick={practise} loading={startQuiz.isPending}>
              <Icon name="play" className="h-4 w-4" /> {t('mistakes.practice')}
            </Button>
          ) : null
        }
      />
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : mistakes?.length ? (
        <div className="space-y-5">
          {mistakes.map((m) => (
            <div key={m.question.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <Badge color="neutral">#{m.question.questionNumber}</Badge>
                  <Badge color="danger">{m.wrongCount}✗</Badge>
                </div>
                <span className="text-xs text-slate-400">{t('mistakes.attempts', { count: m.attempts })}</span>
              </div>
              <QuestionPanel
                question={m.question}
                selectedOptionId={m.lastSelectedOptionId}
                revealed
                correctOptionIds={m.correctOptionIds}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Icon name="check" className="h-8 w-8" />} title={t('mistakes.empty')} />
      )}
    </div>
  );
}
