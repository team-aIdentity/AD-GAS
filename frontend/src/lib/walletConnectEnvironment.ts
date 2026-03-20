import type { Connector } from 'wagmi';
import { isCapacitorNativeApp } from '@/utils/capacitorNative';

const METAMASK_ID = 'metaMaskSDK';
const WALLETCONNECT_ID = 'walletConnect';
const INJECTED_ID = 'injected';

/**
 * Capacitor WebView·모바일 브라우저 등 `window.ethereum` 주입이 없는 환경.
 * 여기서는 MetaMask SDK 딥링크(앱 실행) + WalletConnect(보조)만 의미가 있습니다.
 */
export function isNonInjectedWalletContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (isCapacitorNativeApp()) return true;
  const eth = (window as typeof window & { ethereum?: unknown }).ethereum;
  if (eth != null) return false;
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/** 주입 불가 환경에서는 Injected 제거 (동작하지 않음) */
export function filterConnectorsForEnvironment(connectors: readonly Connector[]): readonly Connector[] {
  if (!isNonInjectedWalletContext()) return connectors;
  const allowed = new Set([METAMASK_ID, WALLETCONNECT_ID]);
  const filtered = connectors.filter(c => allowed.has(c.id));
  return filtered.length > 0 ? filtered : connectors;
}

/**
 * MetaMask(앱 딥링크) → WalletConnect → Injected 순 (주입 가능한 데스크톱은 MetaMask → Injected → WC)
 */
export function orderConnectorsForEnvironment(connectors: readonly Connector[]): readonly Connector[] {
  const base = filterConnectorsForEnvironment(connectors);
  const mm = base.filter(c => c.id === METAMASK_ID);
  const wc = base.filter(c => c.id === WALLETCONNECT_ID);
  const inj = base.filter(c => c.id === INJECTED_ID);
  const other = base.filter(
    c => c.id !== METAMASK_ID && c.id !== WALLETCONNECT_ID && c.id !== INJECTED_ID
  );
  if (isNonInjectedWalletContext()) {
    return [...mm, ...wc, ...other];
  }
  return [...mm, ...inj, ...wc, ...other];
}

export function isWalletConnectProjectConfigured(): boolean {
  const id = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  return Boolean(id && id !== 'demo-project-id');
}
