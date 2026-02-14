'use client';

import { Loader2, CheckCircle2 } from 'lucide-react';
import { useLocale } from '@/contexts/LocaleContext';

interface PendingTransaction {
  amount: string;
  token: { symbol: string };
  network: { name: string };
}

interface TransactionModalProps {
  isOpen: boolean;
  transaction: PendingTransaction | null;
}

export function TransactionModal({ isOpen, transaction }: TransactionModalProps) {
  const { t } = useLocale();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e293b] rounded-3xl max-w-md w-full overflow-hidden border border-[rgba(99,102,241,0.3)] shadow-[0px_0px_40px_0px_rgba(99,102,241,0.4)]">
        <div className="p-6 border-b border-[rgba(255,255,255,0.08)]">
          <h2 className="font-extrabold text-xl text-white text-center">{t('txModal.processing')}</h2>
        </div>

        <div className="p-8 flex flex-col items-center gap-6">
          <div className="relative">
            <div className="bg-gradient-to-br from-[#6366f1] to-[#4f46e5] p-6 rounded-full">
              <Loader2 className="size-16 text-white animate-spin" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-[#10b981] p-2 rounded-full border-4 border-[#1e293b]">
              <CheckCircle2 className="size-6 text-white" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <p className="text-xl font-bold text-white">{t('txModal.recording')}</p>
            <p className="text-sm text-[#94a3b8]">{t('txModal.pleaseWait')}</p>
          </div>

          {transaction && (
            <div className="w-full bg-[rgba(255,255,255,0.03)] rounded-2xl p-4 border border-[rgba(255,255,255,0.08)]">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-xs text-[#64748b]">{t('txModal.sendingAmount')}</span>
                  <span className="text-sm text-white font-bold">
                    {transaction.amount} {transaction.token.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[#64748b]">{t('adModal.network')}</span>
                  <span className="text-sm text-white">{transaction.network.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[#64748b]">{t('adModal.gas')}</span>
                  <span className="text-sm text-[#10b981] font-bold">{t('txModal.gasFree')} ✨</span>
                </div>
              </div>
            </div>
          )}

          <div className="w-full space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <div className="size-2 bg-[#10b981] rounded-full animate-pulse" />
              <span className="text-[#94a3b8]">{t('txModal.adComplete')}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="size-2 bg-[#10b981] rounded-full animate-pulse" />
              <span className="text-[#94a3b8]">{t('txModal.paymasterSponsoring')}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Loader2 className="size-4 text-[#6366f1] animate-spin" />
              <span className="text-white font-medium">{t('txModal.sendingTx')}</span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-[rgba(255,255,255,0.03)] border-t border-[rgba(255,255,255,0.08)]">
          <p className="text-xs text-center text-[#64748b]">{t('txModal.autoClose')}</p>
        </div>
      </div>
    </div>
  );
}
