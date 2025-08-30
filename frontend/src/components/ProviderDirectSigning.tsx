'use client';

import React, { useState } from 'react';
import { useAccount, useConnectorClient } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { GaslessSDK, GaslessSDKConfig } from '../../../src';

// SDK 설정
const sdkConfig: GaslessSDKConfig = {
  networks: [
    {
      chainId: 137,
      name: 'Polygon Mainnet',
      rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/your-api-key',
      relayerUrl: 'https://relayer.example.com',
      paymasterAddress: '0x1234567890123456789012345678901234567890',
      gasTokens: ['0x0000000000000000000000000000000000000000'],
    },
  ],
  defaultNetwork: 137,
  relayerEndpoint: 'https://relayer.example.com',
  paymasterEndpoint: 'https://paymaster.example.com',
  bundlerEndpoint: 'https://bundler.stackup.sh/v1/polygon/YOUR_API_KEY',
  entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  debug: true,
};

interface ProviderDirectSigningProps {
  address: string;
}

export function ProviderDirectSigning({ address }: ProviderDirectSigningProps) {
  const { connector } = useAccount();
  const { data: connectorClient } = useConnectorClient();
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };

  const handleSendWithProviderSigning = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!to || !amount || !connector) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setLogs([]);

    try {
      addLog('🚀 Provider 직접 서명 + Bundler 전송 시작');

      // 1단계: SDK 초기화
      const sdk = new GaslessSDK(sdkConfig);
      addLog('✅ SDK 초기화 완료');

      // 2단계: 지갑 어댑터 연결
      const walletAdapter = {
        async getAddress() {
          return address;
        },
        async signMessage(message: string) {
          addLog('📝 메시지 서명 요청...');
          return '0x' + '0'.repeat(130); // Mock
        },
        async signTypedData(domain: any, types: any, value: any) {
          addLog('📝 타입드 데이터 서명 요청...');
          return '0x' + '1'.repeat(130); // Mock
        },
        async getChainId() {
          return 137;
        },
      };

      await sdk.connectWallet(walletAdapter);
      addLog('🔗 지갑 어댑터 연결 완료');

      // 3단계: Provider 가져오기
      const provider = await connector.getProvider();
      addLog(`📡 Provider 연결됨: ${connector.name}`);

      // 4단계: SDK의 sendUserOperationToBundler 호출
      addLog('🔄 SDK sendUserOperationToBundler 호출...');

      const bundlerResult = await sdk.sendUserOperationToBundler(
        {
          to,
          value: parseEther(amount),
          data: '0x',
        },
        provider, // 🔑 핵심: Provider 직접 전달!
        step => {
          addLog(`📊 ${step}`);
        }
      );

      addLog('🎉 모든 과정 완료!');
      setResult(bundlerResult);
    } catch (err: any) {
      const errorMessage = err.message || '알 수 없는 오류가 발생했습니다';
      addLog(`❌ 오류: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setResult(null);
    setError(null);
  };

  return (
    <div className="w-full space-y-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-emerald-900">
          🔧 Provider 직접 서명 + Bundler 전송
        </h4>
        <button onClick={clearLogs} className="text-emerald-500 hover:text-emerald-700 text-sm">
          로그 지우기
        </button>
      </div>

      {/* 핵심 설명 */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded">
        <p className="text-xs text-blue-800">
          🎯 <strong>핵심 기능:</strong>
          <br />
          1. Wagmi Connector에서 Provider 직접 가져오기
          <br />
          2. Provider를 SDK에 전달하여 직접 서명 요청
          <br />
          3. <strong>RPC 우회하고 Bundler로 직접 전송</strong>
          <br />
          4. UserOperation → 실제 트랜잭션 변환 추적
        </p>
      </div>

      {/* 송금 폼 */}
      <form onSubmit={handleSendWithProviderSigning} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">받는 주소:</label>
          <input
            type="text"
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">금액 (ETH):</label>
          <input
            type="number"
            step="0.000001"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.001"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !to || !amount || !connector}
          className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors duration-200"
        >
          {isLoading ? '🔧 Provider 서명 + Bundler 전송 중...' : '🔧 Provider 직접 서명으로 전송'}
        </button>
      </form>

      {/* 실시간 로그 */}
      {logs.length > 0 && (
        <div className="p-3 bg-gray-900 text-green-400 rounded font-mono text-xs max-h-40 overflow-y-auto">
          <h4 className="text-white font-semibold mb-2">📊 실시간 로그:</h4>
          {logs.map((log, index) => (
            <div key={index} className="mb-1">
              {log}
            </div>
          ))}
        </div>
      )}

      {/* 성공 결과 */}
      {result && (
        <div className="p-3 bg-green-50 border border-green-200 rounded">
          <h4 className="font-medium text-green-800 mb-2">🔧 Provider 직접 서명 성공!</h4>
          <div className="space-y-1 text-sm text-green-700">
            <div>
              <strong>UserOperation Hash:</strong>
              <p className="font-mono text-xs break-all">{result.userOpHash}</p>
            </div>
            {result.bundlerTxHash && (
              <div>
                <strong>Bundler Transaction Hash:</strong>
                <p className="font-mono text-xs break-all">{result.bundlerTxHash}</p>
              </div>
            )}
          </div>
          <div className="mt-2 p-2 bg-green-100 rounded">
            <p className="text-xs text-green-800">
              ✨ <strong>성공!</strong> Provider 직접 서명으로 Bundler 전송 완료!
            </p>
          </div>
        </div>
      )}

      {/* 오류 메시지 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-800 font-medium">Provider 서명 오류:</p>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 코드 예제 */}
      <div className="p-3 bg-gray-100 rounded text-xs">
        <h4 className="font-semibold mb-2">💻 핵심 코드:</h4>
        <pre className="text-gray-700 whitespace-pre-wrap">
          {`// 1. Provider 가져오기
const provider = await connector.getProvider();

// 2. SDK에 Provider 전달
const result = await sdk.sendUserOperationToBundler(
  { to, value, data },
  provider  // 🔑 핵심: Provider 직접 전달!
);

// 3. SDK 내부에서 Provider로 직접 서명 요청
await provider.request({
  method: 'eth_signTypedData_v4',
  params: [address, typedDataJSON]
});`}
        </pre>
      </div>
    </div>
  );
}
