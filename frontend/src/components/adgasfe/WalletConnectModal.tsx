'use client';

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import type { Connector, UseConnectReturnType } from 'wagmi';
import { config } from '@/wagmi.config';
import { toast } from 'sonner';
import { useLocale } from '@/contexts/LocaleContext';
import { isCapacitorNativeApp } from '@/utils/capacitorNative';
import {
  getCapacitorPreferredConnector,
  isWalletConnectProjectConfigured,
  orderConnectorsForEnvironment,
} from '@/lib/walletConnectEnvironment';
import { setWalletLinkingFlag } from '@/components/CapacitorWalletBootstrap';
import { DEFAULT_NETWORK } from '@/lib/networks';

type ConnectFn = UseConnectReturnType<typeof config>['connect'];

interface WalletConnectModalProps {
  open: boolean;
  onClose: () => void;
  connectors: readonly Connector[];
  connect: ConnectFn;
  reset: () => void;
  isPending: boolean;
  /** Capacitor: connect() 호출 직후 isPending 전에도 로딩 UI 표시 */
  isLinking?: boolean;
}

/**
 * Capacitor: MetaMask SDK 딥링크(원탭). 데스크톱: MetaMask SDK + Injected.
 */
export function WalletConnectModal({
  open,
  onClose,
  connectors,
  connect,
  reset,
  isPending,
  isLinking = false,
}: WalletConnectModalProps) {
  const { t } = useLocale();
  const nativeApp = typeof window !== 'undefined' && isCapacitorNativeApp();
  const visibleConnectors = useMemo(
    () => orderConnectorsForEnvironment(connectors),
    [connectors]
  );
  const preferredNative = useMemo(
    () => getCapacitorPreferredConnector(connectors),
    [connectors]
  );
  const wcOk = isWalletConnectProjectConfigured();
  const showWcSetupWarning = nativeApp && !wcOk && !preferredNative;

  const connectorLabel = (c: Connector) => {
    if (c.id === 'metaMaskSDK' || (c.id === 'walletConnect' && nativeApp)) {
      return t('walletConnect.metamaskViaWc');
    }
    return c.name;
  };

  const startConnect = (connector: Connector) => {
    if (nativeApp) setWalletLinkingFlag(true);
    connect(
      { connector, chainId: DEFAULT_NETWORK.chainId as 8453 | 91342 | 43114 | 56 },
      {
        onSuccess: () => {
          setWalletLinkingFlag(false);
          onClose();
        },
        onError: err => {
          setWalletLinkingFlag(false);
          reset();
          const msg =
            (err as { shortMessage?: string })?.shortMessage ??
            (err as Error)?.message ??
            t('errors.generic');
          toast.error(msg);
        },
      }
    );
  };

  if (!open) return null;

  const handleClose = () => {
    reset();
    onClose();
  };

  const nativeConnecting = nativeApp && (isPending || isLinking);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#1e293b] p-6">
        <h2 className="mb-4 text-xl font-extrabold text-white">{t('connectWallet')}</h2>

        {showWcSetupWarning && (
          <p className="mb-3 text-sm text-amber-200/90">{t('walletConnect.capacitorRequiresWcProjectId')}</p>
        )}

        {nativeConnecting ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <Loader2 className="size-10 animate-spin text-[#6366f1]" aria-hidden />
            <p className="text-sm font-semibold text-white">{t('walletConnect.metamaskOpening')}</p>
            <p className="text-sm leading-relaxed text-[#94a3b8]">{t('walletConnect.metamaskApprove')}</p>
          </div>
        ) : (
          <>
            {isPending && (
              <p className="mb-3 text-sm text-[#94a3b8]">{t('walletConnect.waitingWallet')}</p>
            )}
            <div className="space-y-2">
              {visibleConnectors.length === 0 && (
                <p className="rounded-lg bg-[rgba(239,68,68,0.12)] px-3 py-2 text-sm text-red-200">
                  {t('walletConnect.noConnectors')}
                </p>
              )}
              {visibleConnectors.map(connector => (
                <button
                  key={connector.uid}
                  type="button"
                  disabled={isPending}
                  onClick={() => startConnect(connector)}
                  className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] px-4 py-3 text-left font-medium text-white transition-colors hover:bg-[rgba(99,102,241,0.13)] disabled:opacity-50"
                >
                  {connectorLabel(connector)}
                </button>
              ))}
            </div>
          </>
        )}

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
