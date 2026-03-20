import type { Connector } from 'wagmi';
import { isCapacitorNativeApp } from '@/utils/capacitorNative';

/**
 * Capacitor WebView·모바일 브라우저 등 `window.ethereum`이 없는 환경.
 * 이 경우 MetaMask/injected 커넥터는 동작하지 않고 WalletConnect만 사용 가능합니다.
 */
export function shouldUseWalletConnectOnly(): boolean {
  if (typeof window === 'undefined') return false;
  if (isCapacitorNativeApp()) return true;
  const eth = (window as typeof window & { ethereum?: unknown }).ethereum;
  if (eth != null) return false;
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/** 네이티브 앱·무주입 모바일: WalletConnect만 노출 (MetaMask 앱은 WC 경유) */
export function filterConnectorsForEnvironment(connectors: readonly Connector[]): readonly Connector[] {
  if (!shouldUseWalletConnectOnly()) return connectors;
  const wcOnly = connectors.filter(c => c.id === 'walletConnect');
  return wcOnly.length > 0 ? wcOnly : connectors;
}

/** 모바일 브라우저 등에서는 WalletConnect 버튼을 위로 (주입 지갑이 있으면 순서 유지) */
export function orderConnectorsForEnvironment(connectors: readonly Connector[]): readonly Connector[] {
  const base = filterConnectorsForEnvironment(connectors);
  if (shouldUseWalletConnectOnly()) return base;
  const wc = base.filter(c => c.id === 'walletConnect');
  const rest = base.filter(c => c.id !== 'walletConnect');
  return [...wc, ...rest];
}

export function isWalletConnectProjectConfigured(): boolean {
  const id = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  return Boolean(id && id !== 'demo-project-id');
}
