'use client';

import { useEffect, useRef } from 'react';
import { useAccount, useReconnect } from 'wagmi';
import { isCapacitorNativeApp } from '@/utils/capacitorNative';
import { config } from '@/wagmi.config';
import { getCapacitorPreferredConnector } from '@/lib/walletConnectEnvironment';

const LINKING_KEY = 'adgas_wallet_linking';
const TX_SIGNING_KEY = 'adgas_tx_signing';
const SESSION_RECOVERY_UNTIL_KEY = 'adgas_wallet_session_recovery_until';
export const WALLET_SESSION_RECOVERY_EVENT = 'adgas:wallet-session-recovery';

const DEFAULT_SESSION_RECOVERY_MS = 15_000;

export function setWalletLinkingFlag(active: boolean): void {
  if (typeof sessionStorage === 'undefined') return;
  if (active) sessionStorage.setItem(LINKING_KEY, '1');
  else sessionStorage.removeItem(LINKING_KEY);
}

export function isWalletLinkingFlag(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(LINKING_KEY) === '1';
}

export function setTxSigningInProgress(active: boolean): void {
  if (typeof sessionStorage === 'undefined') return;
  if (active) sessionStorage.setItem(TX_SIGNING_KEY, '1');
  else sessionStorage.removeItem(TX_SIGNING_KEY);
}

export function isTxSigningInProgress(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(TX_SIGNING_KEY) === '1';
}

/** MetaMask 앱 복귀 직후 발생할 수 있는 지연된 disconnect 이벤트를 복구한다. */
export function armWalletSessionRecovery(
  durationMs = DEFAULT_SESSION_RECOVERY_MS
): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(
    SESSION_RECOVERY_UNTIL_KEY,
    String(Date.now() + durationMs)
  );
  setWalletLinkingFlag(true);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(WALLET_SESSION_RECOVERY_EVENT));
  }
}

export function isWalletSessionRecoveryActive(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  const recoveryUntil = Number(
    sessionStorage.getItem(SESSION_RECOVERY_UNTIL_KEY) ?? 0
  );
  if (Number.isFinite(recoveryUntil) && recoveryUntil > Date.now()) return true;
  sessionStorage.removeItem(SESSION_RECOVERY_UNTIL_KEY);
  return false;
}

export function cancelWalletSessionRecovery(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(SESSION_RECOVERY_UNTIL_KEY);
  setWalletLinkingFlag(false);
}

/**
 * Capacitor: MetaMask 딥링크 복귀 후 connect() 세션을 방해하지 않고 연결 완료까지 대기.
 * - connecting 중 reconnect 금지
 * - Permit → Transfer 연속 서명 중 reconnect·플래그 해제 금지
 */
export function CapacitorWalletBootstrap() {
  const { reconnect } = useReconnect();
  const { status } = useAccount();
  const statusRef = useRef(status);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectInFlightRef = useRef(false);
  const lastSigningTransportResumeRef = useRef(0);

  statusRef.current = status;

  useEffect(() => {
    if (!isCapacitorNativeApp()) return;

    const stopPoll = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const restoreAuthorizedConnection = async () => {
      if (reconnectInFlightRef.current) return;
      const connector = getCapacitorPreferredConnector(config.connectors);
      if (!connector) return;

      reconnectInFlightRef.current = true;
      let reconnectStarted = false;
      try {
        // MetaMask Connect의 내부 상태가 CONNECTING일 때 reconnect()를 호출하면
        // 동일 세션에 두 번째 connect()가 들어간다. 계정 승인이 실제로 확인된
        // 경우에만 Wagmi 상태를 복구한다.
        if (!(await connector.isAuthorized())) return;
        reconnectStarted = true;
        reconnect(
          { connectors: [connector] },
          {
            onSettled: () => {
              reconnectInFlightRef.current = false;
            },
          }
        );
      } catch {
        // 아직 승인 응답이 도착하지 않았으면 다음 poll에서 다시 확인한다.
      } finally {
        if (!reconnectStarted) reconnectInFlightRef.current = false;
      }
    };

    const startPoll = () => {
      if (pollRef.current) return;
      let attempts = 0;
      pollRef.current = setInterval(() => {
        attempts += 1;
        const current = statusRef.current;
        const isRecoveringSession = isWalletSessionRecoveryActive();

        if (isTxSigningInProgress()) {
          if (attempts >= 120) stopPoll();
          return;
        }

        if (current === 'connected') {
          setWalletLinkingFlag(false);
          // MetaMask SDK가 앱 복귀 후 지연된 disconnect 이벤트를 보낼 수 있다.
          // 안정화 시간이 끝날 때까지 연결 상태를 감시한다.
          if (isRecoveringSession) return;
          stopPoll();
          return;
        }

        if (current === 'connecting' || current === 'reconnecting') {
          // 진행 중인 Connect 세션은 원래 Promise가 완료되도록 그대로 둔다.
          if (attempts >= 120) stopPoll();
          return;
        }

        if (
          current === 'disconnected' &&
          (isWalletLinkingFlag() || isRecoveringSession)
        ) {
          void restoreAuthorizedConnection();
        }
        if (attempts >= 120 || (!isRecoveringSession && !isWalletLinkingFlag())) {
          stopPoll();
        }
      }, 500);
    };

    const onWalletResume = () => {
      const isRecoveringSession = isWalletSessionRecoveryActive();
      if (
        !isWalletLinkingFlag() &&
        !isTxSigningInProgress() &&
        !isRecoveringSession
      ) return;

      // Permit 직후 Transfer 서명: reconnect·플래그 해제로 두 번째 팝업 막지 않음
      if (isTxSigningInProgress()) {
        // MetaMask Connect의 MWP transport는 브라우저 focus 이벤트에서 암호화
        // 채널을 갱신한다. Capacitor appState 복귀는 focus를 항상 발생시키지 않으므로
        // 여기서 전달하되, visibility/appState 중복 이벤트는 합친다. 설치 시 적용되는
        // SDK 보정은 잘못 남은 CONNECTED 상태에서도 reconnect가 실행되게 한다.
        const now = Date.now();
        if (now - lastSigningTransportResumeRef.current >= 800) {
          lastSigningTransportResumeRef.current = now;
          window.dispatchEvent(new Event('focus'));
        }
        if (statusRef.current === 'connecting') startPoll();
        return;
      }

      const current = statusRef.current;
      if (current === 'connected') {
        setWalletLinkingFlag(false);
        if (isRecoveringSession) {
          startPoll();
          return;
        }
        stopPoll();
        return;
      }
      if (current === 'connecting' || current === 'reconnecting') {
        startPoll();
        return;
      }
      void restoreAuthorizedConnection();
      startPoll();
    };

    if (
      isWalletLinkingFlag() ||
      isTxSigningInProgress() ||
      isWalletSessionRecoveryActive()
    ) {
      onWalletResume();
    }

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      onWalletResume();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(WALLET_SESSION_RECOVERY_EVENT, onWalletResume);

    let removeAppListener: (() => void) | undefined;
    void import('@capacitor/app')
      .then(({ App }) =>
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) onWalletResume();
        })
      )
      .then(handle => {
        removeAppListener = () => void handle.remove();
      })
      .catch(() => {});

    return () => {
      stopPoll();
      reconnectInFlightRef.current = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(WALLET_SESSION_RECOVERY_EVENT, onWalletResume);
      removeAppListener?.();
    };
  }, [reconnect]);

  return null;
}
