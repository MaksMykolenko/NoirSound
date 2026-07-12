import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { LEGAL_DOCS, LEGAL_DISCLAIMER, LEGAL_NAV } from '../constants/legalContent';
import PageMeta from '../components/meta/PageMeta';
import NotFound from './NotFound';

/**
 * Renders a single legal/policy document. The `slug` prop (or the :slug route
 * param) selects which document from LEGAL_DOCS to show.
 */
export default function LegalPage({ slug: slugProp }) {
  const params = useParams();
  const slug = slugProp || params.slug;
  const doc = LEGAL_DOCS[slug];

  if (!doc) return <NotFound />;

  return (
    <article className="mx-auto max-w-3xl pb-12">
      <PageMeta
        title={`${doc.title} · NoirSound`}
        description={doc.intro || `${doc.title} for NoirSound.`}
        canonical={`https://noirsound.co/${slug}`}
      />
      <nav
        aria-label="Legal documents"
        className="ns-tabs-scroll -mx-4 mb-7 flex overflow-x-auto border-b border-zinc-800/60 px-4 font-sans text-sm sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {LEGAL_NAV.map((item) => (
          <Link
            key={item.slug}
            to={item.path}
            aria-current={item.slug === slug ? 'page' : undefined}
            className={`shrink-0 border-b-2 px-3 py-2.5 transition-colors ${
              item.slug === slug
                ? 'border-brand-red text-brand-red'
                : 'border-transparent text-zinc-500 hover:border-zinc-700 hover:text-zinc-100'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <header className="mb-8">
        <h1 className="ns-page-title">{doc.title}</h1>
        <p className="mt-1 font-sans tabular-nums text-ns-meta text-zinc-500">Last updated {doc.updated}</p>
        {doc.intro && <p className="text-zinc-300 mt-4 leading-relaxed">{doc.intro}</p>}
      </header>

      <div className="space-y-8">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="mb-2 font-sans text-lg font-semibold text-zinc-100">{section.heading}</h2>
            <div className="space-y-2">
              {section.body.map((p, i) => (
                <p key={i} className="text-zinc-400 leading-relaxed">{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 border-t border-zinc-800 pt-4 text-ns-meta leading-relaxed text-zinc-600">
        {LEGAL_DISCLAIMER}
      </p>
    </article>
  );
}
