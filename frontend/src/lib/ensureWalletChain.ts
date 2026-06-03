import { getAccount, switchChain } from '@wagmi/core';
import { config } from '@/wagmi.config';
import { isCapacitorNativeApp } from '@/utils/capacitorNative';
import { setWalletLinkingFlag } from '@/components/CapacitorWalletBootstrap';

export type SupportedChainId = 8453 | 91342 | 43114 | 56;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** MetaMask provider의 실제 eth_chainId (wagmi 캐시와 다를 수 있음) */
export async function readProviderChainId(): Promise<number | null> {
  try {
    const { connector } = getAccount(config);
    if (!connector) return null;

    const provider = await connector.getProvider();
    if (!provider || typeof provider !== 'object') return null;

    const request = (provider as { request?: (args: { method: string }) => Promise<string> })
      .request;
    if (!request) return null;

    const hex = await request({ method: 'eth_chainId' });
    return Number.parseInt(hex, 16);
  } catch {
    return null;
  }
}

async function waitForProviderChain(
  targetChainId: SupportedChainId,
  maxMs = 20000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const current = await readProviderChainId();
    if (current === targetChainId) return true;
    await sleep(400);
  }
  return false;
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
    await switchChain(config, { chainId: targetChainId });
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
    throw new Error(
      after != null
        ? `지갑 네트워크를 Base(8453) 등 지원 체인으로 전환해주세요. (현재 chainId: ${after})`
        : '지갑 네트워크 전환을 확인할 수 없습니다. MetaMask에서 Base 메인넷을 선택해주세요.'
    );
  }
}
