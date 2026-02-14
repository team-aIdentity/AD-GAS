'use client';

import { useLocale } from '@/contexts/LocaleContext';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-1 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] p-0.5">
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
          locale === 'en'
            ? 'bg-[rgba(99,102,241,0.25)] text-white'
            : 'text-[#94a3b8] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale('ko')}
        className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
          locale === 'ko'
            ? 'bg-[rgba(99,102,241,0.25)] text-white'
            : 'text-[#94a3b8] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
        }`}
      >
        한국어
      </button>
    </div>
  );
}
