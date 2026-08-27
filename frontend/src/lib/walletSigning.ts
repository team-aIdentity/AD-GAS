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

let typedSignQueue: Promise<void> = Promise.resolve();
const typedSignInFlight = new Map<string, Promise<`0x${string}`>>();
let lastNativeTypedSignFinishedAt = 0;

// MetaMask Mobile은 서명 promise가 resolve된 뒤에도 잠깐 pending request를
// 유지할 수 있다. 다음 EIP-712 요청 전 충분한 정리 시간을 보장한다.
const NATIVE_TYPED_SIGN_COOLDOWN_MS = 1800;
const NATIVE_PENDING_RETRY_DELAYS_MS = [1800, 3000] as const;

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

function enqueueTypedSign<T>(task: () => Promise<T>): Promise<T> {
  const queued = typedSignQueue.then(task, task);
  typedSignQueue = queued.then(
    () => undefined,
    () => undefined
  );
  return queued;
}

function getTypedSignRequestKey(parameters: unknown): string {
  try {
    const value = parameters as Record<string, unknown>;
    return JSON.stringify(
      {
        account: String(value.account ?? '').toLowerCase(),
        domain: value.domain,
        types: value.types,
        primaryType: value.primaryType,
        message: value.message,
      },
      (_key, item: unknown) =>
        typeof item === 'bigint' ? `bigint:${item.toString()}` : item
    );
  } catch {
    // 직렬화할 수 없는 커스텀 typed data도 큐에는 포함하되 single-flight만 생략한다.
    return '';
  }
}

function isTypedSignAlreadyPending(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('eth_signtypeddata') &&
    (message.includes('already pending') ||
      (message.includes('requested resource not available') && message.includes('please wait')))
  );
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
  const requestKey = getTypedSignRequestKey(parameters);
  const existingRequest = requestKey ? typedSignInFlight.get(requestKey) : undefined;
  if (existingRequest) return existingRequest;

  const queuedRequest = enqueueTypedSign(async () => {
    const nativeApp = isCapacitorNativeApp();
    const chainId = resolveChainId(
      parameters.domain as { chainId?: number | bigint } | undefined
    );

    if (nativeApp && options?.immediateAfterWalletReturn) {
      await waitForNativeWalletReturn(8000);
    }

    if (nativeApp) {
      const cooldownRemaining =
        lastNativeTypedSignFinishedAt + NATIVE_TYPED_SIGN_COOLDOWN_MS - Date.now();
      if (cooldownRemaining > 0) await sleep(cooldownRemaining);
    }

    if (chainId != null) {
      await verifyWalletOnChain(chainId);
    }

    if (nativeApp) {
      setWalletLinkingFlag(true);
    }

    for (let attempt = 0; ; attempt += 1) {
      try {
        const signature = await wagmiSignTypedData(wagmiConfig, parameters);
        if (nativeApp) {
          // MetaMask에서 앱으로 돌아왔더라도 transport가 pending 상태를 해제하는 데
          // 시간이 더 필요하므로 복귀를 확인한 시점부터 다음 요청의 cooldown을 잰다.
          await waitForNativeWalletReturn(8000);
          lastNativeTypedSignFinishedAt = Date.now();
        }
        return signature;
      } catch (error) {
        const retryDelay = NATIVE_PENDING_RETRY_DELAYS_MS[attempt];
        if (!nativeApp || !isTypedSignAlreadyPending(error) || retryDelay === undefined) {
          if (nativeApp && isTypedSignAlreadyPending(error)) {
            throw new Error(
              'MetaMask에 이전 서명 요청이 남아 있습니다. MetaMask에서 기존 요청을 완료하거나 취소한 뒤 다시 시도해주세요.'
            );
          }
          throw error;
        }

        // 직전 요청의 앱 복귀 이벤트와 MetaMask SDK transport 정리를 기다린 뒤
        // 동일 요청을 제한적으로 재시도한다.
        await waitForNativeWalletReturn(8000);
        await sleep(retryDelay);
      }
    }
  });

  if (requestKey) {
    typedSignInFlight.set(requestKey, queuedRequest);
    void queuedRequest.then(
      () => {
        if (typedSignInFlight.get(requestKey) === queuedRequest) {
          typedSignInFlight.delete(requestKey);
        }
      },
      () => {
        if (typedSignInFlight.get(requestKey) === queuedRequest) {
          typedSignInFlight.delete(requestKey);
        }
      }
    );
  }

  return queuedRequest;
}
