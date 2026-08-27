'use client';

import { Package } from 'lucide-react';
import { svgPaths } from '@/lib/svgPaths';
import { useLocale } from '@/contexts/LocaleContext';

function SendIcon() {
  return (
    <div className="relative size-6 shrink-0 sm:size-7 lg:size-8">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
        <path
          d={svgPaths.p3450b000}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

interface TabNavigationProps {
  activeTab: 'send' | 'transaction';
  onTabChange: (tab: 'send' | 'transaction') => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const { t } = useLocale();
  return (
    <nav className="flex w-full gap-1 rounded-[28px] bg-[rgba(255,255,255,0.05)] p-1 lg:inline-flex lg:w-auto">
      <button
        type="button"
        onClick={() => onTabChange('send')}
        className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[24px] px-3 py-3 transition-all sm:gap-3 sm:px-6 lg:flex-none ${
          activeTab === 'send'
            ? 'bg-[rgba(99,102,241,0.19)] border border-[rgba(99,102,241,0.38)] shadow-[0px_0px_16px_0px_rgba(99,102,241,0.25)]'
            : 'hover:bg-[rgba(255,255,255,0.03)]'
        }`}
      >
        <SendIcon />
        <span className={`text-[14px] font-bold sm:text-[15px] ${activeTab === 'send' ? 'text-white' : 'text-[#94a3b8]'}`}>
          {t('tab.send')}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onTabChange('transaction')}
        className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[24px] px-3 py-3 transition-all sm:gap-3 sm:px-6 lg:flex-none ${
          activeTab === 'transaction'
            ? 'bg-[rgba(99,102,241,0.19)] border border-[rgba(99,102,241,0.38)] shadow-[0px_0px_16px_0px_rgba(99,102,241,0.25)]'
            : 'hover:bg-[rgba(255,255,255,0.03)]'
        }`}
      >
        <Package className="size-6 sm:size-7 lg:size-8" />
        <span
          className={`text-[14px] font-bold sm:text-[15px] ${activeTab === 'transaction' ? 'text-white' : 'text-[#94a3b8]'}`}
        >
          {t('tab.transaction')}
        </span>
      </button>
    </nav>
  );
}
