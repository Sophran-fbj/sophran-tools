import { notFound } from 'next/navigation';
import { articles, getArticle } from '@/content/articles';
import { ArticleClient } from './ArticleClient';

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  return <ArticleClient article={article} />;
}
