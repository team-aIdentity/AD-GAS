import {
  getAccount,
  getConnectorClient,
  getPublicClient,
  reconnect,
} from '@wagmi/core';
import {
  createWalletClient,
  custom,
  type Address,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { config } from '@/wagmi.config';
import { getCapacitorPreferredConnector } from '@/lib/walletConnectEnvironment';
import { isCapacitorNativeApp } from '@/utils/capacitorNative';

type SupportedChainId = 8453 | 91342 | 43114 | 56;

type EnsureParams = {
  chainId: SupportedChainId;
  /** React hook 주소 — getAccount와 일시적으로 어긋날 때 폴백 */
  expectedAddress?: Address;
  maxAttempts?: number;
  intervalMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** AdMob 전면 광고 종료 후 WebView·앱 포그라운드가 안정될 때까지만 짧게 대기 */
async function waitForNativeAppActive(maxMs = 2500): Promise<void> {
  if (!isCapacitorNativeApp()) return;

  try {
    const { App } = await import('@capacitor/app');
    const state = await App.getState();
    if (!state.isActive) {
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, maxMs);
        void App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
    }
    await sleep(150);
  } catch {
    await sleep(250);
  }
}

async function reconnectCurrentConnector(): Promise<void> {
  const currentUid = config.state.current;
  if (!currentUid) return;
  const connection = config.state.connections.get(currentUid);
  if (!connection) return;
  try {
    await connection.connector.connect({ isReconnecting: true });
  } catch {
    /* ignore */
  }
}

async function restoreWalletSession(): Promise<Address | undefined> {
  const existing = getAccount(config);
  if (existing.address) return existing.address;

  try {
    await reconnect(config);
  } catch {
    /* ignore */
  }

  await reconnectCurrentConnector();

  const account = getAccount(config);
  return account.address;
}

async function tryBuildClients(
  chainId: SupportedChainId,
  accountAddress: Address
): Promise<{ walletClient: WalletClient; publicClient: PublicClient } | null> {
  const publicClient = getPublicClient(config, { chainId });
  if (!publicClient) return null;

  // chainId 강제 없이 — connector 실제 체인 기준 (불일치 시 silent fail 방지)
  try {
    const client = await getConnectorClient(config, { account: accountAddress });
    const resolvedChainId = (client.chain?.id ?? chainId) as SupportedChainId;
    const pc = getPublicClient(config, { chainId: resolvedChainId });
    if (pc) {
      return {
        walletClient: client as unknown as WalletClient,
        publicClient: pc as unknown as PublicClient,
      };
    }
  } catch {
    /* fall through */
  }

  try {
    const client = await getConnectorClient(config, { chainId, account: accountAddress });
    return {
      walletClient: client as unknown as WalletClient,
      publicClient: publicClient as unknown as PublicClient,
    };
  } catch {
    /* fall through */
  }

  const currentUid = config.state.current;
  if (!currentUid) return null;
  const connection = config.state.connections.get(currentUid);
  if (!connection) return null;

  try {
    const provider = await connection.connector.getProvider({ chainId });
    const chain = config.chains.find(c => c.id === chainId);
    if (!provider || !chain) return null;

    const walletClient = createWalletClient({
      account: accountAddress,
      chain,
      transport: custom(provider as Parameters<typeof custom>[0]),
    });
    return { walletClient, publicClient: publicClient as unknown as PublicClient };
  } catch {
    /* fall through */
  }

  const preferred = getCapacitorPreferredConnector(config.connectors);
  if (!preferred) return null;

  try {
    const provider = await preferred.getProvider({ chainId });
    const chain = config.chains.find(c => c.id === chainId);
    if (!provider || !chain) return null;

    const walletClient = createWalletClient({
      account: accountAddress,
      chain,
      transport: custom(provider as Parameters<typeof custom>[0]),
    });
    return { walletClient, publicClient: publicClient as unknown as PublicClient };
  } catch {
    return null;
  }
}

/**
 * AdMob·MetaMask 복귀 직후 useWalletClient()가 비는 경우가 있어,
 * reconnect → connector 재연결 → getConnectorClient 폴링으로 서명 클라이언트를 확보합니다.
 */
export async function ensureWagmiClients({
  chainId,
  expectedAddress,
  maxAttempts = 10,
  intervalMs = 250,
}: EnsureParams): Promise<{ walletClient: WalletClient; publicClient: PublicClient } | null> {
  await waitForNativeAppActive();

  const initialAccount = getAccount(config);
  const initialAddress = initialAccount.address ?? expectedAddress;
  if (initialAddress) {
    const clients = await tryBuildClients(chainId, initialAddress);
    if (clients) return clients;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await sleep(intervalMs);
    }

    const restoredAddress = await restoreWalletSession();
    const accountAddress = restoredAddress ?? expectedAddress;
    if (!accountAddress) continue;

    const clients = await tryBuildClients(chainId, accountAddress);
    if (clients) return clients;
  }

  return null;
}
