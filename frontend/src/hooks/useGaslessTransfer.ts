import { useState, useCallback } from 'react';
import { parseEther } from 'viem';
import { GaslessSDK, BundlerResponse, GaslessSDKError } from '../../../src';
import {
  TransactionData,
  GaslessTransferOptions,
  TransferStep,
  TransferProgress,
  UseGaslessTransferResult,
} from '../types/gasless';

/**
 * 가스리스 전송을 위한 커스텀 훅
 * 
 * 특징:
 * - 단계별 진행 상황 추적
 * - 광고 시청 시뮬레이션
 * - 자동 재시도 로직
 * - 상세한 에러 처리
 */
export function useGaslessTransfer(sdk: GaslessSDK | null): UseGaslessTransferResult {
  const [isTransferring, setIsTransferring] = useState(false);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [result, setResult] = useState<BundlerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateProgress = useCallback((step: TransferStep, message: string, progressPercent: number) => {
    setProgress({
      step,
      message,
      progress: progressPercent,
    });
  }, []);

  const simulateAdWatching = useCallback(async (durationSeconds: number = 5) => {
    return new Promise<void>((resolve) => {
      let currentTime = 0;
      const interval = setInterval(() => {
        currentTime += 0.1;
        const progressPercent = Math.min((currentTime / durationSeconds) * 100, 100);
        
        updateProgress(
          TransferStep.SHOWING_AD,
          `광고 시청 중... (${Math.ceil(durationSeconds - currentTime)}초 남음)`,
          progressPercent
        );

        if (currentTime >= durationSeconds) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }, [updateProgress]);

  const transfer = useCallback(async (
    data: TransactionData,
    options: GaslessTransferOptions = {}
  ): Promise<BundlerResponse> => {
    if (!sdk) {
      throw new Error('SDK가 초기화되지 않았습니다.');
    }

    const {
      showAdBeforeTransaction = true,
      adDurationSeconds = 5,
      enableProgressTracking = true,
      autoRetryOnFailure = false,
      maxRetries = 3,
    } = options;

    setIsTransferring(true);
    setError(null);
    setResult(null);

    let retryCount = 0;

    const attemptTransfer = async (): Promise<BundlerResponse> => {
      try {
        // 1단계: 초기화
        if (enableProgressTracking) {
          updateProgress(TransferStep.INITIALIZING, '트랜잭션 준비 중...', 10);
        }

        // 2단계: 광고 시청 (옵션)
        if (showAdBeforeTransaction) {
          await simulateAdWatching(adDurationSeconds);
        }

        // 3단계: 트랜잭션 준비
        if (enableProgressTracking) {
          updateProgress(TransferStep.PREPARING_TRANSACTION, '트랜잭션 데이터 구성 중...', 40);
        }

        const transaction = {
          to: data.to as `0x${string}`,
          value: parseEther(data.value),
          data: (data.data || '0x') as `0x${string}`,
        };

        // 4단계: 서명
        if (enableProgressTracking) {
          updateProgress(TransferStep.SIGNING, '트랜잭션 서명 중...', 60);
        }

        // 5단계: 제출
        if (enableProgressTracking) {
          updateProgress(TransferStep.SUBMITTING, 'Bundler에 전송 중...', 80);
        }

        const txResult = await sdk.sendTransaction(transaction);

        // 6단계: 완료
        if (enableProgressTracking) {
          updateProgress(TransferStep.COMPLETED, '트랜잭션 완료!', 100);
        }

        setResult(txResult);
        return txResult;

      } catch (err) {
        retryCount++;

        let errorMessage = '트랜잭션 실패';
        if (err instanceof GaslessSDKError) {
          errorMessage = `SDK 오류 (${err.code}): ${err.message}`;
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }

        // 자동 재시도 로직
        if (autoRetryOnFailure && retryCount < maxRetries) {
          console.log(`🔄 재시도 ${retryCount}/${maxRetries}: ${errorMessage}`);
          
          if (enableProgressTracking) {
            updateProgress(
              TransferStep.FAILED,
              `재시도 중... (${retryCount}/${maxRetries})`,
              0
            );
          }

          // 재시도 전 잠시 대기
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          return attemptTransfer();
        }

        if (enableProgressTracking) {
          updateProgress(TransferStep.FAILED, errorMessage, 0);
        }

        throw new Error(errorMessage);
      }
    };

    try {
      const txResult = await attemptTransfer();
      return txResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(errorMessage);
      throw err;
    } finally {
      setIsTransferring(false);
    }
  }, [sdk, updateProgress, simulateAdWatching]);

  const reset = useCallback(() => {
    setIsTransferring(false);
    setProgress(null);
    setResult(null);
    setError(null);
  }, []);

  return {
    transfer,
    isTransferring,
    progress,
    result,
    error,
    reset,
  };
}

