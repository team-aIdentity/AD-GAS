'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount, useSignMessage, useSignTypedData, useConnectorClient } from 'wagmi';
import { GaslessSDK, GaslessSDKConfig } from '../../../src';

// Account Abstraction을 위한 SDK 설정
const aaConfig: GaslessSDKConfig = {
  networks: [
    {
      chainId: 137,
      name: 'Polygon Mainnet',
      rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/your-api-key',
      relayerUrl: 'https://relayer.example.com',
      paymasterAddress: '0x1234567890123456789012345678901234567890',
      gasTokens: [
        '0x0000000000000000000000000000000000000000', // MATIC
        '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
      ],
    },
  ],
  defaultNetwork: 137,
  relayerEndpoint: 'https://relayer.example.com',
  paymasterEndpoint: 'https://paymaster.example.com',
  bundlerEndpoint: 'https://bundler.stackup.sh/v1/polygon/YOUR_API_KEY', // 실제 Bundler URL
  entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // EntryPoint v0.6
  debug: true,
};

interface AATransactionParams {
  to: string;
  value?: bigint;
  data?: string;
  gasLimit?: bigint;
}

interface UserOperation {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}

interface AATransactionResult {
  success: boolean;
  userOpHash?: string;
  bundlerTxHash?: string;
  userOperation?: UserOperation;
  error?: string;
}

export function useAccountAbstractionTransaction() {
  const { address, connector } = useAccount();
  const { data: connectorClient } = useConnectorClient();
  const { signMessageAsync } = useSignMessage();
  const { signTypedDataAsync } = useSignTypedData();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AATransactionParams): Promise<AATransactionResult> => {
      if (!address) {
        throw new Error('지갑이 연결되지 않았습니다');
      }

      console.log('🔄 1단계: Account Abstraction 트랜잭션 시작');
      console.log('📝 트랜잭션 파라미터:', params);

      try {
        // 1단계: SDK 초기화
        console.log('🚀 2단계: Gasless SDK 초기화');
        const sdk = new GaslessSDK(aaConfig);

        // 2단계: Wagmi 서명 어댑터 생성
        const wagmiSigningAdapter = {
          async getAddress() {
            return address;
          },
          
          async signMessage(message: string) {
            console.log('✍️ 메시지 서명 요청:', message.slice(0, 100) + '...');
            return await signMessageAsync({ message });
          },
          
          async signTypedData(domain: any, types: any, value: any) {
            console.log('✍️ EIP-712 타입드 데이터 서명 요청');
            return await signTypedDataAsync({
              domain,
              types,
              primaryType: Object.keys(types).find(key => key !== 'EIP712Domain') || 'Message',
              message: value,
            });
          },
          
          async getChainId() {
            return 137; // Polygon
          }
        };

        // 3단계: SDK에 지갑 연결
        console.log('🔗 3단계: SDK에 지갑 어댑터 연결');
        await sdk.connectWallet(wagmiSigningAdapter);

        // 4단계: Provider 가져오기 (직접 서명을 위해)
        let provider = null;
        if (connector) {
          try {
            provider = await connector.getProvider();
            console.log('📡 Provider 연결됨:', connector.name);
          } catch (error) {
            console.warn('Provider 가져오기 실패, 기본 서명 방식 사용:', error);
          }
        }

        // 5단계: SDK의 새로운 sendUserOperationToBundler 메서드 사용
        console.log('🚀 5단계: SDK를 통한 Account Abstraction 실행');
        const bundlerResult = await sdk.sendUserOperationToBundler(
          {
            to: params.to,
            value: params.value,
            data: params.data,
          },
          provider, // Provider 직접 전달
          (step) => {
            console.log('📊 진행 상황:', step);
          }
        );
        
        console.log('🎉 Account Abstraction 트랜잭션 완료!');
        return {
          success: true,
          userOpHash: bundlerResult.userOpHash,
          bundlerTxHash: bundlerResult.bundlerTxHash,
        };

      } catch (error) {
        console.error('❌ Account Abstraction 트랜잭션 실패:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        };
      }
    },

    onSuccess: (data) => {
      console.log('✅ AA 트랜잭션 성공:', data);
      // 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['userOperations'] });
    },

    onError: (error) => {
      console.error('❌ AA 트랜잭션 실패:', error);
    },
  });
}

// 이제 모든 로직이 SDK에 구현되어 헬퍼 함수들이 필요 없습니다!
