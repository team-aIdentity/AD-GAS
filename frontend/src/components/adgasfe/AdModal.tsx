'use client';

import { useEffect, useState } from 'react';
import { X, Play, Volume2 } from 'lucide-react';
import { useLocale } from '@/contexts/LocaleContext';

interface PendingTransaction {
  to: string;
  amount: string;
  token: { symbol: string };
  network: { name: string };
}

interface AdModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
  transaction: PendingTransaction | null;
}

export function AdModal({ isOpen, onComplete, onSkip, transaction }: AdModalProps) {
  const { t } = useLocale();
  const [timeRemaining, setTimeRemaining] = useState(15);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeRemaining(15);
      setIsPlaying(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isPlaying) return;

    if (timeRemaining > 0) {
      const timer = setTimeout(() => setTimeRemaining(timeRemaining - 1), 1000);
      return () => clearTimeout(timer);
    }
    onComplete();
  }, [timeRemaining, isOpen, isPlaying, onComplete]);

  const handlePlayAd = () => {
    setIsPlaying(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e293b] rounded-3xl max-w-3xl w-full overflow-hidden border border-[rgba(99,102,241,0.3)] shadow-[0px_0px_40px_0px_rgba(99,102,241,0.4)]">
        <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-3">
            <div className="bg-[rgba(239,68,68,0.15)] p-3 rounded-xl border border-[rgba(239,68,68,0.25)]">
              <Volume2 className="size-6 text-[#ef4444]" />
            </div>
            <div>
              <h2 className="font-extrabold text-xl text-white">{t('adModal.title')}</h2>
              <p className="text-sm text-[#94a3b8]">{t('adModal.desc')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="p-2 hover:bg-[rgba(255,255,255,0.05)] rounded-lg transition-colors"
          >
            <X className="size-6 text-[#94a3b8]" />
          </button>
        </div>

        <div className="relative aspect-video bg-gradient-to-br from-[#4c1d95] via-[#5b21b6] to-[#6d28d9] flex items-center justify-center">
          {!isPlaying ? (
            <button
              type="button"
              onClick={handlePlayAd}
              className="bg-white/10 backdrop-blur-sm p-8 rounded-full hover:bg-white/20 transition-all border border-white/20"
            >
              <Play className="size-16 text-white fill-white" />
            </button>
          ) : (
            <div className="flex flex-col items-center gap-6 text-white">
              <div className="relative">
                <svg className="size-32 -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="60"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="60"
                    stroke="white"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 60}`}
                    strokeDashoffset={`${2 * Math.PI * 60 * (timeRemaining / 15)}`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-5xl font-bold">{timeRemaining}</span>
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-2xl font-bold">{t('adModal.watching')}</p>
                <p className="text-lg text-white/70">{t('adModal.secondsLeft', { count: timeRemaining })}</p>
              </div>
              <div className="mt-8 bg-white/10 backdrop-blur-sm px-8 py-4 rounded-2xl border border-white/20">
                <p className="text-lg font-semibold">🎮 {t('adModal.promoTitle')}</p>
                <p className="text-sm text-white/80 mt-1">{t('adModal.promoDesc')}</p>
              </div>
            </div>
          )}
        </div>

        {transaction && (
          <div className="p-6 bg-[rgba(255,255,255,0.03)] border-t border-[rgba(255,255,255,0.08)]">
            <p className="text-sm text-[#94a3b8] mb-3">{t('adModal.txInfo')}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#64748b]">{t('adModal.recipient')}</p>
                <p className="text-sm text-white font-mono break-all">{transaction.to}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748b]">{t('adModal.amount')}</p>
                <p className="text-sm text-white font-bold">
                  {transaction.amount} {transaction.token.symbol}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#64748b]">{t('adModal.network')}</p>
                <p className="text-sm text-white">{transaction.network.name}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748b]">{t('adModal.gas')}</p>
                <p className="text-sm text-[#10b981] font-bold">{t('adModal.gasFree')}</p>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 border-t border-[rgba(255,255,255,0.08)] flex justify-between items-center">
          <p className="text-xs text-[#64748b]">{t('adModal.cancelWarning')}</p>
          <button
            type="button"
            onClick={onSkip}
            className="px-6 py-2 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)] rounded-lg text-sm text-[#94a3b8] transition-colors"
          >
            {t('adModal.cancelWatch')}
          </button>
        </div>
      </div>
    </div>
  );
}
