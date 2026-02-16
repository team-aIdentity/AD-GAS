'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { GaslessSDK } from '../../../src';

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
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AATransactionParams): Promise<AATransactionResult> => {
      if (!address) {
        throw new Error('지갑이 연결되지 않았습니다');
      }
      if (!publicClient || !walletClient) {
        throw new Error('클라이언트가 준비되지 않았습니다');
      }

      console.log('🔄 Account Abstraction 트랜잭션 시작');
      console.log('📝 트랜잭션 파라미터:', params);

      try {
        const sdk = await GaslessSDK.initialize({
          publicClient,
          walletClient,
          biconomyApiKey: process.env.NEXT_PUBLIC_BICONOMY_API_KEY!,
        });

        const txHash = await sdk.sendGaslessTransaction({
          to: params.to as `0x${string}`,
          value: params.value ?? BigInt(0),
          data: (params.data as `0x${string}`) || undefined,
          gasLimit: params.gasLimit,
        });

        console.log('🎉 Account Abstraction 트랜잭션 완료!');
        return {
          success: true,
          userOpHash: txHash,
          bundlerTxHash: txHash,
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
