'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import type { Connector, UseConnectReturnType } from 'wagmi';
import { reconnect } from '@wagmi/core';
import { config } from '@/wagmi.config';
import { toast } from 'sonner';
import { useLocale } from '@/contexts/LocaleContext';
import { isCapacitorNativeApp } from '@/utils/capacitorNative';
import {
  orderConnectorsForEnvironment,
} from '@/lib/walletConnectEnvironment';
import { setWalletLinkingFlag } from '@/components/CapacitorWalletBootstrap';
import { ensureWalletOnChain, type SupportedChainId } from '@/lib/ensureWalletChain';

type ConnectFn = UseConnectReturnType<typeof config>['connect'];

interface WalletConnectModalProps {
  open: boolean;
  onClose: () => void;
  connectors: readonly Connector[];
  connect: ConnectFn;
  reset: () => void;
  isPending: boolean;
  targetChainId: SupportedChainId;
}

function isAlreadyConnectedError(error: unknown): boolean {
  const message =
    (error as { shortMessage?: string })?.shortMessage ??
    (error as Error)?.message ??
    '';
  return /connector\s+already\s+connected|already\s+connected/i.test(message);
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
  targetChainId,
}: WalletConnectModalProps) {
  const { t } = useLocale();
  const [isStarting, setIsStarting] = useState(false);
  const startingRef = useRef(false);
  const nativeApp = typeof window !== 'undefined' && isCapacitorNativeApp();
  const visibleConnectors = useMemo(
    () => orderConnectorsForEnvironment(connectors),
    [connectors]
  );
  const connectorLabel = (c: Connector) => {
    if (c.id === 'metaMaskSDK') {
      return t('walletConnect.metamaskViaWc');
    }
    return c.name;
  };

  useEffect(() => {
    if (open) return;
    startingRef.current = false;
    setIsStarting(false);
  }, [open]);

  const finishConnected = async () => {
    try {
      await ensureWalletOnChain(targetChainId);
    } catch {
      toast.error(t('toast.networkSwitchFailed'));
    } finally {
      startingRef.current = false;
      setIsStarting(false);
      setWalletLinkingFlag(false);
      onClose();
    }
  };

  const tryRestoreConnection = async (connector: Connector): Promise<boolean> => {
    try {
      const connections = await reconnect(config, { connectors: [connector] });
      return connections.some(connection => connection.connector.uid === connector.uid);
    } catch {
      return false;
    }
  };

  const startConnect = async (connector: Connector) => {
    if (startingRef.current || isPending) return;
    startingRef.current = true;
    setIsStarting(true);
    if (nativeApp) setWalletLinkingFlag(true);

    try {
      if ((await connector.isAuthorized()) && (await tryRestoreConnection(connector))) {
        await finishConnected();
        return;
      }
    } catch {
      // 승인 세션 조회 실패 시 일반 연결 요청으로 계속한다.
    }

    connect(
      { connector, chainId: targetChainId },
      {
        onSuccess: () => {
          void finishConnected();
        },
        onError: err => {
          void (async () => {
            // MetaMask SDK 세션은 살아 있지만 Wagmi 상태만 끊긴 경우에는
            // 두 번째 connect 대신 기존 승인 세션을 다시 등록한다.
            if (isAlreadyConnectedError(err) && (await tryRestoreConnection(connector))) {
              await finishConnected();
              return;
            }

            startingRef.current = false;
            setIsStarting(false);
            setWalletLinkingFlag(false);
            reset();
            const msg =
              (err as { shortMessage?: string })?.shortMessage ??
              (err as Error)?.message ??
              t('errors.generic');
            toast.error(msg);
          })();
        },
      }
    );
  };

  if (!open) return null;

  const handleClose = () => {
    reset();
    startingRef.current = false;
    setIsStarting(false);
    setWalletLinkingFlag(false);
    onClose();
  };

  const nativeConnecting = nativeApp && (isPending || isStarting);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#1e293b] p-6">
        <h2 className="mb-4 text-xl font-extrabold text-white">{t('connectWallet')}</h2>

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
                  disabled={isPending || isStarting}
                  onClick={() => void startConnect(connector)}
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
    </div>,
    document.body
  );
}
