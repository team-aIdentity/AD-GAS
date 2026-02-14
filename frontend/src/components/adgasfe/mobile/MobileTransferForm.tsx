'use client';

import { useState } from 'react';
import { ChevronDown, Copy, ArrowRight } from 'lucide-react';
import type { Token } from '@/types/adgasfe';
import { useLocale } from '@/contexts/LocaleContext';

interface MobileTransferFormProps {
  isConnected: boolean;
  walletAddress: string;
  recipientAddress: string;
  onRecipientChange: (address: string) => void;
  selectedToken: Token | null;
  onTokenChange: (token: Token) => void;
  amount: string;
  onAmountChange: (amount: string) => void;
  availableTokens: Token[];
  onSendClick: () => void;
  isServiceSuspended?: boolean;
}

export function MobileTransferForm({
  isConnected,
  walletAddress,
  recipientAddress,
  onRecipientChange,
  selectedToken,
  onTokenChange,
  amount,
  onAmountChange,
  availableTokens,
  onSendClick,
  isServiceSuspended = false,
}: MobileTransferFormProps) {
  const { t } = useLocale();
  const [showTokenSelect, setShowTokenSelect] = useState(false);

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : t('mobile.walletNeeded');

  return (
    <div className="space-y-4">
      <div className="bg-[rgba(255,255,255,0.03)] relative rounded-[20px] w-full border border-[rgba(255,255,255,0.08)] shadow-[0px_6px_24px_0px_rgba(0,0,0,0.19)]">
        <div className="p-5 space-y-4">
          <div className="flex flex-col gap-1">
            <p className="font-extrabold leading-[19.2px] text-[16px] text-white">{t('mobile.walletConnect')}</p>
            <p className="font-medium leading-[14.4px] text-[#94a3b8] text-[12px]">
              {t('mobile.walletInfo')}
            </p>
          </div>
          <div className="bg-[rgba(255,255,255,0.03)] relative rounded-2xl w-full border border-[rgba(255,255,255,0.08)] p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-[#94a3b8] text-[11px]">{t('mobile.senderAddress')}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-bold text-[#e2e8f0] text-[13px]">{shortAddress}</p>
                  {isConnected && <Copy className="size-3 text-[#94a3b8]" />}
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-[#94a3b8] text-[11px]">{t('mobile.balance')}</p>
                <p className="font-extrabold text-white text-[16px] mt-1">
                  {isConnected && selectedToken ? selectedToken.balance.toFixed(4) : '0.0000'}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-[rgba(255,255,255,0.03)] relative rounded-2xl w-full border border-[rgba(255,255,255,0.08)] p-4">
            <p className="font-semibold text-[#94a3b8] text-[11px] mb-2">{t('mobile.recipientAddress')}</p>
            <input
              type="text"
              value={recipientAddress}
              onChange={e => onRecipientChange(e.target.value)}
              placeholder="0x..."
              disabled={!isConnected}
              className="w-full bg-transparent font-bold text-[#e2e8f0] text-[13px] outline-none placeholder:text-[#64748b] disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      <div className="bg-[rgba(255,255,255,0.03)] relative rounded-[20px] w-full border border-[rgba(255,255,255,0.08)] shadow-[0px_6px_24px_0px_rgba(0,0,0,0.19)]">
        <div className="p-5 space-y-4">
          <div className="flex flex-col gap-1">
            <p className="font-extrabold leading-[19.2px] text-[16px] text-white">{t('sendFree')}</p>
            <p className="font-medium leading-[14.4px] text-[#94a3b8] text-[12px]">
              {t('sendFreeDesc')}
            </p>
          </div>
          <div>
            <p className="font-bold text-[#e2e8f0] text-[13px] mb-2">{t('tokenToSend')}</p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTokenSelect(!showTokenSelect)}
                disabled={!isConnected}
                className="bg-[rgba(255,255,255,0.03)] h-[48px] relative rounded-xl w-full border border-[rgba(255,255,255,0.08)] disabled:opacity-50 flex items-center justify-between px-4"
              >
                <p className="font-medium text-[#e2e8f0] text-[14px]">
                  {selectedToken ? selectedToken.symbol : 'null'}
                </p>
                <ChevronDown className="size-4 text-[#94a3b8]" />
              </button>
              {showTokenSelect && (
                <div className="absolute top-full mt-2 w-full bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-lg z-10 overflow-hidden">
                  {availableTokens.map(token => (
                    <button
                      type="button"
                      key={token.symbol}
                      onClick={() => {
                        onTokenChange(token);
                        setShowTokenSelect(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-[rgba(99,102,241,0.13)] transition-colors flex justify-between items-center"
                    >
                      <span className="text-[#e2e8f0] font-medium text-sm">{token.symbol}</span>
                      <span className="text-[#94a3b8] text-xs">{token.balance.toFixed(4)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <p className="font-bold text-[#e2e8f0] text-[13px] mb-2">
              {t('amountToSend')} ({selectedToken?.symbol || 'USDC'})
            </p>
            <div className="bg-[rgba(255,255,255,0.03)] h-[48px] relative rounded-xl w-full border border-[rgba(255,255,255,0.08)] flex items-center px-4">
              <input
                type="number"
                value={amount}
                onChange={e => onAmountChange(e.target.value)}
                placeholder="0.0100"
                disabled={!isConnected}
                step="0.0001"
                className="flex-1 bg-transparent font-medium text-[#e2e8f0] text-[14px] outline-none placeholder:text-[#64748b] disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between bg-[rgba(99,102,241,0.1)] rounded-xl p-4 border border-[rgba(99,102,241,0.25)]">
          <div>
            <p className="font-semibold text-[#93c5fd] text-[11px]">{t('normalGas')}</p>
            <p className="font-bold text-white text-[16px]">~$0.50</p>
          </div>
          <ArrowRight className="size-5 text-[#6366f1]" />
          <div className="text-right">
            <p className="font-semibold text-[#93c5fd] text-[11px]">{t('afterAd')}</p>
            <p className="font-bold text-[#10b981] text-[16px]">$0.00</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSendClick}
          disabled={!isConnected || isServiceSuspended}
          className="w-full h-14 rounded-2xl bg-gradient-to-b from-[#dc2626] to-[#b91c1c] border border-[rgba(239,68,68,0.25)] shadow-[0px_0px_24px_0px_rgba(239,68,68,0.38)] hover:from-[#ef4444] hover:to-[#dc2626] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          <span className="text-[20px]">📺</span>
          <span className="font-extrabold text-white text-[15px]">
            {isServiceSuspended ? t('serviceSuspended') : t('sendWithAd')}
          </span>
        </button>
      </div>
    </div>
  );
}
