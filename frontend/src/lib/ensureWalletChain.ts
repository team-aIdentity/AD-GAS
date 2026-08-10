import { getAccount, switchChain } from '@wagmi/core';
import { avalanche, base, bsc } from 'wagmi/chains';
import { config } from '@/wagmi.config';
import { isCapacitorNativeApp } from '@/utils/capacitorNative';
import { setWalletLinkingFlag } from '@/components/CapacitorWalletBootstrap';
import { giwaSepolia } from '@/lib/chains/giwaSepolia';

export type SupportedChainId = 8453 | 91342 | 43114 | 56;

function withTimeout<T>(promise: Promise<T>, maxMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), maxMs);
    promise.then(
      value => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      error => {
        window.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

type Eip1193Provider = {
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: 'chainChanged', listener: (chainId: string) => void) => void;
  removeListener?: (event: 'chainChanged', listener: (chainId: string) => void) => void;
};

type CachedProvider = {
  connectorUid: string;
  provider: Eip1193Provider;
  chainChangedListener?: (chainId: string) => void;
};

type VerifiedChain = {
  connectorUid: string;
  chainId: number;
};

let cachedProvider: CachedProvider | null = null;
let verifiedChain: VerifiedChain | null = null;

export function clearWalletChainCache(): void {
  if (cachedProvider?.chainChangedListener) {
    cachedProvider.provider.removeListener?.(
      'chainChanged',
      cachedProvider.chainChangedListener
    );
  }
  cachedProvider = null;
  verifiedChain = null;
}

function markWalletChainVerified(targetChainId: SupportedChainId): void {
  const connectorUid = getAccount(config).connector?.uid;
  if (!connectorUid) return;
  verifiedChain = { connectorUid, chainId: targetChainId };
}

const CHAIN_PARAMS: Record<
  SupportedChainId,
  {
    chainId: `0x${string}`;
    chainName: string;
    nativeCurrency: { name: string; symbol: string; decimals: 18 };
    rpcUrls: string[];
    blockExplorerUrls: string[];
  }
> = {
  [base.id]: {
    chainId: '0x2105',
    chainName: base.name,
    nativeCurrency: base.nativeCurrency,
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org'],
  },
  [avalanche.id]: {
    chainId: '0xa86a',
    chainName: avalanche.name,
    nativeCurrency: avalanche.nativeCurrency,
    rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
    blockExplorerUrls: ['https://snowtrace.io'],
  },
  [bsc.id]: {
    chainId: '0x38',
    chainName: bsc.name,
    nativeCurrency: bsc.nativeCurrency,
    rpcUrls: ['https://bsc-dataseed.binance.org'],
    blockExplorerUrls: ['https://bscscan.com'],
  },
  [giwaSepolia.id]: {
    chainId: '0x164ce',
    chainName: giwaSepolia.name,
    nativeCurrency: giwaSepolia.nativeCurrency,
    rpcUrls: ['https://sepolia-rpc.giwa.io'],
    blockExplorerUrls: ['https://sepolia-explorer.giwa.io'],
  },
};

async function getConnectedProvider(): Promise<Eip1193Provider | null> {
  const { connector } = getAccount(config);
  if (!connector) return null;

  if (cachedProvider?.connectorUid === connector.uid) {
    return cachedProvider.provider;
  }

  try {
    const provider = await withTimeout(
      connector.getProvider(),
      5000,
      '지갑 연결 응답이 지연되고 있습니다. 지갑을 다시 연결해주세요.'
    );
    if (!provider || typeof provider !== 'object') return null;
    const connectedProvider = provider as Eip1193Provider;
    if (cachedProvider?.chainChangedListener) {
      cachedProvider.provider.removeListener?.(
        'chainChanged',
        cachedProvider.chainChangedListener
      );
    }
    const chainChangedListener = (hexChainId: string) => {
      const nextChainId = Number.parseInt(hexChainId, 16);
      if (!Number.isFinite(nextChainId)) return;
      verifiedChain = {
        connectorUid: connector.uid,
        chainId: nextChainId,
      };
    };
    const registeredChainListener = connectedProvider.on
      ? chainChangedListener
      : undefined;
    connectedProvider.on?.('chainChanged', chainChangedListener);
    cachedProvider = {
      connectorUid: connector.uid,
      provider: connectedProvider,
      chainChangedListener: registeredChainListener,
    };
    return connectedProvider;
  } catch {
    return null;
  }
}

/** provider 확인값 또는 Wagmi 연결 상태가 target과 같으면 즉시 통과한다. */
export function isWalletKnownOnChain(targetChainId: SupportedChainId): boolean {
  const account = getAccount(config);
  const connectorUid = account.connector?.uid;
  if (!connectorUid) return false;

  if (
    verifiedChain?.connectorUid === connectorUid &&
    verifiedChain.chainId === targetChainId
  ) {
    // 이벤트 구독이 가능한 provider는 수동 체인 변경 시 verifiedChain을 갱신한다.
    // 이벤트가 없는 fallback connector는 Wagmi의 현재 chainId도 함께 확인한다.
    const observesChainChanges =
      cachedProvider?.connectorUid === connectorUid &&
      cachedProvider.chainChangedListener != null;
    if (observesChainChanges) return true;
  }

  return account.status === 'connected' && account.chainId === targetChainId;
}

/** MetaMask provider의 실제 eth_chainId (wagmi 캐시와 다를 수 있음) */
export async function readProviderChainId(): Promise<number | null> {
  try {
    const provider = await getConnectedProvider();
    const request = provider?.request;
    if (!request) return null;

    const hex = await withTimeout(
      request({ method: 'eth_chainId' }),
      5000,
      '지갑 네트워크 확인 시간이 초과되었습니다.'
    );
    const chainId = typeof hex === 'string' ? Number.parseInt(hex, 16) : null;
    const connectorUid = getAccount(config).connector?.uid;
    if (chainId != null && connectorUid) {
      verifiedChain = { connectorUid, chainId };
    }
    return chainId;
  } catch {
    return null;
  }
}

/**
 * 전송·서명 단계용: 실제 체인을 확인만 하고 전환 요청은 절대 보내지 않는다.
 * 네트워크 전환은 사용자가 네트워크 카드를 선택한 시점에만 수행한다.
 */
export async function verifyWalletOnChain(
  targetChainId: SupportedChainId
): Promise<void> {
  if (isWalletKnownOnChain(targetChainId)) return;

  const current = await readProviderChainId();
  if (current === targetChainId) return;

  const targetName = CHAIN_PARAMS[targetChainId].chainName;
  throw new Error(
    current == null
      ? `${targetName} 네트워크 상태를 확인하지 못했습니다. 네트워크를 다시 선택해주세요.`
      : `현재 지갑 네트워크가 ${targetName}이(가) 아닙니다. 네트워크를 다시 선택해주세요.`
  );
}

export function getWalletErrorCode(err: unknown): number | undefined {
  const error = err as {
    code?: number | string;
    cause?: { code?: number | string };
    data?: { originalError?: { code?: number | string } };
  };
  const code = error.code ?? error.cause?.code ?? error.data?.originalError?.code;
  if (typeof code === 'number') return code;
  if (typeof code === 'string' && code.trim() !== '') {
    const parsed = Number(code);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function isWalletSwitchRejectedError(err: unknown): boolean {
  if (getWalletErrorCode(err) === 4001) return true;
  const message =
    (err as { shortMessage?: string })?.shortMessage ??
    (err as Error)?.message ??
    '';
  return /user rejected|user denied|request rejected|사용자.*거절|요청.*거절/i.test(message);
}

async function switchWithProvider(targetChainId: SupportedChainId): Promise<void> {
  const provider = await getConnectedProvider();
  const request = provider?.request;
  if (!request) {
    await withTimeout(
      switchChain(config, { chainId: targetChainId }),
      20000,
      `${CHAIN_PARAMS[targetChainId].chainName} 네트워크 전환 요청 시간이 초과되었습니다. 지갑 확장 프로그램을 다시 연결해주세요.`
    );
    markWalletChainVerified(targetChainId);
    return;
  }

  const chain = CHAIN_PARAMS[targetChainId];
  try {
    await withTimeout(
      request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chain.chainId }],
      }),
      20000,
      `${chain.chainName} 네트워크 전환 요청 시간이 초과되었습니다. MetaMask를 열어 요청을 확인해주세요.`
    );
    markWalletChainVerified(targetChainId);
  } catch (err) {
    if (getWalletErrorCode(err) !== 4902) throw err;

    await withTimeout(
      request({
        method: 'wallet_addEthereumChain',
        params: [chain],
      }),
      20000,
      `${chain.chainName} 네트워크 추가 요청 시간이 초과되었습니다. MetaMask를 열어 요청을 확인해주세요.`
    );
    await withTimeout(
      request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chain.chainId }],
      }),
      20000,
      `${chain.chainName} 네트워크 전환 요청 시간이 초과되었습니다. MetaMask를 열어 요청을 확인해주세요.`
    );
    markWalletChainVerified(targetChainId);
  }
}

/**
 * 네트워크 카드 선택·최초 지갑 연결 시에만 wallet_switchEthereumChain 요청.
 * 전송·서명 단계에서는 verifyWalletOnChain을 사용해 중복 전환을 금지한다.
 */
export async function ensureWalletOnChain(targetChainId: SupportedChainId): Promise<void> {
  if (isWalletKnownOnChain(targetChainId)) return;

  // Wagmi가 현재 체인을 이미 알고 있으면 별도의 eth_chainId 왕복 없이 바로
  // 전환 요청한다. MetaMask SDK가 응답하지 않을 때 생기던 선행 5초 대기를 없앤다.
  const accountChainId = getAccount(config).chainId;
  if (accountChainId == null) {
    const current = await readProviderChainId();
    if (current === targetChainId) return;
  }

  const useLinking = isCapacitorNativeApp();
  if (useLinking) setWalletLinkingFlag(true);

  try {
    await switchWithProvider(targetChainId);
  } catch (err) {
    const msg =
      (err as { shortMessage?: string })?.shortMessage ??
      (err as Error)?.message ??
      '네트워크 전환에 실패했습니다.';
    const wrapped = new Error(msg) as Error & { code?: number };
    wrapped.code = getWalletErrorCode(err);
    throw wrapped;
  }

  // EIP-1193 전환 요청이 resolve됐다는 것은 지갑이 전환을 승인했다는 뜻이다.
  // MetaMask SDK는 앱 복귀 직후 eth_chainId/chainChanged 반영이 늦을 수 있으므로,
  // 여기서 다시 polling하며 성공한 전환을 실패로 되돌리지 않는다.
  markWalletChainVerified(targetChainId);
}
