import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { GaslessSDK } from '../../../src';
import { UseGaslessSDKResult, GaslessSDKInitConfig } from '../types/gasless';

/**
 * Gasless SDK 관리를 위한 커스텀 훅
 * 
 * 특징:
 * - wagmi 지갑 연결 상태와 자동 동기화
 * - SDK 인스턴스 생명주기 관리
 * - 에러 처리 및 재시도 로직
 * - TypeScript 타입 안전성
 */
export function useGaslessSDK(): UseGaslessSDKResult {
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [sdk, setSdk] = useState<GaslessSDK | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeSDK = useCallback(async () => {
    // 필수 조건 확인
    if (!isConnected || !publicClient || !walletClient || !address) {
      setSdk(null);
      setIsInitialized(false);
      setError(null);
      return;
    }

    // 환경변수 확인
    const biconomyApiKey = process.env.NEXT_PUBLIC_BICONOMY_API_KEY;
    if (!biconomyApiKey) {
      setError('Biconomy API Key가 설정되지 않았습니다.');
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      console.log('🚀 Gasless SDK 초기화 시작...');

      const config: GaslessSDKInitConfig = {
        publicClient,
        walletClient,
        biconomyApiKey,
      };

      const sdkInstance = await GaslessSDK.initialize(config);
      
      setSdk(sdkInstance);
      setIsInitialized(true);
      console.log('✅ Gasless SDK 초기화 완료');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'SDK 초기화 실패';
      setError(errorMessage);
      setSdk(null);
      setIsInitialized(false);
      console.error('❌ SDK 초기화 오류:', errorMessage);
    } finally {
      setIsInitializing(false);
    }
  }, [isConnected, publicClient, walletClient, address]);

  // 수동 재초기화 함수
  const reinitialize = useCallback(async () => {
    setSdk(null);
    setIsInitialized(false);
    await initializeSDK();
  }, [initializeSDK]);

  // 지갑 연결 상태 변경 시 자동으로 SDK 초기화/정리
  useEffect(() => {
    initializeSDK();
  }, [initializeSDK]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (sdk) {
        console.log('🧹 SDK 인스턴스 정리');
        setSdk(null);
        setIsInitialized(false);
      }
    };
  }, [sdk]);

  return {
    sdk,
    isInitialized,
    isInitializing,
    error,
    reinitialize,
  };
}

