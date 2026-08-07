import type { Connector } from 'wagmi';
import { isCapacitorNativeApp } from '@/utils/capacitorNative';

const METAMASK_ID = 'metaMaskSDK';
const INJECTED_ID = 'injected';
const WC_ID = 'walletConnect';

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

export function isWalletConnectProjectConfigured(): boolean {
  const id = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  return Boolean(id && id !== 'demo-project-id');
}

/**
 * Capacitor: WalletConnect 우선. MetaMask SDK 세션은 앱 복귀 시 최초 체인으로
 * 되돌아가는 경우가 있어, 멀티체인 전환은 WalletConnect 세션이 더 안정적이다.
 * WalletConnect 설정이 없을 때만 MetaMask SDK를 폴백으로 사용한다.
 * 모바일 브라우저(무주입): WC → MetaMask SDK.
 * 데스크톱: WalletConnect 숨김, MetaMask SDK + Injected.
 */
export function getCapacitorPreferredConnector(
  connectors: readonly Connector[]
): Connector | undefined {
  if (!isCapacitorNativeApp()) return undefined;
  if (isWalletConnectProjectConfigured()) {
    const wc = connectors.find(c => c.id === WC_ID);
    if (wc) return wc;
  }
  return connectors.find(c => c.id === METAMASK_ID);
}

export function filterConnectorsForEnvironment(connectors: readonly Connector[]): readonly Connector[] {
  if (isCapacitorNativeApp()) {
    const preferred = getCapacitorPreferredConnector(connectors);
    if (preferred) return [preferred];
    return connectors;
  }
  if (isNonInjectedWalletContext()) {
    const wc = connectors.filter(c => c.id === WC_ID);
    const mm = connectors.filter(c => c.id === METAMASK_ID);
    const out = [...wc, ...mm];
    return out.length > 0 ? out : connectors;
  }
  return connectors.filter(c => c.id !== WC_ID);
}

/** 순서: WalletConnect → MetaMask SDK → Injected */
export function orderConnectorsForEnvironment(connectors: readonly Connector[]): readonly Connector[] {
  const base = filterConnectorsForEnvironment(connectors);
  const wc = base.filter(c => c.id === WC_ID);
  const mm = base.filter(c => c.id === METAMASK_ID);
  const inj = base.filter(c => c.id === INJECTED_ID);
  const rest = base.filter(
    c => c.id !== WC_ID && c.id !== METAMASK_ID && c.id !== INJECTED_ID
  );
  return [...wc, ...mm, ...inj, ...rest];
}
