'use client';

import { svgPaths } from '@/lib/svgPaths';
import { useLocale } from '@/contexts/LocaleContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

function Logo() {
  return (
    <div className="bg-[rgba(255,255,255,0.08)] content-stretch flex items-center justify-center relative rounded-[12px] shrink-0 size-[40px] border border-[rgba(99,102,241,0.5)] shadow-[0px_6px_24px_0px_rgba(99,102,241,0.25)]">
      <p className="font-semibold leading-[26.4px] not-italic relative shrink-0 text-[22px] text-white">
        🚀
      </p>
    </div>
  );
}

function TitleGroup() {
  const { t } = useLocale();
  return (
    <div className="content-stretch flex flex-col gap-px items-start not-italic relative shrink-0">
      <p className="font-extrabold leading-[21.6px] relative shrink-0 text-[18px] text-shadow-[0px_0px_16px_rgba(99,102,241,0.5)] text-white">
        Gasless SDK
      </p>
      <p className="font-semibold leading-[13.2px] relative shrink-0 text-[#a5b4fc] text-[11px]">
        {t('header.tagline')}
      </p>
    </div>
  );
}

function WalletIcon() {
  return (
    <div className="relative shrink-0 size-[20px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <path
          d={svgPaths.p3e8f800}
          stroke="#A5B4FC"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.66667"
        />
        <path
          d={svgPaths.p11d57a00}
          stroke="#A5B4FC"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.66667"
        />
      </svg>
    </div>
  );
}

interface MobileHeaderProps {
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  freeTransactionsUsed: number;
}

export function MobileHeader({
  isConnected,
  onConnect,
  onDisconnect,
  freeTransactionsUsed,
}: MobileHeaderProps) {
  const { t } = useLocale();
  return (
    <header className="relative shrink-0 w-full">
      <div className="content-stretch flex flex-col gap-4 items-start pb-4 pt-5 px-5 relative w-full">
        <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
          <div className="content-stretch flex gap-2.5 items-center relative shrink-0">
            <Logo />
            <TitleGroup />
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
          <button
            type="button"
            onClick={isConnected ? onDisconnect : onConnect}
            className="bg-[rgba(99,102,241,0.19)] h-[44px] flex items-center justify-center relative rounded-[22px] shrink-0 w-[120px] border border-[rgba(99,102,241,0.38)] shadow-[0px_0px_16px_0px_rgba(99,102,241,0.25)] hover:bg-[rgba(99,102,241,0.25)] transition-colors"
          >
            <WalletIcon />
          </button>
          </div>
        </div>

        <div className="bg-[rgba(255,255,255,0.06)] relative rounded-2xl shrink-0 w-full border border-[rgba(255,255,255,0.13)] shadow-[0px_6px_24px_0px_rgba(0,0,0,0.25)]">
          <div className="content-stretch flex gap-3 items-start not-italic p-4 relative text-center w-full">
            <div className="content-stretch flex flex-1 flex-col gap-1 items-center min-h-px min-w-px relative">
              <p className="font-normal leading-6 relative shrink-0 text-[20px] text-white">💰</p>
              <div className="content-stretch flex flex-col gap-px items-center relative shrink-0">
                <p className="font-extrabold leading-[21.6px] relative shrink-0 text-[18px] text-shadow-[0px_0px_12px_rgba(16,185,129,0.38)] text-white">
                  $1,234
                </p>
                <p className="font-semibold leading-[13.2px] relative shrink-0 text-[#94a3b8] text-[11px]">
                  {t('mobile.savingsTotal')}
                </p>
              </div>
            </div>
            <div className="content-stretch flex flex-1 flex-col gap-1 items-center min-h-px min-w-px relative">
              <p className="font-normal leading-6 relative shrink-0 text-[20px] text-white">⚡</p>
              <div className="content-stretch flex flex-col gap-px items-center relative shrink-0">
                <p className="font-extrabold leading-[21.6px] relative shrink-0 text-[18px] text-shadow-[0px_0px_12px_rgba(245,158,11,0.38)] text-white">
                  {freeTransactionsUsed}
                </p>
                <p className="font-semibold leading-[13.2px] relative shrink-0 text-[#94a3b8] text-[11px]">
                  {t('mobile.transactions')}
                </p>
              </div>
            </div>
            <div className="content-stretch flex flex-1 flex-col gap-1 items-center min-h-px min-w-px relative">
              <p className="font-normal leading-6 relative shrink-0 text-[20px] text-white">🌐</p>
              <div className="content-stretch flex flex-col gap-px items-center relative shrink-0">
                <p className="font-extrabold leading-[21.6px] relative shrink-0 text-[18px] text-shadow-[0px_0px_12px_rgba(59,130,246,0.38)] text-white">
                  5
                </p>
                <p className="font-semibold leading-[13.2px] relative shrink-0 text-[#94a3b8] text-[11px]">
                  {t('mobile.supportedChains')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
