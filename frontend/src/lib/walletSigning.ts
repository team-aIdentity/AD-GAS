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

// MetaMask Mobile은 EIP-712 응답을 반환한 직후에도 동일 origin의 요청을
// 잠깐 pending으로 유지한다. 첫 서명은 지연하지 않고, 연속 서명 사이에만
// 짧은 정리 시간을 둔다.
const NATIVE_TYPED_SIGN_COOLDOWN_MS = 1200;
const NATIVE_PENDING_RETRY_DELAYS_MS = [1400, 2500] as const;
const NATIVE_TRANSPORT_RETRY_DELAY_MS = 1200;

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
    // 커스텀 typed data를 직렬화할 수 없어도 전역 큐에는 포함한다.
    return '';
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
}

function isTypedSignAlreadyPending(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    message.includes('eth_signtypeddata') &&
    (message.includes('already pending') ||
      (message.includes('requested resource not available') && message.includes('please wait')))
  );
}

function isTransportTimeout(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    message.includes('rpcer53') ||
    message.includes('transport request timed out') ||
    (message.includes('rpc client invoke method') && message.includes('timed out'))
  );
}

/** Capacitor 복귀 이벤트를 MetaMask Connect의 MWP transport에도 전달한다. */
function resumeNativeMetaMaskTransport(): void {
  if (typeof window === 'undefined') return;
  // MWP transport는 browser focus에서 끊어진 암호화 채널을 reconnect한다.
  window.dispatchEvent(new Event('focus'));
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
    await sleep(350);
  } catch {
    await sleep(500);
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
  options?: {
    immediateAfterWalletReturn?: boolean;
    onTransportRetry?: () => void;
  }
): Promise<`0x${string}`> {
  const requestKey = getTypedSignRequestKey(parameters);
  const existingRequest = requestKey ? typedSignInFlight.get(requestKey) : undefined;
  if (existingRequest) return existingRequest;

  const queuedRequest = enqueueTypedSign(async () => {
    const nativeApp = isCapacitorNativeApp();
    const chainId = resolveChainId(
      parameters.domain as { chainId?: number | bigint } | undefined
    );

    // 첫 Permit/Authorization은 즉시 전달한다. Permit → Transfer처럼 직전 지갑
    // 요청이 있을 때만 앱 복귀와 SDK pending 해제를 확인한다.
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

    let pendingRetryCount = 0;
    let transportRetryCount = 0;
    for (;;) {
      try {
        const signature = await wagmiSignTypedData(wagmiConfig, parameters);
        if (nativeApp) {
          // 응답이 WebView가 백그라운드인 동안 도착할 수 있으므로 실제 앱 복귀를
          // 확인한 시점부터 다음 서명의 cooldown을 계산한다.
          await waitForNativeWalletReturn(8000);
          lastNativeTypedSignFinishedAt = Date.now();
        }
        return signature;
      } catch (error) {
        const pendingRetryDelay = NATIVE_PENDING_RETRY_DELAYS_MS[pendingRetryCount];
        if (nativeApp && isTypedSignAlreadyPending(error) && pendingRetryDelay !== undefined) {
          pendingRetryCount += 1;
          await waitForNativeWalletReturn(8000);
          resumeNativeMetaMaskTransport();
          await sleep(pendingRetryDelay);
          continue;
        }

        // MetaMask에서 승인을 마쳤지만 Android WebView가 백그라운드인 동안 MWP
        // 응답 채널이 끊기면 SDK가 60초 후 RPCErr53을 반환한다. 앱 복귀 신호로
        // transport를 복구하고 동일 typed data를 딱 한 번만 다시 요청한다.
        if (nativeApp && isTransportTimeout(error) && transportRetryCount === 0) {
          transportRetryCount += 1;
          options?.onTransportRetry?.();
          await waitForNativeWalletReturn(8000);
          resumeNativeMetaMaskTransport();
          await sleep(NATIVE_TRANSPORT_RETRY_DELAY_MS);
          if (chainId != null) await verifyWalletOnChain(chainId);
          setWalletLinkingFlag(true);
          continue;
        }

        if (nativeApp && isTypedSignAlreadyPending(error)) {
          throw new Error(
            'MetaMask에 이전 서명 요청이 남아 있습니다. 기존 요청을 완료하거나 취소한 뒤 다시 시도해주세요.'
          );
        }
        throw error;
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
