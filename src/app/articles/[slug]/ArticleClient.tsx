'use client';

import Link from 'next/link';
import { AppearanceControls } from '@/components/AppearanceControls';
import { pickText, type Article } from '@/content/articles';
import { useI18n } from '@/lib/i18n/provider';

export function ArticleClient({ article }: { article: Article }) {
  const { locale, t } = useI18n();

  return (
    <main className="min-h-screen bg-base-100 px-6 py-12">
      <article className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href="/articles"
              className="text-sm text-base-content/60 hover:text-base-content"
            >
              ← {t.common.articles}
            </Link>
          </div>
          <AppearanceControls />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <span className="badge badge-outline badge-sm" key={tag}>
              {tag}
            </span>
          ))}
        </div>

        <h1 className="mt-3 text-4xl font-bold leading-tight text-primary">
          {pickText(article.title, locale)}
        </h1>
        <p className="mt-3 text-base text-base-content/70">
          {pickText(article.description, locale)}
        </p>
        <p className="mt-2 text-xs text-base-content/50">{article.date}</p>

        <div className="mt-10 max-w-none">
          {article.sections.map((section) => (
            <section className="mb-8" key={section.heading.zh}>
              <h2 className="mb-3 text-2xl font-semibold">
                {pickText(section.heading, locale)}
              </h2>
              {section.body.map((paragraph) => (
                <p
                  className="mb-3 leading-7 text-base-content/80"
                  key={paragraph.zh}
                >
                  {pickText(paragraph, locale)}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="card mt-10 bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-lg">
              {locale === 'zh' ? '动手试试' : 'Try it'}
            </h2>
            <div className="flex flex-wrap gap-2">
              {article.relatedTools.map((tool) => (
                <Link className="btn btn-primary btn-sm" href={tool.href} key={tool.href}>
                  {pickText(tool.label, locale)}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
