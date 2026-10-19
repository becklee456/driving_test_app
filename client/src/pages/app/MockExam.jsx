import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStartQuiz } from '../../hooks/useQuiz.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Card, Badge } from '../../components/ui/primitives.jsx';
import { Button } from '../../components/ui/form.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Icon } from '../../components/icons.jsx';

export default function MockExam() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { config } = useSettings();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const startQuiz = useStartQuiz();

  const start = async () => {
    if (!isAuthenticated) {
      toast.info(t('errors.unauthorized'));
      navigate('/login');
      return;
    }
    try {
      const data = await startQuiz.mutateAsync({ type: 'mock', feedbackMode: 'end' });
      navigate(`/quiz/${data.quiz.id}`, { state: { questions: data.questions } });
    } catch (err) {
      toast.error(err.message || t('errors.generic'));
    }
  };

  const rules = [
    { icon: 'clipboard', label: t('admin.exam_count'), value: config?.examQuestionCount || 50 },
    { icon: 'clock', label: t('admin.exam_duration'), value: `${config?.examDurationMinutes || 45} ${t('common.time')}` },
    { icon: 'target', label: t('result.passing_score', { score: config?.passingScorePercent || 80 }), value: `${config?.passingScorePercent || 80}%` },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('nav.mock')} subtitle={t('app.tagline')} />
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-brand-50 p-3 text-brand-700">
            <Icon name="clipboard" className="h-7 w-7" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t('nav.mock')}</h2>
            <p className="text-sm text-slate-500">{t('dashboard.start_mock')}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rules.map((r) => (
            <div key={r.label} className="rounded-xl bg-slate-50 p-3 text-center">
              <Icon name={r.icon} className="mx-auto h-5 w-5 text-slate-400" />
              <p className="mt-1 text-lg font-bold text-slate-900">{r.value}</p>
              <p className="text-xs text-slate-500">{r.label}</p>
            </div>
          ))}
        </div>

        <ul className="mt-5 space-y-2 text-sm text-slate-600">
          <li className="flex items-center gap-2">
            <Icon name="check" className="h-4 w-4 text-emerald-500" /> {t('practice.end')}
          </li>
          <li className="flex items-center gap-2">
            <Icon name="check" className="h-4 w-4 text-emerald-500" /> {t('quiz.time_left')}
          </li>
        </ul>

        <Button onClick={start} loading={startQuiz.isPending} className="mt-6 w-full" size="lg">
          {t('dashboard.start_mock')}
        </Button>
        <Badge color="warning" className="mt-3 block text-center">
          {t('admin.passing_score')}: {config?.passingScorePercent || 80}%
        </Badge>
      </Card>
    </div>
  );
}
