'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';

export function DebugProviderSigning() {
  const { address, connector } = useAccount();
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = data ? `${message}\n${JSON.stringify(data, null, 2)}` : message;
    setLogs(prev => [...prev, `[${timestamp}] ${logMessage}`]);
    console.log(message, data);
  };

  const testProviderInput = async () => {
    if (!connector || !address) return;

    setError(null);
    setResult(null);
    setLogs([]);

    try {
      addLog('🔍 Provider 디버깅 시작');

      // 1단계: Provider 가져오기
      const provider = await connector.getProvider();
      addLog('📡 Provider 연결됨', {
        connectorName: connector.name,
        providerType: typeof provider,
        methods: Object.getOwnPropertyNames(provider),
      });

      // 2단계: 간단한 EIP-712 데이터 테스트
      const simpleDomain = {
        name: 'Test App',
        version: '1',
        chainId: 137,
        verifyingContract: address,
      };

      const simpleTypes = {
        Message: [
          { name: 'content', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
        ],
      };

      const simpleMessage = {
        content: 'Hello World',
        timestamp: Date.now().toString(),
      };

      const simpleTypedData = {
        domain: simpleDomain,
        types: simpleTypes,
        primaryType: 'Message',
        message: simpleMessage,
      };

      addLog('📝 간단한 EIP-712 데이터 테스트', simpleTypedData);

      // 3단계: 간단한 서명 요청
      try {
        const simpleSignature = await provider.request({
          method: 'eth_signTypedData_v4',
          params: [address, JSON.stringify(simpleTypedData)],
        });
        addLog('✅ 간단한 서명 성공', { signature: simpleSignature });
      } catch (simpleError: any) {
        addLog('❌ 간단한 서명 실패', { error: simpleError.message, code: simpleError.code });
      }

      // 4단계: UserOperation 형식 테스트
      const userOpDomain = {
        name: 'Account Abstraction',
        version: '1',
        chainId: 137,
        verifyingContract: address,
      };

      const userOpTypes = {
        UserOperation: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'callGasLimit', type: 'uint256' },
          { name: 'verificationGasLimit', type: 'uint256' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'maxFeePerGas', type: 'uint256' },
          { name: 'maxPriorityFeePerGas', type: 'uint256' },
          { name: 'paymasterAndData', type: 'bytes' },
        ],
      };

      const userOpMessage = {
        sender: address,
        nonce: '0x1',
        initCode: '0x',
        callData:
          '0xb61d27f6000000000000000000000000742d35cc6635c0532925a3b8d5c9f5b5ab3b6a8e00000000000000000000000000000000000000000000000000038d7ea4c6800000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000',
        callGasLimit: '0x5208',
        verificationGasLimit: '0x5208',
        preVerificationGas: '0x5208',
        maxFeePerGas: '0x59682f00',
        maxPriorityFeePerGas: '0x59682f00',
        paymasterAndData: '0x',
      };

      const userOpTypedData = {
        domain: userOpDomain,
        types: userOpTypes,
        primaryType: 'UserOperation',
        message: userOpMessage,
      };

      addLog('📦 UserOperation EIP-712 데이터', userOpTypedData);

      // 5단계: UserOperation 서명 요청
      try {
        const userOpSignature = await provider.request({
          method: 'eth_signTypedData_v4',
          params: [address, JSON.stringify(userOpTypedData)],
        });
        addLog('✅ UserOperation 서명 성공', { signature: userOpSignature });
        setResult({ simpleSignature: 'success', userOpSignature });
      } catch (userOpError: any) {
        addLog('❌ UserOperation 서명 실패', {
          error: userOpError.message,
          code: userOpError.code,
          stack: userOpError.stack,
        });
        throw userOpError;
      }
    } catch (err: any) {
      addLog('💥 전체 테스트 실패', { error: err.message, code: err.code });
      setError(err.message);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setResult(null);
    setError(null);
  };

  if (!address) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-yellow-800">지갑을 먼저 연결해주세요.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-red-900">🔍 Provider Input 디버깅</h4>
        <button onClick={clearLogs} className="text-red-500 hover:text-red-700 text-sm">
          로그 지우기
        </button>
      </div>

      <div className="p-3 bg-orange-50 border border-orange-200 rounded">
        <p className="text-xs text-orange-800">
          🐛 <strong>디버깅 목적:</strong>
          <br />
          MetaMask "Invalid input" 오류를 해결하기 위해 Provider에 전달되는 데이터를 분석합니다.
        </p>
      </div>

      <button
        onClick={testProviderInput}
        className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors duration-200"
      >
        🔍 Provider Input 데이터 분석
      </button>

      {/* 실시간 로그 */}
      {logs.length > 0 && (
        <div className="p-3 bg-gray-900 text-green-400 rounded font-mono text-xs max-h-60 overflow-y-auto">
          <h4 className="text-white font-semibold mb-2">📊 디버깅 로그:</h4>
          {logs.map((log, index) => (
            <div key={index} className="mb-2 whitespace-pre-wrap">
              {log}
            </div>
          ))}
        </div>
      )}

      {/* 성공 결과 */}
      {result && (
        <div className="p-3 bg-green-50 border border-green-200 rounded">
          <h4 className="font-medium text-green-800 mb-2">✅ 디버깅 성공!</h4>
          <pre className="text-xs text-green-700 whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {/* 오류 메시지 */}
      {error && (
        <div className="p-3 bg-red-100 border border-red-300 rounded">
          <h4 className="font-medium text-red-800 mb-2">❌ 디버깅 결과:</h4>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs">
        <h4 className="font-semibold mb-2">🔍 확인할 항목들:</h4>
        <ul className="space-y-1 text-gray-600">
          <li>1. Provider 객체 구조 및 메서드</li>
          <li>2. 간단한 EIP-712 서명 테스트</li>
          <li>3. UserOperation EIP-712 데이터 형식</li>
          <li>4. MetaMask가 받는 실제 파라미터</li>
          <li>5. 오류 코드 및 메시지 분석</li>
        </ul>
      </div>
    </div>
  );
}
