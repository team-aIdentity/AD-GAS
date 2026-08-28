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
  // 완료 모달을 닫은 뒤에도 연결 주소와 승인 세션을 유지한다.
  // MetaMask의 지연된 disconnect 이벤트도 충분히 길게 감시한다.
  armWalletSessionRecovery(60_000);
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
    // 1.0.25에서 연속 서명이 안정적으로 열리던 복귀 안정화 시간.
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

  if (nativeApp && options?.immediateAfterWalletReturn) {
    await waitForNativeWalletReturn(8000);
  }

  // 첫 Permit 요청 전에만 현재 체인을 확인한다. Permit 직후에는 같은 전송의
  // 두 번째 서명을 즉시 열어야 하므로 중간 RPC/체인 확인을 삽입하지 않는다.
  if (chainId != null && !options?.immediateAfterWalletReturn) {
    await verifyWalletOnChain(chainId);
  }

  if (nativeApp) setWalletLinkingFlag(true);
  return wagmiSignTypedData(wagmiConfig, parameters);
}
