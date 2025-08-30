'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';

export function StepByStepDebug() {
  const { address, connector } = useAccount();
  const [logs, setLogs] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const addLog = (message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = data ? `${message}\n${JSON.stringify(data, null, 2)}` : message;
    setLogs(prev => [...prev, `[${timestamp}] ${logMessage}`]);
    console.log(message, data);
  };

  const clearLogs = () => {
    setLogs([]);
    setCurrentStep(0);
  };

  // 1단계: 기본 메시지 서명 테스트
  const testBasicSigning = async () => {
    if (!connector || !address) return;
    setCurrentStep(1);

    try {
      const provider = await connector.getProvider();
      addLog('🔍 1단계: 기본 메시지 서명 테스트');

      const message = 'Hello World';
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, address]
      });

      addLog('✅ 기본 서명 성공', { signature });
      setCurrentStep(2);
    } catch (error: any) {
      addLog('❌ 기본 서명 실패', { error: error.message, code: error.code });
    }
  };

  // 2단계: 간단한 EIP-712 테스트
  const testSimpleEIP712 = async () => {
    if (!connector || !address) return;
    setCurrentStep(2);

    try {
      const provider = await connector.getProvider();
      addLog('🔍 2단계: 간단한 EIP-712 서명 테스트');

      // 매우 간단한 EIP-712 구조
      const typedData = {
        domain: {
          name: 'Test App',
          version: '1',
          chainId: 11155111, // Sepolia
        },
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
          ],
          Message: [
            { name: 'content', type: 'string' },
          ],
        },
        primaryType: 'Message',
        message: {
          content: 'Hello World',
        },
      };

      addLog('📝 간단한 EIP-712 데이터', typedData);

      const signature = await provider.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(typedData)]
      });

      addLog('✅ 간단한 EIP-712 성공', { signature });
      setCurrentStep(3);
    } catch (error: any) {
      addLog('❌ 간단한 EIP-712 실패', { error: error.message, code: error.code });
    }
  };

  // 3단계: verifyingContract 포함 EIP-712 테스트
  const testWithVerifyingContract = async () => {
    if (!connector || !address) return;
    setCurrentStep(3);

    try {
      const provider = await connector.getProvider();
      addLog('🔍 3단계: verifyingContract 포함 EIP-712 테스트');

      // 다른 컨트랙트 주소 사용 (실제 배포된 컨트랙트)
      const usdcAddress = '0xA0b86a33E6441b8C7013E02b5b67E2b4F4d4d4F9'; // USDC on Sepolia

      const typedData = {
        domain: {
          name: 'Test Contract',
          version: '1',
          chainId: 11155111,
          verifyingContract: usdcAddress, // 실제 컨트랙트 주소 사용
        },
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'Permit',
        message: {
          owner: address,
          spender: '0x742d35Cc6635C0532925a3b8D5c9f5b5aB3b6a8e',
          value: '1000000', // 1 USDC
          nonce: '0',
          deadline: Math.floor(Date.now() / 1000) + 3600, // 1시간 후
        },
      };

      addLog('📝 verifyingContract 포함 EIP-712 데이터', typedData);

      const signature = await provider.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(typedData)]
      });

      addLog('✅ verifyingContract 포함 EIP-712 성공', { signature });
      setCurrentStep(4);
    } catch (error: any) {
      addLog('❌ verifyingContract 포함 EIP-712 실패', { error: error.message, code: error.code });
    }
  };

  // 4단계: UserOperation 최소 형태 테스트
  const testMinimalUserOperation = async () => {
    if (!connector || !address) return;
    setCurrentStep(4);

    try {
      const provider = await connector.getProvider();
      addLog('🔍 4단계: 최소 UserOperation EIP-712 테스트');

      // EntryPoint 주소를 verifyingContract로 사용
      const entryPointAddress = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

      const typedData = {
        domain: {
          name: 'Account Abstraction',
          version: '1',
          chainId: 11155111,
          verifyingContract: entryPointAddress, // EntryPoint 주소 사용
        },
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          UserOperation: [
            { name: 'sender', type: 'address' },
            { name: 'nonce', type: 'uint256' },
            { name: 'callData', type: 'bytes' },
          ],
        },
        primaryType: 'UserOperation',
        message: {
          sender: `0x9406${address.slice(6)}`, // Smart Account 주소
          nonce: '1',
          callData: '0x',
        },
      };

      addLog('📝 최소 UserOperation EIP-712 데이터', typedData);

      const signature = await provider.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(typedData)]
      });

      addLog('✅ 최소 UserOperation 성공!', { signature });
    } catch (error: any) {
      addLog('❌ 최소 UserOperation 실패', { error: error.message, code: error.code });
    }
  };

  if (!address) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-yellow-800">지갑을 먼저 연결해주세요.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-orange-900">🔬 단계별 서명 디버깅</h4>
        <button onClick={clearLogs} className="text-orange-500 hover:text-orange-700 text-sm">
          초기화
        </button>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded">
        <p className="text-xs text-blue-800">
          🎯 <strong>단계별 테스트로 문제 지점 찾기:</strong><br/>
          1. 기본 서명 → 2. 간단한 EIP-712 → 3. verifyingContract → 4. UserOperation
        </p>
      </div>

      {/* 단계별 버튼들 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={testBasicSigning}
          disabled={currentStep > 0 && currentStep !== 1}
          className="p-3 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 text-sm"
        >
          1️⃣ 기본 서명 테스트
        </button>

        <button
          onClick={testSimpleEIP712}
          disabled={currentStep < 1}
          className="p-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 text-sm"
        >
          2️⃣ 간단한 EIP-712
        </button>

        <button
          onClick={testWithVerifyingContract}
          disabled={currentStep < 2}
          className="p-3 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400 text-sm"
        >
          3️⃣ verifyingContract
        </button>

        <button
          onClick={testMinimalUserOperation}
          disabled={currentStep < 3}
          className="p-3 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 text-sm"
        >
          4️⃣ 최소 UserOperation
        </button>
      </div>

      {/* 진행 상황 표시 */}
      <div className="flex items-center space-x-2">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              currentStep >= step
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {step}
          </div>
        ))}
      </div>

      {/* 로그 출력 */}
      {logs.length > 0 && (
        <div className="p-3 bg-gray-900 text-green-400 rounded font-mono text-xs max-h-60 overflow-y-auto">
          <h4 className="text-white font-semibold mb-2">📊 단계별 디버깅 로그:</h4>
          {logs.map((log, index) => (
            <div key={index} className="mb-2 whitespace-pre-wrap">
              {log}
            </div>
          ))}
        </div>
      )}

      {/* 문제 해결 가이드 */}
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
        <h4 className="font-semibold mb-2">🔧 문제 해결 단계:</h4>
        <ul className="space-y-1 text-gray-600">
          <li><strong>1단계 실패:</strong> 지갑 연결 문제 또는 권한 오류</li>
          <li><strong>2단계 실패:</strong> EIP-712 기본 형식 오류</li>
          <li><strong>3단계 실패:</strong> verifyingContract 주소 문제</li>
          <li><strong>4단계 실패:</strong> UserOperation 구조 오류</li>
        </ul>
      </div>
    </div>
  );
}
