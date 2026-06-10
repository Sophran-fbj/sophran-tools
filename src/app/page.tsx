'use client';

import Link from 'next/link';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useI18n } from '@/lib/i18n/provider';

export default function Home() {
  const { t } = useI18n();

  return (
    <main className="min-h-screen bg-base-100 px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-primary">{t.home.title}</h1>
            <p className="mt-4 text-base-content/80">{t.home.subtitle}</p>
          </div>
          <LanguageToggle />
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Link
            href="/tools/txray"
            className="card bg-base-200 transition hover:bg-base-300"
          >
            <div className="card-body">
              <h2 className="card-title">
                TxRay
                <span className="badge badge-primary badge-sm">{t.common.available}</span>
              </h2>
              <p className="text-sm text-base-content/70">{t.home.txrayDesc}</p>
            </div>
          </Link>
          <Link
            href="/tools/signature-risk"
            className="card bg-base-200 transition hover:bg-base-300"
          >
            <div className="card-body">
              <h2 className="card-title">
                {t.home.signatureRiskTitle}
                <span className="badge badge-secondary badge-sm">{t.common.available}</span>
              </h2>
              <p className="text-sm text-base-content/70">
                {t.home.signatureRiskDesc}
              </p>
            </div>
          </Link>
        </div>

        <p className="mt-12 text-xs text-base-content/50">🔒 {t.common.neverSeed}</p>
      </div>
    </main>
  );
}
