'use client';

import { useLocale } from '@/contexts/LocaleContext';

interface MobileGasSavingsProps {
  freeTransactionsUsed: number;
  dailyLimit: number;
}

export function MobileGasSavings({ freeTransactionsUsed, dailyLimit }: MobileGasSavingsProps) {
  const { t } = useLocale();
  return (
    <div className="bg-[rgba(255,255,255,0.03)] relative rounded-[20px] shrink-0 w-full border border-[rgba(255,255,255,0.08)] shadow-[0px_6px_24px_0px_rgba(0,0,0,0.19)]">
      <div className="content-stretch flex flex-col gap-4 items-start p-5 relative w-full">
        <div className="content-stretch flex flex-col gap-1 items-start relative shrink-0 text-white w-full">
          <p className="font-extrabold leading-[19.2px] relative shrink-0 text-[16px]">
            💰 {t('gasSavings')}
          </p>
          <p className="font-medium leading-[14.4px] relative shrink-0 text-[#94a3b8] text-[12px]">
            {t('gasSavingsDesc')}
          </p>
        </div>
        <div className="bg-[rgba(255,255,255,0.06)] relative rounded-2xl shrink-0 w-full border border-[rgba(255,255,255,0.08)]">
          <div className="flex flex-col items-center p-6 relative w-full">
            <p className="font-semibold leading-[15.6px] text-[#94a3b8] text-[13px]">{t('mobile.nextFreeGas')}</p>
            <p className="font-extrabold leading-[38.4px] text-[32px] text-white mt-2">$0.00</p>
            <p className="font-medium leading-[14.4px] text-[#10b981] text-[12px] mt-1">
              {t('mobile.lastAdValue')}
            </p>
            <div className="flex items-center justify-between w-full mt-6 pt-4 border-t border-[rgba(255,255,255,0.08)]">
              <div className="flex flex-col items-center flex-1">
                <p className="font-semibold text-[#94a3b8] text-[11px]">{t('mobile.freeRuns')}</p>
                <p className="font-extrabold text-white text-[20px] mt-1">{freeTransactionsUsed}{t('times')}</p>
              </div>
              <div className="flex flex-col items-center flex-1">
                <p className="font-semibold text-[#94a3b8] text-[11px]">{t('mobile.remainingLimitLabel')}</p>
                <p className="font-extrabold text-white text-[20px] mt-1">
                  {dailyLimit - freeTransactionsUsed}{t('perDay')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
