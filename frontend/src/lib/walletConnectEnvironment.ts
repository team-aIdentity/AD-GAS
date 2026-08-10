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

/**
 * Capacitor: MetaMask SDK 딥링크만 사용한다.
 * 모바일 브라우저(무주입): MetaMask SDK.
 * 데스크톱: MetaMask SDK + Injected.
 */
export function getCapacitorPreferredConnector(
  connectors: readonly Connector[]
): Connector | undefined {
  if (!isCapacitorNativeApp()) return undefined;
  return connectors.find(c => c.id === METAMASK_ID);
}

export function filterConnectorsForEnvironment(connectors: readonly Connector[]): readonly Connector[] {
  if (isCapacitorNativeApp()) {
    const preferred = getCapacitorPreferredConnector(connectors);
    if (preferred) return [preferred];
    return connectors;
  }
  if (isNonInjectedWalletContext()) {
    const mm = connectors.filter(c => c.id === METAMASK_ID);
    return mm.length > 0 ? mm : connectors;
  }
  return connectors;
}

/** 순서: MetaMask SDK → Injected */
export function orderConnectorsForEnvironment(connectors: readonly Connector[]): readonly Connector[] {
  const base = filterConnectorsForEnvironment(connectors);
  const mm = base.filter(c => c.id === METAMASK_ID);
  const inj = base.filter(c => c.id === INJECTED_ID);
  const rest = base.filter(
    c => c.id !== METAMASK_ID && c.id !== INJECTED_ID
  );
  return [...mm, ...inj, ...rest];
}
