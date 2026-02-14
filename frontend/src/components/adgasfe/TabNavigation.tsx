'use client';

import { Package } from 'lucide-react';
import { svgPaths } from '@/lib/svgPaths';
import { useLocale } from '@/contexts/LocaleContext';

function SendIcon() {
  return (
    <div className="relative shrink-0 size-[32px]">
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
    <div className="bg-[rgba(255,255,255,0.05)] rounded-[28px] p-1 inline-flex gap-1">
      <button
        type="button"
        onClick={() => onTabChange('send')}
        className={`flex items-center gap-3 px-6 py-3 rounded-[24px] transition-all ${
          activeTab === 'send'
            ? 'bg-[rgba(99,102,241,0.19)] border border-[rgba(99,102,241,0.38)] shadow-[0px_0px_16px_0px_rgba(99,102,241,0.25)]'
            : 'hover:bg-[rgba(255,255,255,0.03)]'
        }`}
      >
        <SendIcon />
        <span className={`font-bold text-[15px] ${activeTab === 'send' ? 'text-white' : 'text-[#94a3b8]'}`}>
          {t('tab.send')}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onTabChange('transaction')}
        className={`flex items-center gap-3 px-6 py-3 rounded-[24px] transition-all ${
          activeTab === 'transaction'
            ? 'bg-[rgba(99,102,241,0.19)] border border-[rgba(99,102,241,0.38)] shadow-[0px_0px_16px_0px_rgba(99,102,241,0.25)]'
            : 'hover:bg-[rgba(255,255,255,0.03)]'
        }`}
      >
        <Package className="size-8" />
        <span
          className={`font-bold text-[15px] ${activeTab === 'transaction' ? 'text-white' : 'text-[#94a3b8]'}`}
        >
          {t('tab.transaction')}
        </span>
      </button>
    </div>
  );
}
