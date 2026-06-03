'use client';

import { useEffect, useRef } from 'react';
import { useAccount, useReconnect } from 'wagmi';
import { isCapacitorNativeApp } from '@/utils/capacitorNative';

const LINKING_KEY = 'adgas_wallet_linking';
const TX_SIGNING_KEY = 'adgas_tx_signing';

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

  statusRef.current = status;

  useEffect(() => {
    if (!isCapacitorNativeApp()) return;

    const stopPoll = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const startPoll = () => {
      if (pollRef.current) return;
      let attempts = 0;
      pollRef.current = setInterval(() => {
        attempts += 1;
        const current = statusRef.current;

        if (isTxSigningInProgress()) {
          if (attempts >= 120) stopPoll();
          return;
        }

        if (current === 'connected') {
          setWalletLinkingFlag(false);
          stopPoll();
          return;
        }

        if (current === 'connecting') {
          if (attempts >= 120) stopPoll();
          return;
        }

        if (isWalletLinkingFlag()) {
          reconnect();
        }
        if (attempts >= 40) stopPoll();
      }, 500);
    };

    const onWalletResume = () => {
      if (!isWalletLinkingFlag() && !isTxSigningInProgress()) return;

      // Permit 직후 Transfer 서명: reconnect·플래그 해제로 두 번째 팝업 막지 않음
      if (isTxSigningInProgress()) {
        if (statusRef.current === 'connecting') startPoll();
        return;
      }

      const current = statusRef.current;
      if (current === 'connected') {
        setWalletLinkingFlag(false);
        stopPoll();
        return;
      }
      if (current === 'connecting') {
        startPoll();
        return;
      }
      reconnect();
      startPoll();
    };

    if (isWalletLinkingFlag() || isTxSigningInProgress()) {
      onWalletResume();
    }

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      onWalletResume();
    };

    document.addEventListener('visibilitychange', onVisible);

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
      document.removeEventListener('visibilitychange', onVisible);
      removeAppListener?.();
    };
  }, [reconnect]);

  return null;
}
