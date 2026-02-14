'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { svgPaths } from '@/lib/svgPaths';
import type { Token, Network } from '@/types/adgasfe';
import { useLocale } from '@/contexts/LocaleContext';

interface TransferSectionProps {
  isConnected: boolean;
  recipientAddress: string;
  onRecipientChange: (address: string) => void;
  selectedToken: Token | null;
  onTokenChange: (token: Token) => void;
  amount: string;
  onAmountChange: (amount: string) => void;
  availableTokens: Token[];
  selectedNetwork: Network; // for layout; gas estimate uses selectedToken
  onSendClick: () => void;
  onCancelClick: () => void;
  isServiceSuspended?: boolean;
}

function TvIcon() {
  return (
    <div className="relative shrink-0 size-[22px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22 22">
        <g clipPath="url(#clip0_1_205)">
          <path
            d={svgPaths.p25c02100}
            stroke="white"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.83333"
          />
          <path
            d={svgPaths.pb59e80}
            stroke="white"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.83333"
          />
        </g>
        <defs>
          <clipPath id="clip0_1_205">
            <path d="M0 0H22V22H0V0Z" fill="white" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

export function TransferSection({
  isConnected,
  recipientAddress,
  onRecipientChange,
  selectedToken,
  onTokenChange,
  amount,
  onAmountChange,
  availableTokens,
  selectedNetwork: _selectedNetwork,
  onSendClick,
  onCancelClick,
  isServiceSuspended = false,
}: TransferSectionProps) {
  const { t } = useLocale();
  const [showTokenSelect, setShowTokenSelect] = useState(false);

  const estimatedGasFee = 0.0021;
  const estimatedGasUSD = estimatedGasFee * (selectedToken?.usdPrice || 3500);

  const handleMaxClick = () => {
    if (selectedToken) {
      onAmountChange(selectedToken.balance.toString());
    }
  };

  return (
    <div className="bg-[rgba(255,255,255,0.03)] relative rounded-[24px] shrink-0 w-full border border-[rgba(255,255,255,0.08)] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.19)]">
      <div className="content-stretch flex flex-col gap-6 items-start p-7 relative w-full">
        <div className="content-stretch flex flex-col gap-1.5 items-start not-italic relative shrink-0 w-full">
          <p className="font-extrabold leading-6 relative shrink-0 text-[20px] text-white">
            {t('sendFree')}
          </p>
          <p className="font-medium leading-[16.8px] relative shrink-0 text-[#94a3b8] text-[14px]">
            {t('sendFreeDesc')}
          </p>
        </div>

        <div className="content-stretch flex flex-col gap-6 items-start relative shrink-0 w-full">
          <div className="content-stretch flex flex-col gap-2.5 items-start relative shrink-0 w-full">
            <p className="font-bold leading-[18px] not-italic relative shrink-0 text-[#e2e8f0] text-[15px]">
              {t('recipientAddress')}
            </p>
            <div className="bg-[rgba(255,255,255,0.03)] h-[54px] relative rounded-2xl shrink-0 w-full border border-[rgba(255,255,255,0.08)]">
              <input
                type="text"
                value={recipientAddress}
                onChange={e => onRecipientChange(e.target.value)}
                placeholder="0x..."
                disabled={!isConnected}
                className="w-full h-full bg-transparent px-5 text-[15px] font-medium leading-[18px] text-[#e2e8f0] placeholder:text-[#64748b] outline-none rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="content-stretch flex gap-5 items-start relative shrink-0 w-full">
            <div className="content-stretch flex flex-col gap-2.5 items-start relative shrink-0 w-[360px]">
              <p className="font-bold leading-[18px] not-italic relative shrink-0 text-[#e2e8f0] text-[15px]">
                {t('tokenToSend')}
              </p>
              <div className="relative w-full">
                <button
                  type="button"
                  onClick={() => setShowTokenSelect(!showTokenSelect)}
                  disabled={!isConnected}
                  className="bg-[rgba(255,255,255,0.03)] h-[54px] relative rounded-2xl w-full border border-[rgba(255,255,255,0.08)] disabled:opacity-50 disabled:cursor-not-allowed hover:border-[rgba(99,102,241,0.3)] transition-colors"
                >
                  <div className="flex items-center justify-between px-5 h-full">
                    <p className="font-medium leading-[18px] text-[#e2e8f0] text-[15px]">
                      {selectedToken ? `${selectedToken.symbol} (${selectedToken.name})` : 'null'}
                    </p>
                    <ChevronDown className="size-5 text-[#94a3b8]" />
                  </div>
                </button>

                {showTokenSelect && (
                  <div className="absolute top-full mt-2 w-full bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-lg z-10 overflow-hidden">
                    {availableTokens.map(token => (
                      <button
                        type="button"
                        key={token.symbol}
                        onClick={() => {
                          onTokenChange(token);
                          setShowTokenSelect(false);
                        }}
                        className="w-full px-5 py-3 text-left hover:bg-[rgba(99,102,241,0.13)] transition-colors flex justify-between items-center"
                      >
                        <span className="text-[#e2e8f0] font-medium">{token.symbol}</span>
                        <span className="text-[#94a3b8] text-sm">{token.balance.toFixed(4)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="content-stretch flex flex-1 flex-col gap-2.5 items-start min-h-px min-w-px relative">
              <p className="font-bold leading-[18px] not-italic relative shrink-0 text-[#e2e8f0] text-[15px]">
                {t('amountToSend')} ({selectedToken?.symbol || 'TOKEN'})
              </p>
              <div className="bg-[rgba(255,255,255,0.03)] h-[54px] relative rounded-2xl shrink-0 w-full border border-[rgba(255,255,255,0.08)]">
                <div className="flex items-center justify-between px-5 h-full">
                  <input
                    type="number"
                    value={amount}
                    onChange={e => onAmountChange(e.target.value)}
                    placeholder="0.0"
                    disabled={!isConnected}
                    step="0.0001"
                    className="flex-1 bg-transparent text-[15px] font-medium leading-[18px] text-[#e2e8f0] placeholder:text-[#64748b] outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={handleMaxClick}
                    disabled={!isConnected}
                    className="bg-[rgba(99,102,241,0.19)] h-8 px-4 rounded-lg border border-[rgba(99,102,241,0.31)] shadow-[0px_0px_12px_0px_rgba(99,102,241,0.25)] hover:bg-[rgba(99,102,241,0.25)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <p className="font-bold leading-[15.6px] text-[#a5b4fc] text-[13px]">{t('max')}</p>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="relative rounded-[18px] w-full bg-gradient-to-b from-[#1e40af] to-[#1e3a8a] border border-[rgba(59,130,246,0.25)] p-5">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <p className="font-semibold leading-[15.6px] text-[#93c5fd] text-[13px]">
                  {t('normalGas')}
                </p>
                <p className="font-bold text-white text-lg">~${estimatedGasUSD.toFixed(2)}</p>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <p className="font-semibold leading-[15.6px] text-[#93c5fd] text-[13px]">
                  {t('afterAd')}
                </p>
                <p className="font-bold text-[#10b981] text-lg">$0.00 🎉</p>
              </div>
            </div>
          </div>

          <div className="content-stretch flex gap-4 items-start relative shrink-0 w-full">
            <button
              type="button"
              onClick={onCancelClick}
              disabled={!isConnected}
              className="bg-[rgba(255,255,255,0.03)] h-14 px-6 rounded-2xl w-[250px] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.05)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <p className="font-bold leading-[18px] text-[#94a3b8] text-[15px]">{t('cancel')}</p>
            </button>

            <button
              type="button"
              onClick={onSendClick}
              disabled={!isConnected || isServiceSuspended}
              className="flex-1 h-14 rounded-2xl bg-gradient-to-b from-[#dc2626] to-[#b91c1c] border border-[rgba(239,68,68,0.25)] shadow-[0px_0px_24px_0px_rgba(239,68,68,0.38)] hover:from-[#ef4444] hover:to-[#dc2626] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center gap-3 px-7 h-full">
                <TvIcon />
                <p className="font-extrabold leading-[18px] text-[15px] text-white">
                  {isServiceSuspended ? t('serviceSuspended') : t('sendWithAd')}
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
