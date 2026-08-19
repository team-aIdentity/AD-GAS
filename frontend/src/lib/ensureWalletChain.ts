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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

type Eip1193Provider = {
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
  verifiedAt: number;
};

let cachedProvider: CachedProvider | null = null;
let verifiedChain: VerifiedChain | null = null;
let switchInFlight: {
  targetChainId: SupportedChainId;
  requestId: symbol;
  promise: Promise<void>;
} | null = null;

const VERIFIED_CHAIN_TTL_MS = 1500;
const FAST_CHAIN_CHECK_MS = 2500;
const SWITCH_REQUEST_TIMEOUT_MS = 40000;
const SWITCH_CONFIRM_TIMEOUT_MS = 12000;
const SWITCH_CHAIN_POLL_MS = 400;

const CHAIN_NAMES: Record<SupportedChainId, string> = {
  [base.id]: base.name,
  [avalanche.id]: avalanche.name,
  [bsc.id]: bsc.name,
  [giwaSepolia.id]: giwaSepolia.name,
};

export function clearWalletChainCache(): void {
  if (cachedProvider?.chainChangedListener) {
    cachedProvider.provider.removeListener?.(
      'chainChanged',
      cachedProvider.chainChangedListener
    );
  }
  cachedProvider = null;
  verifiedChain = null;
  switchInFlight = null;
}

function normalizeChainId(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number.parseInt(value, value.startsWith('0x') ? 16 : 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getConnectedProvider(maxMs = 5000): Promise<Eip1193Provider | null> {
  const { connector } = getAccount(config);
  if (!connector) return null;

  if (cachedProvider?.connectorUid === connector.uid) {
    return cachedProvider.provider;
  }

  try {
    const provider = await withTimeout(
      connector.getProvider(),
      maxMs,
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
      const nextChainId = normalizeChainId(hexChainId);
      if (nextChainId == null) return;
      verifiedChain = {
        connectorUid: connector.uid,
        chainId: nextChainId,
        verifiedAt: Date.now(),
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

/** MetaMask Connect가 유지하는 현재 세션의 선택 체인을 확인한다. */
export async function readProviderChainId(maxMs = 5000): Promise<number | null> {
  try {
    const { connector } = getAccount(config);
    if (!connector) return null;

    // chainChanged listener를 등록한 뒤 Connect 클라이언트의 selectedChainId를
    // 읽는다. 구 SDK의 캐시 기반 eth_chainId와 달리 switchChain 시 즉시 갱신된다.
    await getConnectedProvider(maxMs);
    const value = await withTimeout(
      connector.getChainId(),
      maxMs,
      '지갑 네트워크 확인 시간이 초과되었습니다.'
    );
    const chainId = normalizeChainId(value);
    if (chainId != null) {
      verifiedChain = {
        connectorUid: connector.uid,
        chainId,
        verifiedAt: Date.now(),
      };
    }
    return chainId;
  } catch {
    return null;
  }
}

export function isWalletKnownOnChain(targetChainId: SupportedChainId): boolean {
  const account = getAccount(config);
  const connectorUid = account.connector?.uid;
  if (!connectorUid) return false;

  if (
    verifiedChain?.connectorUid === connectorUid &&
    Date.now() - verifiedChain.verifiedAt <= VERIFIED_CHAIN_TTL_MS
  ) {
    return verifiedChain.chainId === targetChainId;
  }

  return account.status === 'connected' && account.chainId === targetChainId;
}

/** 전송·서명 직전에 MetaMask Connect 세션 체인을 다시 확인한다. */
export async function verifyWalletOnChain(
  targetChainId: SupportedChainId
): Promise<void> {
  const current = await readProviderChainId(5000);
  if (current === targetChainId) return;

  const targetName = CHAIN_NAMES[targetChainId];
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

async function waitForActualWalletChain(
  targetChainId: SupportedChainId,
  maxMs: number,
  message: string
): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const current = await readProviderChainId(
      Math.max(500, Math.min(2000, remaining))
    );
    if (current === targetChainId) return;
    await sleep(SWITCH_CHAIN_POLL_MS);
  }
  throw new Error(message);
}

async function switchWithConnector(targetChainId: SupportedChainId): Promise<void> {
  const targetName = CHAIN_NAMES[targetChainId];
  const timeoutMessage = `${targetName} 네트워크 전환 요청 시간이 초과되었습니다. MetaMask를 열어 요청을 확인해주세요.`;

  await withTimeout(
    switchChain(config, { chainId: targetChainId }),
    SWITCH_REQUEST_TIMEOUT_MS,
    timeoutMessage
  );

  // MetaMask Connect는 switchChain 결과를 selectedChainId와 Wagmi에 즉시
  // 반영한다. Android에서 chainChanged가 유실돼도 이 확인값은 갱신된다.
  await waitForActualWalletChain(
    targetChainId,
    SWITCH_CONFIRM_TIMEOUT_MS,
    timeoutMessage
  );
}

async function performWalletChainSwitch(
  targetChainId: SupportedChainId
): Promise<void> {
  const current = await readProviderChainId(FAST_CHAIN_CHECK_MS);
  if (current === targetChainId) return;

  if (isCapacitorNativeApp()) setWalletLinkingFlag(true);

  try {
    await switchWithConnector(targetChainId);
  } catch (err) {
    const message =
      (err as { shortMessage?: string })?.shortMessage ??
      (err as Error)?.message ??
      '네트워크 전환에 실패했습니다.';
    const wrapped = new Error(message) as Error & { code?: number };
    wrapped.code = getWalletErrorCode(err);
    throw wrapped;
  }
}

export function ensureWalletOnChain(
  targetChainId: SupportedChainId
): Promise<void> {
  if (!isCapacitorNativeApp() && isWalletKnownOnChain(targetChainId)) {
    return Promise.resolve();
  }
  if (switchInFlight) {
    if (switchInFlight.targetChainId === targetChainId) {
      return switchInFlight.promise;
    }
    return switchInFlight.promise
      .catch(() => undefined)
      .then(() => ensureWalletOnChain(targetChainId));
  }

  const requestId = Symbol('wallet-chain-switch');
  const promise = performWalletChainSwitch(targetChainId).finally(() => {
    if (switchInFlight?.requestId === requestId) switchInFlight = null;
  });
  switchInFlight = { targetChainId, requestId, promise };
  return promise;
}
