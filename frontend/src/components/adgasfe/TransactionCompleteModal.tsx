'use client';

import { CheckCircle2, ExternalLink, Home } from 'lucide-react';
import { useLocale } from '@/contexts/LocaleContext';

interface TransactionCompleteModalProps {
  isOpen: boolean;
  txHash: string;
  chainId: number;
  onClose: () => void;
}

function getExplorerUrl(chainId: number, txHash: string): string {
  switch (chainId) {
    case 1:
      return `https://etherscan.io/tx/${txHash}`;
    case 8453:
      return `https://basescan.org/tx/${txHash}`;
    case 43114:
      return `https://snowtrace.io/tx/${txHash}`;
    case 56:
      return `https://bscscan.com/tx/${txHash}`;
    case 84532:
      return `https://sepolia.basescan.org/tx/${txHash}`;
    default:
      return `https://snowtrace.io/tx/${txHash}`; // 기본값: Avalanche
  }
}

export function TransactionCompleteModal({
  isOpen,
  txHash,
  chainId,
  onClose,
}: TransactionCompleteModalProps) {
  const { t } = useLocale();
  const explorerUrl = getExplorerUrl(chainId, txHash);

  if (!isOpen) return null;

  const handleGoToMain = () => {
    onClose();
    window.location.reload();
  };

  const handleScan = () => {
    window.open(explorerUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e293b] rounded-3xl max-w-md w-full overflow-hidden border border-[rgba(99,102,241,0.3)] shadow-[0px_0px_40px_0px_rgba(99,102,241,0.4)]">
        <div className="p-6 border-b border-[rgba(255,255,255,0.08)]">
          <h2 className="font-extrabold text-xl text-white text-center">{t('completeModal.title')}</h2>
        </div>

        <div className="p-8 flex flex-col items-center gap-6">
          <div className="relative">
            <div className="bg-gradient-to-br from-[#10b981] to-[#059669] p-6 rounded-full">
              <CheckCircle2 className="size-16 text-white" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <p className="text-2xl font-bold text-white">{t('completeModal.success')}</p>
            <p className="text-sm text-[#94a3b8]">{t('completeModal.successDesc')}</p>
          </div>

          <div className="w-full bg-[rgba(255,255,255,0.03)] rounded-2xl p-4 border border-[rgba(255,255,255,0.08)]">
            <div className="space-y-3">
              <div>
                <span className="text-xs text-[#64748b] block mb-2">{t('completeModal.txHash')}</span>
                <div className="flex items-center gap-2">
                  <code className="text-sm text-white font-mono break-all flex-1">{txHash}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(txHash)}
                    className="text-[#94a3b8] hover:text-white transition-colors"
                    title={t('completeModal.copy')}
                  >
                    📋
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full space-y-3">
            <button
              onClick={handleScan}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-b from-[#6366f1] to-[#4f46e5] border border-[rgba(99,102,241,0.3)] hover:from-[#4f46e5] hover:to-[#4338ca] transition-all font-bold text-white flex items-center justify-center gap-2"
            >
              <ExternalLink className="size-5" />
              {t('completeModal.viewExplorer')}
            </button>
            <button
              onClick={handleGoToMain}
              className="w-full py-3 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.08)] transition-all font-bold text-white flex items-center justify-center gap-2"
            >
              <Home className="size-5" />
              {t('completeModal.goHome')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
