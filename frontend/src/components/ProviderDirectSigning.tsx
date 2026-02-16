import { useEffect, useState, useRef } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { GaslessSDK } from '../../../src';
import { SdkConfig } from '../../../src/core/GaslessSDK';
import { PublicClient, WalletClient } from 'viem';

export function TransferUI() {
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient, isLoading: isWalletClientLoading } = useWalletClient();

  // SDK 인스턴스를 React state로 관리
  const [sdk, setSdk] = useState<GaslessSDK | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // useRef로 초기화 상태를 추적하여 리렌더링 방지
  const initializingRef = useRef(false);

  // 연결 해제 시 SDK 정리
  useEffect(() => {
    if (!isConnected || !address) {
      if (sdk) {
        console.log('지갑 연결 해제 - SDK 정리');
        setSdk(null);
      }
      // 연결 해제 시 초기화 상태도 리셋
      initializingRef.current = false;
      setIsInitializing(false);
    }
  }, [isConnected, address, sdk]);

  // SDK 초기화
  useEffect(() => {
    console.log('=== SDK 초기화 상태 체크 ===');
    console.log('isConnected:', isConnected);
    console.log('address:', address);
    console.log('publicClient:', publicClient);
    console.log('walletClient:', walletClient);
    console.log('isWalletClientLoading:', isWalletClientLoading);
    console.log('sdk:', !!sdk);
    console.log('initializingRef.current:', initializingRef.current);

    // 초기화 조건 체크
    const shouldInitialize =
      isConnected && address && !isWalletClientLoading && publicClient && walletClient && !sdk;

    if (!shouldInitialize) {
      return;
    }

    // useRef를 사용해서 초기화 중복 실행 방지 (리렌더링 없음)
    if (initializingRef.current) {
      console.log('이미 SDK 초기화 중이므로 건너뜀');
      return;
    }

    const initSDK = async () => {
      try {
        initializingRef.current = true;
        setIsInitializing(true);
        console.log('SDK 초기화 시작...');

        const config: SdkConfig = {
          publicClient: publicClient as PublicClient,
          walletClient: walletClient as WalletClient,
        };

        const sdkInstance = await GaslessSDK.initialize(config);
        setSdk(sdkInstance);
        console.log('SDK 초기화 완료!');
        console.log(sdkInstance);
      } catch (error) {
        console.error('SDK 초기화 실패:', error);
        setSdk(null);
      } finally {
        initializingRef.current = false;
        setIsInitializing(false);
      }
    };

    initSDK();
  }, [isConnected, address, publicClient, walletClient, isWalletClientLoading, sdk]);

  const handleTransfer = async () => {
    if (!sdk) {
      alert('SDK is not ready. Please connect your wallet.');
      return;
    }

    // 1. UI에서 송금 데이터 정의
    const transaction = {
      to: '0x3C39E3e03E6aB4316D3809cC6c9C11bafa801109', // 받는 주소
      data: '0x',
      value: '10000000000000000', // 보낼 금액 (0.01 ETH)
    };

    // 2. SDK의 sendTransaction 메서드 호출 (광고 로직 포함)
    try {
      const txHash = await sdk.sendTransaction({
        to: transaction.to as `0x${string}`,
        value: BigInt(transaction.value),
        data: transaction.data as `0x${string}`,
      });
      alert(`Transaction successful! Hash: ${txHash}`);
    } catch (error) {
      alert(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* 상태 정보 표시 */}
      <div className="text-sm space-y-1 p-3 bg-gray-50 rounded-lg">
        <div>연결 상태: {isConnected ? '✅ 연결됨' : '❌ 연결 안됨'}</div>
        <div>주소: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '없음'}</div>
        <div>Public Client: {publicClient ? '✅ 준비됨' : '❌ 없음'}</div>
        <div>
          Wallet Client:{' '}
          {walletClient ? '✅ 준비됨' : isWalletClientLoading ? '⏳ 로딩 중...' : '❌ 없음'}
        </div>
        <div>
          SDK: {sdk ? '✅ 초기화됨' : isInitializing ? '⏳ 초기화 중...' : '❌ 초기화 안됨'}
        </div>
      </div>

      {/* 송금 버튼 */}
      {sdk ? (
        <button
          onClick={handleTransfer}
          className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors duration-200"
        >
          Send 0.01 ETH (Watch Ad to make it Gasless)
        </button>
      ) : isInitializing ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">SDK 초기화 중...</p>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-gray-600">
            {!isConnected
              ? '지갑을 연결해주세요.'
              : isWalletClientLoading
                ? '지갑 클라이언트 로딩 중...'
                : '지갑 클라이언트를 기다리는 중...'}
          </p>
        </div>
      )}
    </div>
  );
}
