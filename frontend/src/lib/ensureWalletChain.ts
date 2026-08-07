import { getAccount, switchChain } from '@wagmi/core';
import { avalanche, base, bsc } from 'wagmi/chains';
import { config } from '@/wagmi.config';
import { isCapacitorNativeApp } from '@/utils/capacitorNative';
import { setWalletLinkingFlag } from '@/components/CapacitorWalletBootstrap';
import { giwaSepolia } from '@/lib/chains/giwaSepolia';

export type SupportedChainId = 8453 | 91342 | 43114 | 56;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

  try {
    const provider = await withTimeout(
      connector.getProvider(),
      5000,
      '지갑 연결 응답이 지연되고 있습니다. 지갑을 다시 연결해주세요.'
    );
    if (!provider || typeof provider !== 'object') return null;
    return provider as Eip1193Provider;
  } catch {
    return null;
  }
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
    return typeof hex === 'string' ? Number.parseInt(hex, 16) : null;
  } catch {
    return null;
  }
}

async function waitForProviderChain(
  targetChainId: SupportedChainId,
  maxMs = 12000
): Promise<boolean> {
  const provider = await getConnectedProvider();
  const targetHex = CHAIN_PARAMS[targetChainId].chainId.toLowerCase();
  let chainChanged = false;

  const listener = (hex: string) => {
    if (hex.toLowerCase() === targetHex) chainChanged = true;
  };

  provider?.on?.('chainChanged', listener);
  const start = Date.now();
  try {
    while (Date.now() - start < maxMs) {
      if (chainChanged) return true;
      const current = await readProviderChainId();
      if (current === targetChainId) return true;
      await sleep(250);
    }
    return false;
  } finally {
    provider?.removeListener?.('chainChanged', listener);
  }
}

function getWalletErrorCode(err: unknown): number | undefined {
  const error = err as { code?: number; cause?: { code?: number }; data?: { originalError?: { code?: number } } };
  return error.code ?? error.cause?.code ?? error.data?.originalError?.code;
}

async function switchWithProvider(targetChainId: SupportedChainId): Promise<void> {
  const provider = await getConnectedProvider();
  const request = provider?.request;
  if (!request) {
    await switchChain(config, { chainId: targetChainId });
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
  }
}

/**
 * 지갑 provider 체인이 target과 다르면 wallet_switchEthereumChain 요청.
 * MetaMask가 Base Sepolia(84532) 등 다른 체인에 있을 때 서명 전에 호출.
 */
export async function ensureWalletOnChain(targetChainId: SupportedChainId): Promise<void> {
  const current = await readProviderChainId();
  if (current === targetChainId) return;

  const useLinking = isCapacitorNativeApp();
  if (useLinking) setWalletLinkingFlag(true);

  try {
    await switchWithProvider(targetChainId);
  } catch (err) {
    const msg =
      (err as { shortMessage?: string })?.shortMessage ??
      (err as Error)?.message ??
      '네트워크 전환에 실패했습니다.';
    throw new Error(msg);
  }

  const matched = await waitForProviderChain(targetChainId);
  if (!matched) {
    const after = await readProviderChainId();
    const targetName = CHAIN_PARAMS[targetChainId].chainName;
    throw new Error(
      after != null
        ? `MetaMask에서 ${targetName} 네트워크 전환을 승인해주세요. (현재 chainId: ${after})`
        : `MetaMask에서 ${targetName} 네트워크 전환을 승인해주세요.`
    );
  }
}
