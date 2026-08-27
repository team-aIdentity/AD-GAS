import { signTypedData as wagmiSignTypedData, type SignTypedDataParameters } from '@wagmi/core';
import type { TypedData } from 'viem';
import { config as wagmiConfig } from '@/wagmi.config';
import { isCapacitorNativeApp } from '@/utils/capacitorNative';
import {
  armWalletSessionRecovery,
  setWalletLinkingFlag,
  setTxSigningInProgress,
} from '@/components/CapacitorWalletBootstrap';
import { type SupportedChainId, verifyWalletOnChain } from '@/lib/ensureWalletChain';

export function beginWalletTxSigning(): void {
  setTxSigningInProgress(true);
  setWalletLinkingFlag(true);
}

export function endWalletTxSigning(): void {
  setTxSigningInProgress(false);
  // 서명 결과가 돌아온 직후 MetaMask SDK가 일시적인 disconnect를 늦게
  // 전달할 수 있으므로 기존 승인 세션을 짧게 감시하고 자동 복원한다.
  armWalletSessionRecovery();
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
  const nativeApp = isCapacitorNativeApp();
  const chainId = resolveChainId(
    parameters.domain as { chainId?: number | bigint } | undefined
  );

  // 첫 Permit/Authorization 서명은 즉시 MetaMask에 전달한다. 직전 지갑 요청이
  // 있었던 Permit → Transfer/approve → Transfer 경로에만 transport 정리 시간을 둔다.
  if (nativeApp && options?.immediateAfterWalletReturn) {
    await waitForNativeWalletReturn(8000);
    await sleep(1800);
  }

  if (chainId != null) {
    await verifyWalletOnChain(chainId);
  }

  if (nativeApp) {
    setWalletLinkingFlag(true);
  }

  return wagmiSignTypedData(wagmiConfig, parameters);
}
