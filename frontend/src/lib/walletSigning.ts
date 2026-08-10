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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

/** 이전 지갑 요청에서 앱으로 돌아온 뒤 WebView와 MetaMask SDK 채널이 복구될 때까지 대기 */
async function waitForNativeWalletReturn(maxMs = 5000): Promise<void> {
  try {
    const { App } = await import('@capacitor/app');
    const state = await App.getState();
    if (!state.isActive) {
      await new Promise<void>(resolve => {
        let listener: { remove: () => Promise<void> } | undefined;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          void listener?.remove();
          resolve();
        };
        const timer = window.setTimeout(finish, maxMs);
        void App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) finish();
        }).then(handle => {
          listener = handle;
          if (settled) void handle.remove();
        });
      });
    }
    await sleep(700);
  } catch {
    await sleep(900);
  }
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

  if (isCapacitorNativeApp() && options?.immediateAfterWalletReturn) {
    await waitForNativeWalletReturn();
  }

  if (chainId != null) {
    await ensureWalletOnChain(chainId);
  }

  if (isCapacitorNativeApp()) {
    setWalletLinkingFlag(true);
  }

  return wagmiSignTypedData(wagmiConfig, parameters);
}
