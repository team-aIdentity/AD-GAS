import { signTypedData as wagmiSignTypedData, type SignTypedDataParameters } from '@wagmi/core';
import type { TypedData } from 'viem';
import { config as wagmiConfig } from '@/wagmi.config';
import { isCapacitorNativeApp } from '@/utils/capacitorNative';
import {
  setWalletLinkingFlag,
  setTxSigningInProgress,
} from '@/components/CapacitorWalletBootstrap';
import { ensureWalletOnChain, type SupportedChainId } from '@/lib/ensureWalletChain';

export function beginWalletTxSigning(): void {
  setTxSigningInProgress(true);
  setWalletLinkingFlag(true);
}

export function endWalletTxSigning(): void {
  setTxSigningInProgress(false);
  setWalletLinkingFlag(false);
}

/** MetaMask 복귀 직후 다음 서명 딥링크가 바로 열리도록 1~2 프레임만 양보 */
function yieldToMain(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function resolveChainId(domain?: { chainId?: number | bigint }): SupportedChainId | undefined {
  const fromDomain = domain?.chainId;
  if (typeof fromDomain === 'number') return fromDomain as SupportedChainId;
  if (typeof fromDomain === 'bigint') return Number(fromDomain) as SupportedChainId;
  return undefined;
}

/**
 * Permit → Transfer 등 연속 EIP-712 서명.
 * Capacitor: 직전 MetaMask 복귀 직후 즉시 다음 signTypedData 호출.
 */
export async function signTypedDataForTx<
  const typedData extends TypedData | Record<string, unknown>,
  primaryType extends keyof typedData | 'EIP712Domain',
>(
  parameters: SignTypedDataParameters<typedData, primaryType>,
  options?: { immediateAfterWalletReturn?: boolean }
): Promise<`0x${string}`> {
  const chainId = resolveChainId(
    parameters.domain as { chainId?: number | bigint } | undefined
  );
  if (chainId != null) {
    await ensureWalletOnChain(chainId);
  }

  if (isCapacitorNativeApp()) {
    setWalletLinkingFlag(true);
    if (options?.immediateAfterWalletReturn) {
      await yieldToMain();
    }
  }

  return wagmiSignTypedData(wagmiConfig, parameters);
}
