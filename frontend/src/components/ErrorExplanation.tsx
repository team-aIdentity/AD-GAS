'use client';

import React from 'react';

export function ErrorExplanation() {
  return (
    <div className="w-full p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <h4 className="text-lg font-semibold text-yellow-900 mb-3">
        🚨 "External signature requests cannot use internal accounts" 오류 해결
      </h4>
      
      <div className="space-y-3 text-sm text-yellow-800">
        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <h5 className="font-semibold text-red-800 mb-1">❌ 문제 상황:</h5>
          <p className="text-red-700">
            EIP-712 서명에서 <code>verifyingContract</code>로 사용자의 EOA 주소를 사용하면 
            MetaMask에서 "External signature requests cannot use internal accounts" 오류 발생
          </p>
        </div>

        <div className="p-3 bg-green-50 border border-green-200 rounded">
          <h5 className="font-semibold text-green-800 mb-1">✅ 해결 방법:</h5>
          <p className="text-green-700">
            <code>verifyingContract</code>로 <strong>Smart Account 주소</strong>를 사용해야 함
          </p>
        </div>

        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
          <h5 className="font-semibold text-blue-800 mb-2">🔧 수정된 코드:</h5>
          <pre className="text-xs text-blue-700 bg-white p-2 rounded overflow-x-auto">
{`// ❌ 기존 (오류 발생)
const domain = {
  verifyingContract: userEOAAddress // EOA 주소 사용
};

// ✅ 수정 (정상 작동)
const smartAccountAddress = await sdk.getSmartAccountAddress();
const domain = {
  verifyingContract: smartAccountAddress // Smart Account 주소 사용
};`}
          </pre>
        </div>

        <div className="p-3 bg-purple-50 border border-purple-200 rounded">
          <h5 className="font-semibold text-purple-800 mb-2">🏗️ Smart Account 주소 생성 방식:</h5>
          <div className="text-xs text-purple-700 space-y-1">
            <p><strong>1. Create2 Deterministic:</strong> Factory + Salt + InitCodeHash</p>
            <p><strong>2. Registry 조회:</strong> Smart Account Registry 컨트랙트</p>
            <p><strong>3. Proxy Pattern:</strong> Minimal Proxy + Implementation</p>
            <p><strong>4. 현재 구현:</strong> EOA 기반 deterministic 주소 생성</p>
          </div>
        </div>

        <div className="p-3 bg-gray-50 border border-gray-200 rounded">
          <h5 className="font-semibold text-gray-800 mb-2">📋 Account Abstraction 흐름:</h5>
          <ol className="text-xs text-gray-700 list-decimal list-inside space-y-0.5">
            <li>EOA (사용자 지갑) 연결</li>
            <li>Smart Account 주소 계산/조회</li>
            <li>UserOperation 생성 (sender = Smart Account)</li>
            <li>EIP-712 서명 (verifyingContract = Smart Account)</li>
            <li>Bundler로 전송</li>
            <li>EntryPoint에서 Smart Account 실행</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
