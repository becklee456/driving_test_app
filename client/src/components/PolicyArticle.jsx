import { useTranslation } from 'react-i18next';
import { PageHeader } from './ui/PageHeader.jsx';

export function PolicyArticle({ kind }) {
  const { t } = useTranslation();
  const raw = t(`policy.${kind}.sections`, { returnObjects: true });
  const sections = Array.isArray(raw) ? raw : [];
  const contact = t(`policy.${kind}.contact`);

  return (
    <article className="mx-auto max-w-3xl">
      <PageHeader title={t(`policy.${kind}.title`)} subtitle={t(`policy.${kind}.updated`)} />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <p className="text-sm leading-relaxed text-slate-600">{t(`policy.${kind}.intro`)}</p>
        <div className="mt-6 space-y-6">
          {sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
              <div className="mt-2 space-y-2">
                {(Array.isArray(section.body) ? section.body : [section.body]).map((item, j) =>
                  Array.isArray(item) ? (
                    <ul key={j} className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600">
                      {item.map((li, k) => (
                        <li key={k}>{li}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={j} className="text-sm leading-relaxed text-slate-600">
                      {item}
                    </p>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
        {contact ? (
          <div className="mt-7 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">{contact}</div>
        ) : null}
      </div>
    </article>
  );
}

export default PolicyArticle;
