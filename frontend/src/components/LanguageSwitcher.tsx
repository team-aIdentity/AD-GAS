'use client';

import { useLocale } from '@/contexts/LocaleContext';

export type LanguageSwitcherVariant = 'default' | 'compact';

interface LanguageSwitcherProps {
  /** compact: 짧은 라벨(EN/KO), 작은 패딩 — 모바일 헤더 등 좁은 폭용 */
  variant?: LanguageSwitcherVariant;
}

export function LanguageSwitcher({ variant = 'default' }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocale();
  const compact = variant === 'compact';

  return (
    <div
      className="flex shrink-0 flex-nowrap items-center gap-0.5 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] p-0.5"
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={`whitespace-nowrap rounded-full font-medium transition-colors ${
          compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
        } ${
          locale === 'en'
            ? 'bg-[rgba(99,102,241,0.25)] text-white'
            : 'text-[#94a3b8] hover:bg-[rgba(255,255,255,0.05)] hover:text-white'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale('ko')}
        className={`whitespace-nowrap rounded-full font-medium transition-colors ${
          compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
        } ${
          locale === 'ko'
            ? 'bg-[rgba(99,102,241,0.25)] text-white'
            : 'text-[#94a3b8] hover:bg-[rgba(255,255,255,0.05)] hover:text-white'
        }`}
      >
        {compact ? 'KO' : '한국어'}
      </button>
    </div>
  );
}
