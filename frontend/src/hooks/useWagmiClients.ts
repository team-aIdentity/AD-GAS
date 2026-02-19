import { useEffect, useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { PublicClient, WalletClient } from 'viem';

interface ClientsState {
  publicClient: PublicClient | null;
  walletClient: WalletClient | null;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * wagmi 클라이언트들의 초기화를 안전하게 관리하는 커스텀 훅
 * 
 * @returns {ClientsState} 클라이언트 상태 정보
 */
export function useWagmiClients(): ClientsState {
  const { address, status: accountStatus } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient, isLoading: isWalletClientLoading, error: walletClientError } = useWalletClient();

  // 재연결 중에는 캐시된 주소로 클라이언트를 쓰지 않음 (실제 연결됐을 때만)
  const isConnected = accountStatus === 'connected' && !!address;

  const [state, setState] = useState<ClientsState>({
    publicClient: null,
    walletClient: null,
    isReady: false,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    // 연결되지 않은 상태 (reconnecting 중에는 준비 안 함)
    if (!isConnected || !address) {
      setState({
        publicClient: null,
        walletClient: null,
        isReady: false,
        isLoading: false,
        error: null,
      });
      return;
    }

    // 로딩 중인 상태
    if (isWalletClientLoading) {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
      }));
      return;
    }

    // 에러 상태
    if (walletClientError) {
      setState({
        publicClient: null,
        walletClient: null,
        isReady: false,
        isLoading: false,
        error: walletClientError.message,
      });
      return;
    }

    // 클라이언트들이 준비된 상태
    if (publicClient && walletClient) {
      setState({
        publicClient: publicClient as PublicClient,
        walletClient: walletClient as WalletClient,
        isReady: true,
        isLoading: false,
        error: null,
      });
      return;
    }

    // 클라이언트가 아직 준비되지 않은 상태
    setState({
      publicClient: null,
      walletClient: null,
      isReady: false,
      isLoading: !publicClient || !walletClient, // 하나라도 없으면 로딩 중으로 간주
      error: null,
    });

  }, [isConnected, address, publicClient, walletClient, isWalletClientLoading, walletClientError]);

  return state;
}
