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
    <div className="max-w-3xl mx-auto pb-12">
      <PageMeta
        title={`${doc.title} · NoirSound`}
        description={doc.intro || `${doc.title} for NoirSound.`}
        canonical={`https://noirsound.co/${slug}`}
      />
      <nav className="flex flex-wrap gap-2 mb-6 text-xs">
        {LEGAL_NAV.map((item) => (
          <Link
            key={item.slug}
            to={item.path}
            className={`px-3 py-1 rounded-full border transition-colors ${
              item.slug === slug
                ? 'bg-brand-red border-brand-red text-white'
                : 'border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-white">{doc.title}</h1>
        <p className="text-sm text-zinc-500 mt-1">Last updated {doc.updated}</p>
        {doc.intro && <p className="text-zinc-300 mt-4 leading-relaxed">{doc.intro}</p>}
      </header>

      <div className="space-y-8">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-bold text-white mb-2">{section.heading}</h2>
            <div className="space-y-2">
              {section.body.map((p, i) => (
                <p key={i} className="text-zinc-400 leading-relaxed">{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 text-xs text-zinc-600 border-t border-zinc-800 pt-4">
        {LEGAL_DISCLAIMER}
      </p>
    </div>
  );
}
