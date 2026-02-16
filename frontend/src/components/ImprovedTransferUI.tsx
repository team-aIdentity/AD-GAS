'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { GaslessSDK, BundlerResponse, GaslessSDKError } from '../../../src';

interface TransactionData {
  to: string;
  value: string;
  data?: string;
}

interface SdkState {
  instance: GaslessSDK | null;
  isInitializing: boolean;
  error: string | null;
}

export function ImprovedTransferUI() {
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // SDK 상태 관리
  const [sdkState, setSdkState] = useState<SdkState>({
    instance: null,
    isInitializing: false,
    error: null,
  });

  // 트랜잭션 폼 상태
  const [transactionData, setTransactionData] = useState<TransactionData>({
    to: '',
    value: '0.01',
    data: '0x',
  });

  // 트랜잭션 실행 상태
  const [isTransacting, setIsTransacting] = useState(false);
  const [transactionResult, setTransactionResult] = useState<BundlerResponse | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);

  // 실행 로그
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  }, []);

  // SDK 초기화
  useEffect(() => {
    const initializeSDK = async () => {
      if (!isConnected || !publicClient || !walletClient || !address) {
        setSdkState({
          instance: null,
          isInitializing: false,
          error: null,
        });
        return;
      }

      setSdkState(prev => ({
        ...prev,
        isInitializing: true,
        error: null,
      }));

      try {
        addLog('🚀 SDK 초기화 시작...');

        // SDK 초기화를 위한 설정
        const config = {
          publicClient,
          walletClient,
          biconomyApiKey: process.env.NEXT_PUBLIC_BICONOMY_API_KEY!,
        };

        const sdkInstance = await GaslessSDK.initialize(config);
        
        setSdkState({
          instance: sdkInstance,
          isInitializing: false,
          error: null,
        });

        addLog('✅ SDK 초기화 완료');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'SDK 초기화 실패';
        setSdkState({
          instance: null,
          isInitializing: false,
          error: errorMessage,
        });
        addLog(`❌ SDK 초기화 오류: ${errorMessage}`);
      }
    };

    initializeSDK();
  }, [isConnected, publicClient, walletClient, address, addLog]);

  // 트랜잭션 전송 핸들러
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sdkState.instance) {
      alert('SDK가 준비되지 않았습니다. 지갑을 연결해주세요.');
      return;
    }

    if (!transactionData.to || !transactionData.value) {
      alert('받는 주소와 금액을 입력해주세요.');
      return;
    }

    setIsTransacting(true);
    setTransactionError(null);
    setTransactionResult(null);

    try {
      addLog('💸 트랜잭션 전송 시작...');

      // 트랜잭션 데이터 구성
      const transaction = {
        to: transactionData.to as `0x${string}`,
        value: parseEther(transactionData.value),
        data: (transactionData.data || '0x') as `0x${string}`,
      };

      addLog(`📤 트랜잭션 정보: 받는 주소=${transaction.to}, 금액=${formatEther(transaction.value)} ETH`);

      // SDK의 sendTransaction 메서드 호출 (광고 로직 포함) — userOpHash 문자열 반환
      const userOpHash = await sdkState.instance.sendTransaction(transaction);
      const result: BundlerResponse = { userOpHash };

      setTransactionResult(result);
      addLog('🎉 트랜잭션 전송 완료!');
      addLog(`📋 UserOperation Hash: ${result.userOpHash}`);

      if (result.bundlerTxHash) {
        addLog(`📋 Bundler Transaction Hash: ${result.bundlerTxHash}`);
      }

    } catch (error) {
      let errorMessage = '트랜잭션 전송 실패';
      
      if (error instanceof GaslessSDKError) {
        errorMessage = `SDK 오류 (${error.code}): ${error.message}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setTransactionError(errorMessage);
      addLog(`❌ 트랜잭션 오류: ${errorMessage}`);
    } finally {
      setIsTransacting(false);
    }
  };

  // 로그 지우기
  const clearLogs = () => {
    setLogs([]);
    setTransactionResult(null);
    setTransactionError(null);
  };

  // 연결되지 않은 상태
  if (!isConnected) {
    return (
      <div className="w-full p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800 text-center">
          🔌 지갑을 연결하여 가스리스 전송 기능을 사용하세요.
        </p>
      </div>
    );
  }

  // SDK 초기화 중
  if (sdkState.isInitializing) {
    return (
      <div className="w-full p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
          <p className="text-blue-800">⚡ Gasless SDK 초기화 중...</p>
        </div>
      </div>
    );
  }

  // SDK 초기화 실패
  if (sdkState.error) {
    return (
      <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 font-medium">❌ SDK 초기화 실패</p>
        <p className="text-red-700 text-sm mt-1">{sdkState.error}</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 p-6 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-purple-900">
            ⚡ Gasless Transfer UI
          </h3>
          <p className="text-purple-700 text-sm">
            광고 시청으로 가스비 없이 전송하세요
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-green-700 text-sm font-medium">SDK 준비됨</span>
        </div>
      </div>

      {/* 기능 설명 */}
      <div className="p-4 bg-white/70 border border-purple-100 rounded-lg">
        <h4 className="font-semibold text-purple-800 mb-2">🎯 주요 기능:</h4>
        <ul className="text-sm text-purple-700 space-y-1">
          <li>• 🎬 보상형 광고 시청으로 가스비 절약</li>
          <li>• ⚡ Account Abstraction (EIP-4337) 기반</li>
          <li>• 🔄 자동 SDK 상태 관리 및 재연결</li>
          <li>• 📊 실시간 트랜잭션 로그 및 상태 추적</li>
        </ul>
      </div>

      {/* 트랜잭션 폼 */}
      <form onSubmit={handleTransfer} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            받는 주소:
          </label>
          <input
            type="text"
            value={transactionData.to}
            onChange={e => setTransactionData(prev => ({ ...prev, to: e.target.value }))}
            placeholder="0x..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            전송 금액 (ETH):
          </label>
          <input
            type="number"
            step="0.000001"
            min="0"
            value={transactionData.value}
            onChange={e => setTransactionData(prev => ({ ...prev, value: e.target.value }))}
            placeholder="0.01"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            추가 데이터 (선택사항):
          </label>
          <input
            type="text"
            value={transactionData.data}
            onChange={e => setTransactionData(prev => ({ ...prev, data: e.target.value }))}
            placeholder="0x"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={isTransacting || !sdkState.instance}
          className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:scale-100"
        >
          {isTransacting ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span>🎬 광고 시청 후 가스리스 전송 중...</span>
            </div>
          ) : (
            '🎬 광고 보고 가스비 없이 전송하기'
          )}
        </button>
      </form>

      {/* 실행 로그 */}
      {logs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-800">📊 실행 로그</h4>
            <button
              onClick={clearLogs}
              className="text-purple-500 hover:text-purple-700 text-sm font-medium"
            >
              로그 지우기
            </button>
          </div>
          <div className="p-4 bg-gray-900 text-green-400 rounded-lg font-mono text-xs max-h-48 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index} className="mb-1">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 성공 결과 */}
      {transactionResult && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-semibold text-green-800 mb-3">🎉 가스리스 전송 성공!</h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium text-green-700">UserOperation Hash:</span>
              <p className="font-mono text-xs text-green-600 break-all mt-1">
                {transactionResult.userOpHash}
              </p>
            </div>
            {transactionResult.bundlerTxHash && (
              <div>
                <span className="font-medium text-green-700">Bundler Transaction Hash:</span>
                <p className="font-mono text-xs text-green-600 break-all mt-1">
                  {transactionResult.bundlerTxHash}
                </p>
              </div>
            )}
          </div>
          <div className="mt-3 p-3 bg-green-100 rounded">
            <p className="text-xs text-green-800">
              ✨ <strong>축하합니다!</strong> 광고 시청으로 가스비 없이 트랜잭션이 성공적으로 전송되었습니다!
            </p>
          </div>
        </div>
      )}

      {/* 오류 메시지 */}
      {transactionError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-semibold text-red-800 mb-2">❌ 트랜잭션 실패</h4>
          <p className="text-sm text-red-700">{transactionError}</p>
        </div>
      )}

      {/* 코드 예제 */}
      <div className="p-4 bg-white/70 border border-purple-100 rounded-lg">
        <h4 className="font-semibold text-purple-800 mb-3">💻 핵심 구현 코드:</h4>
        <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
{`// 1. SDK 초기화 (useEffect 내에서)
const config = {
  publicClient,
  walletClient,
  biconomyApiKey: process.env.NEXT_PUBLIC_BICONOMY_API_KEY!,
};
const sdk = await GaslessSDK.initialize(config);

// 2. 가스리스 트랜잭션 전송
const transaction = {
  to: '0x...',
  value: parseEther('0.01'),
  data: '0x',
};

const result = await sdk.sendTransaction(transaction);
console.log('UserOp Hash:', result.userOpHash);`}
        </pre>
      </div>
    </div>
  );
}

