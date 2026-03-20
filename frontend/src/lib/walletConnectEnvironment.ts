import type { Connector } from 'wagmi';
import { isCapacitorNativeApp } from '@/utils/capacitorNative';

const METAMASK_ID = 'metaMaskSDK';
const INJECTED_ID = 'injected';

/**
 * Capacitor WebView·모바일 브라우저 등 `window.ethereum` 주입이 없는 환경.
 */
export function isNonInjectedWalletContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (isCapacitorNativeApp()) return true;
  const eth = (window as typeof window & { ethereum?: unknown }).ethereum;
  if (eth != null) return false;
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/** 주입 불가 환경에서는 MetaMask SDK만 (Injected 제외) */
export function filterConnectorsForEnvironment(connectors: readonly Connector[]): readonly Connector[] {
  if (!isNonInjectedWalletContext()) return connectors;
  const mm = connectors.filter(c => c.id === METAMASK_ID);
  return mm.length > 0 ? mm : connectors;
}

/** MetaMask SDK → Injected */
export function orderConnectorsForEnvironment(connectors: readonly Connector[]): readonly Connector[] {
  const base = filterConnectorsForEnvironment(connectors);
  const mm = base.filter(c => c.id === METAMASK_ID);
  const inj = base.filter(c => c.id === INJECTED_ID);
  const rest = base.filter(c => c.id !== METAMASK_ID && c.id !== INJECTED_ID);
  return [...mm, ...inj, ...rest];
}
