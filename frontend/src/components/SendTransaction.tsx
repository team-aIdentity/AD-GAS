'use client';

import React, { useState } from 'react';
import { useSendTransaction, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { parseEther, formatEther } from 'viem';

interface SendTransactionProps {
  address: string;
}

export function SendTransaction({ address }: SendTransactionProps) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const { data: balance } = useBalance({
    address: address as `0x${string}`,
  });

  const {
    data: hash,
    sendTransaction,
    isPending: isSending,
    error: sendError,
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!to || !amount) {
      return;
    }

    try {
      await sendTransaction({
        to: to as `0x${string}`,
        value: parseEther(amount),
      });
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  };

  const resetForm = () => {
    setTo('');
    setAmount('');
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors duration-200"
      >
        💸 송금하기
      </button>
    );
  }

  return (
    <div className="w-full space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-blue-900">송금하기</h4>
        <button onClick={() => setIsOpen(false)} className="text-blue-500 hover:text-blue-700">
          ✕
        </button>
      </div>

      {/* 잔액 표시 */}
      <div className="p-3 bg-white rounded border">
        <p className="text-sm text-gray-600 mb-1">현재 잔액:</p>
        <p className="font-mono text-lg font-semibold">
          {balance ? `${formatEther(balance.value)} ${balance.symbol}` : '로딩 중...'}
        </p>
      </div>

      {/* 송금 폼 */}
      <form onSubmit={handleSend} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">받는 주소:</label>
          <input
            type="text"
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* 빠른 금액 선택 */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAmount('0.001')}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
          >
            0.001 ETH
          </button>
          <button
            type="button"
            onClick={() => setAmount('0.01')}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
          >
            0.01 ETH
          </button>
          <button
            type="button"
            onClick={() => setAmount('0.1')}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
          >
            0.1 ETH
          </button>
        </div>

        {/* 송금 버튼 */}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSending || isConfirming || !to || !amount}
            className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors duration-200"
          >
            {isSending ? '전송 중...' : isConfirming ? '확인 중...' : '송금하기'}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors duration-200"
          >
            취소
          </button>
        </div>
      </form>

      {/* 트랜잭션 상태 */}
      {hash && (
        <div className="p-3 bg-white border border-green-200 rounded">
          <p className="text-sm font-medium text-green-800 mb-1">트랜잭션 해시:</p>
          <p className="font-mono text-xs break-all text-green-700">{hash}</p>

          {isConfirmed && (
            <div className="mt-2 p-2 bg-green-50 rounded">
              <p className="text-sm text-green-800 font-medium">
                ✅ 트랜잭션이 성공적으로 완료되었습니다!
              </p>
            </div>
          )}
        </div>
      )}

      {/* 오류 메시지 */}
      {sendError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-800 font-medium">오류:</p>
          <p className="text-sm text-red-700">{sendError.message}</p>
        </div>
      )}
    </div>
  );
}
