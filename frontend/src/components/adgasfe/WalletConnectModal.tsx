'use client';

import type { Connector, UseConnectReturnType } from 'wagmi';
import { config } from '@/wagmi.config';
import { toast } from 'sonner';
import { useLocale } from '@/contexts/LocaleContext';

/** 프로젝트 `Register.config`와 동일한 Connect 뮤테이션 타입 (기본 `Config`와 불일치 방지) */
type ConnectFn = UseConnectReturnType<typeof config>['connect'];

interface WalletConnectModalProps {
  open: boolean;
  onClose: () => void;
  connectors: readonly Connector[];
  connect: ConnectFn;
  reset: () => void;
  isPending: boolean;
}

/**
 * 지갑 연결 모달 — 연결 성공 시에만 닫고, pending 중에는 모달 유지 (모바일 MetaMask 이탈 시 stuck 방지)
 */
export function WalletConnectModal({
  open,
  onClose,
  connectors,
  connect,
  reset,
  isPending,
}: WalletConnectModalProps) {
  const { t } = useLocale();

  if (!open) return null;

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#1e293b] p-6">
        <h2 className="mb-4 text-xl font-extrabold text-white">{t('connectWallet')}</h2>
        {isPending && (
          <p className="mb-3 text-sm text-[#94a3b8]">{t('walletConnect.waitingWallet')}</p>
        )}
        <div className="space-y-2">
          {connectors.map(connector => (
            <button
              key={connector.uid}
              type="button"
              disabled={isPending}
              onClick={() => {
                connect(
                  { connector },
                  {
                    onSuccess: () => {
                      onClose();
                    },
                    onError: err => {
                      reset();
                      const msg =
                        (err as { shortMessage?: string })?.shortMessage ??
                        (err as Error)?.message ??
                        t('errors.generic');
                      toast.error(msg);
                    },
                  }
                );
              }}
              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] px-4 py-3 text-left font-medium text-white transition-colors hover:bg-[rgba(99,102,241,0.13)] disabled:opacity-50"
            >
              {connector.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="mt-4 w-full py-2 text-sm text-[#94a3b8] hover:text-white"
        >
          {isPending ? t('walletConnect.cancelAttempt') : t('close')}
        </button>
      </div>
    </div>
  );
}
