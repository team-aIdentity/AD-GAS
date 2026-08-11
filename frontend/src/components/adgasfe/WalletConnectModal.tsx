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
import {
  ensureWalletOnChain,
  isWalletSwitchRejectedError,
  type SupportedChainId,
} from '@/lib/ensureWalletChain';

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
  const attemptTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
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
    if (attemptTimeoutRef.current) {
      window.clearTimeout(attemptTimeoutRef.current);
      attemptTimeoutRef.current = null;
    }
    startingRef.current = false;
    setIsStarting(false);
  }, [open]);

  const clearAttemptTimeout = () => {
    if (!attemptTimeoutRef.current) return;
    window.clearTimeout(attemptTimeoutRef.current);
    attemptTimeoutRef.current = null;
  };

  const finishConnected = () => {
    // 연결 승인이 끝난 즉시 모달을 닫는다. 네트워크 동기화는 연결 UX를
    // 막지 않도록 백그라운드에서 이어서 처리한다.
    clearAttemptTimeout();
    startingRef.current = false;
    setIsStarting(false);
    onClose();

    void ensureWalletOnChain(targetChainId)
      .catch(error => {
        toast.error(
          isWalletSwitchRejectedError(error)
            ? t('toast.networkSwitchRejectedGeneric')
            : error instanceof Error && error.message
              ? error.message
              : t('toast.networkSwitchFailed')
        );
      })
      .finally(() => {
        setWalletLinkingFlag(false);
      });
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
    clearAttemptTimeout();
    attemptTimeoutRef.current = window.setTimeout(() => {
      if (!startingRef.current) return;
      startingRef.current = false;
      setIsStarting(false);
      setWalletLinkingFlag(false);
      reset();
      toast.error(t('errors.walletConnectionTimeout'));
    }, 12000);

    try {
      // MetaMask SDK의 isAuthorized()는 만료된 채널에서 수십 초간 대기할 수 있다.
      // 네이티브 앱은 사용자 탭 안에서 connect()를 바로 호출해 딥링크를 즉시 연다.
      if (
        !nativeApp &&
        (await connector.isAuthorized()) &&
        (await tryRestoreConnection(connector))
      ) {
        finishConnected();
        return;
      }
    } catch {
      // 승인 세션 조회 실패 시 일반 연결 요청으로 계속한다.
    }

    connect(
      // MetaMask SDK 커넥터 규격에 맞게 네이티브에서도 chainId를 전달한다.
      // 느린 isAuthorized 사전 조회는 건너뛰므로 딥링크 호출은 여전히 즉시 시작된다.
      { connector, chainId: targetChainId },
      {
        onSuccess: () => {
          finishConnected();
        },
        onError: err => {
          void (async () => {
            // MetaMask SDK 세션은 살아 있지만 Wagmi 상태만 끊긴 경우에는
            // 두 번째 connect 대신 기존 승인 세션을 다시 등록한다.
            if (isAlreadyConnectedError(err) && (await tryRestoreConnection(connector))) {
              finishConnected();
              return;
            }

            clearAttemptTimeout();
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
    clearAttemptTimeout();
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
      className="fixed inset-0 z-[9999] flex min-h-[100dvh] w-full max-w-[100vw] touch-manipulation items-center justify-center overflow-y-auto overscroll-contain bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="pointer-events-auto w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#1e293b] p-6">
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
                  className="pointer-events-auto min-h-12 w-full touch-manipulation rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] px-4 py-3 text-left font-medium text-white transition-colors hover:bg-[rgba(99,102,241,0.13)] disabled:opacity-50"
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
          className="pointer-events-auto mt-4 min-h-11 w-full touch-manipulation py-2 text-sm text-[#94a3b8] hover:text-white"
        >
          {isPending ? t('walletConnect.cancelAttempt') : t('close')}
        </button>
      </div>
    </div>,
    document.body
  );
}
