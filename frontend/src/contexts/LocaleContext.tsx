'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import enTranslations from '@/lib/i18n/locales/en.json';
import koTranslations from '@/lib/i18n/locales/ko.json';

const LOCALE_KEY = 'adwallet-locale';
export type Locale = 'en' | 'ko';

const defaultLocale: Locale = 'en';

type Translations = Record<string, string>;
const translationsByLocale: Record<Locale, Translations> = {
  en: enTranslations,
  ko: koTranslations,
};

function replaceParams(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value)),
    str
  );
}

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isLoading: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const translations = translationsByLocale[locale];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(LOCALE_KEY);
    const initial: Locale = stored === 'ko' || stored === 'en' ? stored : defaultLocale;
    setLocaleState(initial);
    document.documentElement.lang = initial === 'ko' ? 'ko' : 'en';
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCALE_KEY, next);
      document.documentElement.lang = next === 'ko' ? 'ko' : 'en';
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const value = translations?.[key];
      if (value == null) return key;
      return replaceParams(value, params);
    },
    [translations]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, isLoading: false }),
    [locale, setLocale, t]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
