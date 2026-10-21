import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCategories } from '../../hooks/useCategories.js';
import { useTestimonials } from '../../hooks/useTestimonials.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Card, Skeleton, Badge } from '../../components/ui/primitives.jsx';
import { Icon } from '../../components/icons.jsx';
import { HeroScene, SignCluster, SteeringWheel } from '../../components/illustrations.jsx';

const FEATURES = [
  { icon: 'book', title: 'Ibibazo nyakuri', body: 'Ibibazo biva mu kizamini nyakuri cyo gutwara mu Rwanda.', tone: 'brand' },
  { icon: 'target', title: 'Imyitozo ihuye nibyo ukeneye', body: 'Toza ku byiciro, ukore ikizamini cy’igerageza, ukurikirane aho ugeze.', tone: 'amber' },
  { icon: 'chart', title: 'Kumenya aho ugeze', body: 'Reba amanota, intege nke n’intege nke mu buryo bworoshye.', tone: 'emerald' },
  { icon: 'shield', title: 'Ibibazo Byizewe kandi bishya', body: 'Ibibazo bigenzurwa kandi bivuguruye.', tone: 'rose' },
];

const TONES = {
  brand: { chip: 'bg-brand-50 text-brand-700', accent: 'bg-brand-600' },
  amber: { chip: 'bg-amber-50 text-amber-600', accent: 'bg-amber-500' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600', accent: 'bg-emerald-500' },
  rose: { chip: 'bg-rose-50 text-rose-600', accent: 'bg-rose-500' },
};

const TESTIMONIALS = [
  { name: 'Uwase Claudine', role: 'Abanyeshuri', quote: 'Nabashije gutsinda ikizamini cyanjye ku nshuro ya mbere. Ibibazo byose byari bisa n\'ibyo nakoze hano.', rating: 5 },
  { name: 'Niyonzima Eric', role: 'Abanyeshuri', quote: 'Imyitozo iri hano yaranyigishije cyane kandi yoroheje. Ndabashimiye.', rating: 5 },
  { name: 'Mutesi Aline', role: 'Abanyeshuri', quote: 'Byarankomeje kandi nabonye aho nkeneye kwiyongera. Nabaye uwatsinze.', rating: 5 },
];

export default function Home() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { data: categories, isLoading } = useCategories();
  const { data: testimonials } = useTestimonials();

  const totalQuestions = (categories || []).reduce((sum, c) => sum + (c.questionCount || 0), 0);
  const stats = [
    { value: `${totalQuestions}+`, label: t('home.stat_questions'), sub: t('home.stat_questions_sub'), icon: 'book' },
    { value: `${(categories || []).length || '—'}`, label: t('home.stat_topics'), sub: t('home.stat_topics_sub'), icon: 'grid' },
    { value: '4.8★', label: t('home.stat_success'), sub: t('home.stat_success_sub'), icon: 'trophy' },
  ];

  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 px-6 py-12 text-white sm:px-10 sm:py-16">
        <div className="relative z-10 grid items-center gap-10 lg:grid-cols-2">
          <div className="max-w-xl">
            <Badge className="bg-white/15 text-white">
              <span className="inline-flex items-center gap-1">
                <Icon name="car" className="h-3.5 w-3.5" /> {t('home.badge')}
              </span>
            </Badge>
            <h1 className="mt-5 text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">{t('home.hero_title')}</h1>
            <p className="mt-4 text-base text-brand-100 sm:text-lg">{t('home.hero_subtitle')}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to={isAuthenticated ? '/app' : '/register'} className="hero-cta btn bg-white text-brand-700 shadow-pop hover:bg-brand-50">
                <Icon name="play" className="h-4 w-4" /> {t('home.start_free')}
              </Link>
              <Link to="/practice" className="btn border border-white/40 text-white hover:bg-white/10">
                {t('home.see_topics')}
              </Link>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="animate-float drop-shadow-2xl">
              <HeroScene />
            </div>
          </div>
        </div>
        {/* decorative glows */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-rwanda-yellow/20 blur-2xl" />
      </section>

      {/* Stats band */}
      <section className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="relative overflow-hidden p-5">
            <span className={`absolute left-0 top-0 h-full w-1.5 ${TONES.brand.accent}`} />
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-brand-50 p-2.5 text-brand-700">
                <Icon name={s.icon} />
              </span>
              <div>
                <p className="text-2xl font-extrabold text-slate-900">{s.value}</p>
                <p className="text-sm font-semibold text-slate-700">{s.label}</p>
                <p className="text-xs text-slate-400">{s.sub}</p>
              </div>
            </div>
          </Card>
        ))}
      </section>

      {/* Features */}
      <section>
        <div className="mb-5 flex items-center gap-2">
          <SteeringWheel className="text-brand-600" />
          <h2 className="text-xl font-bold text-slate-900">Ahabanza</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Card key={f.title} className="group relative overflow-hidden p-5 transition hover:-translate-y-1 hover:shadow-pop">
              <span className={`absolute left-0 top-0 h-1.5 w-full ${TONES[f.tone].accent}`} />
              <span className={`inline-flex rounded-xl p-2.5 ${TONES[f.tone].chip}`}>
                <Icon name={f.icon} />
              </span>
              <h3 className="mt-3 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{t('categories.title')}</h2>
          <Link to="/practice" className="text-sm font-medium text-brand-700 hover:underline">
            {t('nav.practice')} →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)
            : (categories || []).slice(0, 6).map((cat) => {
                return (
                  <Link
                    key={cat.id || cat._id}
                    to={`/practice?category=${cat.slug || cat.id}`}
                    className="card group flex items-center justify-between gap-3 p-4 transition hover:shadow-pop"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-card"
                        style={{ backgroundColor: cat.color || '#2563eb' }}
                      >
                        <Icon name={cat.icon && cat.icon !== 'grid' ? cat.icon : 'grid'} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{cat.name}</p>
                        <p className="text-xs text-slate-500">{t('categories.questions_count', { count: cat.questionCount || 0 })}</p>
                      </div>
                    </div>
                    <span className="rounded-lg p-1 text-slate-300 transition group-hover:bg-brand-50 group-hover:text-brand-700">
                      <Icon name="chevronRight" />
                    </span>
                  </Link>
                );
              })}
        </div>
      </section>

      {/* Testimonials */}
      <section>
        <div className="mb-5 text-center">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{t('home.testimonials_title')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('home.testimonials_subtitle')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(testimonials && testimonials.length ? testimonials : TESTIMONIALS).map((item) => {
            const isRw = i18n.language?.startsWith('rw');
            const name = (isRw && item.nameRw) || item.name;
            const role = (isRw && item.roleRw) || item.role;
            const quote = (isRw && item.quoteRw) || item.quote;
            return (
              <Card key={item._id || item.name} className="relative flex flex-col gap-4 p-5">
                <div className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: item.rating || 5 }).map((_, i) => (
                    <Icon key={i} name="star" className="h-4 w-4" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-slate-700">"{quote}"</p>
                <div className="mt-auto flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                    {(name || '').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{name}</p>
                    {role ? <p className="text-xs text-slate-500">{role}</p> : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-800 to-brand-600 px-6 py-12 text-center text-white sm:px-12">
        <div className="pointer-events-none absolute -left-10 -top-10 opacity-20">
          <SignCluster className="h-32 w-48" />
        </div>
        <div className="relative z-10 mx-auto max-w-xl">
          <h2 className="text-2xl font-extrabold sm:text-3xl">{t('home.cta_title')}</h2>
          <p className="mt-3 text-brand-100">{t('home.cta_body')}</p>
          <Link to={isAuthenticated ? '/app' : '/register'} className="hero-cta btn mt-6 bg-white text-brand-700 shadow-pop hover:bg-brand-50">
            {t('home.cta_button')}
          </Link>
        </div>
        <div className="pointer-events-none absolute -bottom-16 right-8 h-40 w-40 rounded-full bg-white/10 blur-xl" />
      </section>
    </div>
  );
}
