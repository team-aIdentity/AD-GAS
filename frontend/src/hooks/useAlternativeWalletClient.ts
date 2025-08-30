import { useEffect, useState } from 'react';
import { useAccount, useConnectorClient } from 'wagmi';
import { WalletClient } from 'viem';

/**
 * useWalletClient의 대안으로 useConnectorClient를 사용하는 훅
 * 일부 경우에서 더 안정적일 수 있습니다.
 */
export function useAlternativeWalletClient() {
  const { isConnected, connector } = useAccount();
  const { data: connectorClient, isLoading } = useConnectorClient();
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);

  useEffect(() => {
    if (!isConnected || !connectorClient) {
      setWalletClient(null);
      return;
    }

    // connectorClient를 WalletClient로 캐스팅
    setWalletClient(connectorClient as WalletClient);
  }, [isConnected, connectorClient]);

  return {
    data: walletClient,
    isLoading,
    connector,
  };
}

/**
 * 지갑 연결 상태를 더 안전하게 확인하는 훅
 */
export function useWalletReadiness() {
  const { isConnected, address } = useAccount();
  const [isReady, setIsReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const checkReadiness = () => {
      if (isConnected && address) {
        setIsReady(true);
        setRetryCount(0);
      } else if (isConnected && !address && retryCount < 5) {
        // 연결은 되었지만 주소가 없는 경우, 짧은 지연 후 재시도
        timeoutId = setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 500);
        setIsReady(false);
      } else {
        setIsReady(false);
        setRetryCount(0);
      }
    };

    checkReadiness();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isConnected, address, retryCount]);

  return { isReady, retryCount };
}
