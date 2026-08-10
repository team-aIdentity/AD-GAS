import type { Connector } from 'wagmi';
import { isCapacitorNativeApp } from '@/utils/capacitorNative';

const METAMASK_ID = 'metaMaskSDK';
const INJECTED_ID = 'injected';
const METAMASK_SDK_STORAGE_KEYS = [
  '.sdk-comm',
  '.MMSDK_cached_address',
  '.MMSDK_cached_chainId',
  'providerType',
] as const;

function finishAfter(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

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

/**
 * 이전 연결 시도에서 남은 MetaMask SDK 소켓·암호화 채널을 정리한다.
 * wagmi reset()은 mutation 상태만 초기화하므로 SDK terminate()와 저장소 정리가 별도로 필요하다.
 */
export async function resetCapacitorMetaMaskSession(connector: Connector): Promise<void> {
  if (!isCapacitorNativeApp() || connector.id !== METAMASK_ID) return;

  try {
    await Promise.race([connector.disconnect(), finishAfter(2000)]);
  } catch {
    // 연결되지 않았거나 이미 만료된 세션도 아래 저장소 정리는 계속한다.
  }

  try {
    for (const key of METAMASK_SDK_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // WebView 저장소 접근 실패는 새 연결 시도를 막지 않는다.
  }
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
