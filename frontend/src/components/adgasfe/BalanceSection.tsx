'use client';

import { toast } from 'sonner';
import { svgPaths } from '@/lib/svgPaths';
import type { Token } from '@/types/adgasfe';
import { useLocale } from '@/contexts/LocaleContext';

function CopyIcon() {
  return (
    <div className="relative shrink-0 size-4">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g clipPath="url(#clip0_1_209)">
          <path
            d={svgPaths.p216f800}
            stroke="#94A3B8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={svgPaths.p13e4b3c0}
            stroke="#94A3B8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <defs>
          <clipPath id="clip0_1_209">
            <path d="M0 0H16V16H0V0Z" fill="white" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

interface BalanceSectionProps {
  isConnected: boolean;
  walletAddress: string;
  token: Token | null;
  isLoading?: boolean;
}

export function BalanceSection({
  isConnected,
  walletAddress,
  token,
  isLoading,
}: BalanceSectionProps) {
  const { t } = useLocale();
  const handleCopyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      toast.success(t('addressCopied'));
    }
  };

  return (
    <div className="bg-[rgba(255,255,255,0.03)] content-stretch flex flex-col gap-6 items-start p-7 relative rounded-[24px] shrink-0 w-[540px] border border-[rgba(255,255,255,0.08)] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.19)]">
      <div className="content-stretch flex flex-col gap-1.5 items-start not-italic relative shrink-0 w-full">
        <p className="font-extrabold leading-6 relative shrink-0 text-[20px] text-white">
          {t('walletBalance')}
        </p>
        <p className="font-medium leading-[16.8px] relative shrink-0 text-[#94a3b8] text-[14px]">
          {t('walletBalanceDesc')}
        </p>
      </div>

      <div className="content-stretch flex flex-col items-start relative shrink-0 w-full">
        <div className="bg-[rgba(255,255,255,0.03)] relative rounded-2xl shrink-0 w-full border border-[rgba(255,255,255,0.08)]">
          <div className="flex flex-row items-center size-full">
            <div className="content-stretch flex items-center justify-between p-4 relative w-full">
              <div className="content-stretch flex flex-col gap-1.5 relative shrink-0">
                <p className="font-semibold leading-[15.6px] not-italic relative shrink-0 text-[#94a3b8] text-[13px]">
                  {t('walletEoa')}
                </p>
                <div className="content-stretch flex gap-2 items-center relative shrink-0">
                  <p className="font-bold leading-[16.8px] not-italic relative shrink-0 text-[#e2e8f0] text-[14px]">
                    {isConnected
                      ? walletAddress.length > 14
                        ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                        : walletAddress
                      : t('connectWalletPlease')}
                  </p>
                  {isConnected && (
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className="hover:opacity-70 transition-opacity"
                    >
                      <CopyIcon />
                    </button>
                  )}
                </div>
              </div>

              <div className="content-stretch flex flex-col gap-0.5 items-end not-italic relative shrink-0 text-right">
                <p className="font-extrabold leading-6 relative shrink-0 text-[20px] text-white">
                  {isLoading
                    ? '...'
                    : isConnected && token
                      ? token.balance >= 1
                        ? token.balance.toFixed(4)
                        : token.balance.toFixed(6)
                      : '0'}
                </p>
                <p className="font-semibold leading-[15.6px] relative shrink-0 text-[#94a3b8] text-[13px]">
                  {isConnected && token ? token.symbol : 'null'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
