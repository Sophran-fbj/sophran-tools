'use client';

import Link from 'next/link';
import { LanguageToggle } from '@/components/LanguageToggle';
import { articles, pickText } from '@/content/articles';
import { useI18n } from '@/lib/i18n/provider';

export default function ArticlesPage() {
  const { locale, t } = useI18n();

  return (
    <main className="min-h-screen bg-base-100 px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/" className="text-sm text-base-content/60 hover:text-base-content">
              ← {t.common.backHome}
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-primary">{t.common.articles}</h1>
            <p className="mt-2 text-sm text-base-content/70">
              {locale === 'zh'
                ? 'TxRay 的文章是工具的解释层：把每个风险点讲清楚。'
                : 'TxRay articles are the explanation layer behind the tools.'}
            </p>
          </div>
          <LanguageToggle />
        </div>

        <div className="mt-8 grid gap-4">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/articles/${article.slug}`}
              className="card bg-base-200 transition hover:bg-base-300"
            >
              <div className="card-body">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="card-title">{pickText(article.title, locale)}</h2>
                  {article.tags.map((tag) => (
                    <span className="badge badge-outline badge-sm" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-base-content/70">
                  {pickText(article.description, locale)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
