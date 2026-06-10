'use client';

import Link from 'next/link';
import { LanguageToggle } from '@/components/LanguageToggle';
import { WalletButton } from '@/components/WalletButton';
import { useI18n } from '@/lib/i18n/provider';

export default function TxRayPage() {
  const { t } = useI18n();

  return (
    <main className="min-h-screen bg-base-100 px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href="/"
              className="text-sm text-base-content/60 hover:text-base-content"
            >
              ← {t.common.backHome}
            </Link>
            <h1 className="mt-2 text-4xl font-bold text-primary">TxRay</h1>
            <p className="mt-2 text-base-content/80">{t.txray.intro}</p>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <WalletButton />
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Link
            href="/tools/txray/approvals"
            className="card bg-base-200 transition hover:bg-base-300"
          >
            <div className="card-body">
              <h2 className="card-title">{t.txray.approvalsTitle}</h2>
              <p className="text-sm text-base-content/70">{t.txray.approvalsDesc}</p>
            </div>
          </Link>

          <Link
            href="/tools/txray/decoder"
            className="card bg-base-200 transition hover:bg-base-300"
          >
            <div className="card-body">
              <h2 className="card-title">{t.txray.decoderTitle}</h2>
              <p className="text-sm text-base-content/70">{t.txray.decoderDesc}</p>
            </div>
          </Link>

          <Link
            href="/tools/signature-risk"
            className="card bg-base-200 transition hover:bg-base-300"
          >
            <div className="card-body">
              <h2 className="card-title">{t.txray.signatureTitle}</h2>
              <p className="text-sm text-base-content/70">{t.txray.signatureDesc}</p>
            </div>
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="card bg-base-200">
            <div className="card-body">
              <h2 className="card-title text-lg">{t.txray.demoTitle}</h2>
              <p className="text-sm text-base-content/70">{t.txray.demoDesc}</p>
              <div className="card-actions">
                <Link href="/tools/txray/approvals?demo=1" className="btn btn-primary btn-sm">
                  {t.txray.openApprovalDemo}
                </Link>
                <Link href="/tools/signature-risk" className="btn btn-secondary btn-sm">
                  {t.txray.openSignatureDemo}
                </Link>
              </div>
            </div>
          </div>

          <div className="card bg-base-200">
            <div className="card-body">
              <h2 className="card-title text-lg">{t.txray.articleTitle}</h2>
              <p className="text-sm text-base-content/70">{t.txray.articleDesc}</p>
              <div className="card-actions">
                <Link
                  href="/articles/why-unlimited-approval-is-dangerous"
                  className="btn btn-outline btn-sm"
                >
                  {t.txray.unlimitedApproval}
                </Link>
                <Link
                  href="/articles/permit2-eip712-phishing"
                  className="btn btn-outline btn-sm"
                >
                  {t.txray.permitSignature}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
