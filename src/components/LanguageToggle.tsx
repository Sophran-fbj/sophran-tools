'use client';

import { useI18n } from '@/lib/i18n/provider';

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="join">
      <button
        className={`btn join-item btn-xs ${locale === 'zh' ? 'btn-primary' : 'btn-ghost'}`}
        onClick={() => setLocale('zh')}
        type="button"
        aria-label={t.common.zh}
      >
        中
      </button>
      <button
        className={`btn join-item btn-xs ${locale === 'en' ? 'btn-primary' : 'btn-ghost'}`}
        onClick={() => setLocale('en')}
        type="button"
        aria-label={t.common.en}
      >
        EN
      </button>
    </div>
  );
}
