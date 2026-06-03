'use client';

import { useEffect, useRef } from 'react';
import { useAccount, useReconnect } from 'wagmi';
import { isCapacitorNativeApp } from '@/utils/capacitorNative';

const LINKING_KEY = 'adgas_wallet_linking';

export function setWalletLinkingFlag(active: boolean): void {
  if (typeof sessionStorage === 'undefined') return;
  if (active) sessionStorage.setItem(LINKING_KEY, '1');
  else sessionStorage.removeItem(LINKING_KEY);
}

export function isWalletLinkingFlag(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(LINKING_KEY) === '1';
}

/**
 * Capacitor: MetaMask 복귀·WebView 재로드 후 지갑 세션을 빠르게 복구.
 */
export function CapacitorWalletBootstrap() {
  const { reconnect } = useReconnect();
  const { status } = useAccount();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        if (status === 'connected') {
          setWalletLinkingFlag(false);
          stopPoll();
          return;
        }
        reconnect();
        if (attempts >= 40) stopPoll();
      }, 500);
    };

    // MetaMask 복귀 직후·WebView 재로드 직후
    if (isWalletLinkingFlag()) {
      reconnect();
      startPoll();
    }

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!isWalletLinkingFlag() && status !== 'connecting') return;
      reconnect();
      startPoll();
    };

    document.addEventListener('visibilitychange', onVisible);

    let removeAppListener: (() => void) | undefined;
    void import('@capacitor/app')
      .then(({ App }) =>
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) onVisible();
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
  }, [reconnect, status]);

  useEffect(() => {
    if (status === 'connected') setWalletLinkingFlag(false);
  }, [status]);

  return null;
}
