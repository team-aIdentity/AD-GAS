'use client';

/**
 * 형태 1: 지갑 연결 → 연결 네트워크 토큰 잔액 확인 → 보낼 주소·토큰·수량 입력 → (광고 시청) → 가스비 대납 전송
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAccount, usePublicClient, useWalletClient, useBalance } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { GaslessSDK, type AdTrigger } from '../../../src';
import { useGoogleRewardedAd } from '../hooks/useGoogleRewardedAd';

// 체인별 네이티브 토큰 심볼 (wagmi chain.nativeCurrency.symbol 보강용)
const CHAIN_SYMBOL: Record<number, string> = {
  1: 'ETH',
  11155111: 'ETH',
  8453: 'ETH',
  43114: 'AVAX',
};

// 기획서 2.2 예외 시나리오 메시지
const MESSAGES = {
  AD_INCOMPLETE: '광고를 끝까지 시청해 주세요.',
  GAS_LIMIT: '오늘 한도가 소진되었습니다. 내일 다시 시도하거나 네이티브로 가스비를 결제해 주세요.',
  PAYMASTER_FUNDS: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  NETWORK: '네트워크가 지연되고 있습니다. 잠시 후 다시 시도해 주세요.',
  GENERIC: '트랜잭션에 실패했습니다. 다시 시도해 주세요.',
};

function mapErrorToMessage(error: Error): string {
  const msg = error.message.toLowerCase();
  if (msg.includes('ad') || msg.includes('not completed') || msg.includes('cancelled')) return MESSAGES.AD_INCOMPLETE;
  if (msg.includes('limit') || msg.includes('quota') || msg.includes('한도')) return MESSAGES.GAS_LIMIT;
  if (msg.includes('insufficient') || msg.includes('balance') || msg.includes('fund')) return MESSAGES.PAYMASTER_FUNDS;
  if (msg.includes('timeout') || msg.includes('network') || msg.includes('econnrefused')) return MESSAGES.NETWORK;
  return MESSAGES.GENERIC;
}

interface TransactionData {
  to: string;
  value: string;
  data?: string;
}

export function Form1TransferUI() {
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [sdk, setSdk] = useState<GaslessSDK | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const [transactionData, setTransactionData] = useState<TransactionData>({
    to: '',
    value: '0.0001',
    data: '0x',
  });
  const [isTransacting, setIsTransacting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [saAddress, setSaAddress] = useState<string | null>(null);

  // Google AdMob/Publisher Tag 리워드 광고 (웹: GPT). 설정 시 실제 광고 표시
  const { showRewardedAd, isConfigured: isGoogleAdConfigured } = useGoogleRewardedAd();
  const googleShowAdRef = useRef(showRewardedAd);
  const googleConfiguredRef = useRef(isGoogleAdConfigured);
  googleShowAdRef.current = showRewardedAd;
  googleConfiguredRef.current = isGoogleAdConfigured;

  // 데모용: 광고 시청 UI (Google 미설정 시 사용)
  const [showAdModal, setShowAdModal] = useState(false);
  const adResolveRef = useRef<(() => void) | null>(null);
  const adRejectRef = useRef<((err: Error) => void) | null>(null);
  const adTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolveAd = useCallback(() => {
    if (adResolveRef.current) {
      adResolveRef.current();
      adResolveRef.current = null;
      adRejectRef.current = null;
      if (adTimeoutRef.current) {
        clearTimeout(adTimeoutRef.current);
        adTimeoutRef.current = null;
      }
      setShowAdModal(false);
    }
  }, []);

  // SDK 초기화 + 형태 1 AdTrigger 설정
  useEffect(() => {
    if (!isConnected || !publicClient || !walletClient?.account || !walletClient?.chain) {
      setSdk(null);
      setInitError(null);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_BICONOMY_API_KEY;
    if (!apiKey) {
      setInitError('Biconomy API Key가 설정되지 않았습니다.');
      return;
    }

    setIsInitializing(true);
    setInitError(null);

    (async () => {
      try {
        const instance = await GaslessSDK.initialize({
          publicClient,
          walletClient,
          apiKey,
        });

        const trigger: AdTrigger = {
          async beforeTransaction() {
            // Google 리워드 광고(GPT) 설정 시 실제 광고 표시
            if (googleConfiguredRef.current && googleShowAdRef.current) {
              await googleShowAdRef.current();
              return;
            }
            // 미설정 시 데모 모달
            return new Promise((resolve, reject) => {
              adResolveRef.current = resolve;
              adRejectRef.current = reject;
              setShowAdModal(true);
              adTimeoutRef.current = setTimeout(() => {
                if (adRejectRef.current) {
                  adRejectRef.current(new Error('Ad was not completed. Transaction cancelled.'));
                  adResolveRef.current = null;
                  adRejectRef.current = null;
                  setShowAdModal(false);
                }
                adTimeoutRef.current = null;
              }, 30000);
            });
          },
          async afterTransaction(hash) {
            console.log('형태1 트랜잭션 성공:', hash);
          },
          onError(err) {
            console.error('형태1 에러:', err);
          },
        };
        instance.setAdTrigger(trigger);
        setSdk(instance);

        // Smart Account 주소 저장 (잔액 조회 등에 사용)
        const addr = instance.getSmartAccountAddress(walletClient.chain.id);
        setSaAddress(addr || null);
      } catch (err) {
        setInitError(err instanceof Error ? err.message : 'SDK 초기화 실패');
        setSdk(null);
      } finally {
        setIsInitializing(false);
      }
    })();
  }, [isConnected, publicClient, walletClient]);

  const chainSymbol =
    (walletClient?.chain?.id && CHAIN_SYMBOL[walletClient.chain.id]) ||
    walletClient?.chain?.nativeCurrency?.symbol ||
    'ETH';
  const chainName = walletClient?.chain?.name ?? '연결된 네트워크';

  // 지갑(EOA) 잔액
  const {
    data: eoaBalanceData,
    isLoading: eoaBalanceLoading,
  } = useBalance({
    address: address,
    chainId: walletClient?.chain?.id,
    query: { enabled: !!address && !!walletClient?.chain?.id },
  });
  const rawEoaBalance = eoaBalanceData?.value ?? null;
  const formattedEoaBalance =
    rawEoaBalance !== null ? Number(formatEther(rawEoaBalance)).toFixed(4) : null;

  // Smart Account 잔액 (가스리스 전송 시 실제 출금 계정)
  const {
    data: saBalanceData,
    isLoading: saBalanceLoading,
  } = useBalance({
    address: saAddress as `0x${string}` | undefined,
    chainId: walletClient?.chain?.id,
    query: { enabled: !!saAddress && !!walletClient?.chain?.id },
  });
  const rawSaBalance = saBalanceData?.value ?? null;
  const formattedSaBalance =
    rawSaBalance !== null ? Number(formatEther(rawSaBalance)).toFixed(4) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sdk || !transactionData.to || !transactionData.value) return;

    const valueWei = parseEther(transactionData.value);
    // 실제 출금 계정은 Smart Account 이므로 Smart Account 잔액 기준으로 검사
    if (rawSaBalance !== null && valueWei > rawSaBalance) {
      setUserError('잔액이 부족합니다.');
      return;
    }

    setIsTransacting(true);
    setUserError(null);
    setTxHash(null);

    try {
      const hash = await sdk.sendGaslessTransaction({
        to: transactionData.to as `0x${string}`,
        value: valueWei,
        data: (transactionData.data || '0x') as `0x${string}`,
      });
      setTxHash(hash);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setUserError(mapErrorToMessage(error));
    } finally {
      setIsTransacting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="w-full p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-amber-800 text-center">
          지갑을 연결하면 「광고 보고 무료 전송」을 사용할 수 있습니다.
        </p>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div className="w-full p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
        <span className="text-blue-800">형태 1 SDK 초기화 중...</span>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 font-medium">SDK 초기화 실패</p>
        <p className="text-red-700 text-sm mt-1">{initError}</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div>
        <h3 className="text-xl font-bold text-gray-900">가스비 대납 전송</h3>
        <p className="text-gray-600 text-sm mt-1">
          연결된 네트워크 토큰을 보냅니다. 광고 시청 후 가스비 없이 전송됩니다.
        </p>
        {isGoogleAdConfigured && (
          <p className="text-xs text-green-600 mt-1">Google 리워드 광고 연동됨</p>
        )}
      </div>

      {/* 연결 네트워크 & 잔액 (EOA + Smart Account) */}
      <div className="p-4 bg-gray-50 rounded-lg space-y-2">
        <p className="text-sm font-medium text-gray-700">연결 네트워크</p>
        <p className="text-gray-900 font-medium">{chainName}</p>
        {/* EOA 잔액 */}
        <div className="mt-2">
          <p className="text-xs font-medium text-gray-700">지갑(EOA) 잔액</p>
          {eoaBalanceLoading ? (
            <p className="text-xs text-gray-500">조회 중...</p>
          ) : formattedEoaBalance !== null ? (
            <p className="text-sm font-semibold text-gray-900">
              {formattedEoaBalance} <span className="text-gray-600">{chainSymbol}</span>
            </p>
          ) : (
            <p className="text-xs text-gray-500">-</p>
          )}
          <p className="font-mono text-[10px] text-gray-500 break-all mt-0.5">
            {address ?? '-'}
          </p>
        </div>
        {/* Smart Account 잔액 */}
        <div className="mt-2">
          <p className="text-xs font-medium text-gray-700">
            스마트 계정(Smart Account) 잔액 (가스리스 전송 출금 계정)
          </p>
          {saBalanceLoading ? (
            <p className="text-xs text-gray-500">조회 중...</p>
          ) : formattedSaBalance !== null ? (
            <p className="text-sm font-semibold text-gray-900">
              {formattedSaBalance} <span className="text-gray-600">{chainSymbol}</span>
            </p>
          ) : (
            <p className="text-xs text-gray-500">-</p>
          )}
          <p className="font-mono text-[10px] text-gray-500 break-all mt-0.5">
            {saAddress ?? '-'}
          </p>
        </div>
      </div>

      {/* 보낼 주소 · 토큰 · 수량 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">보낼 지갑 주소</label>
          <input
            type="text"
            value={transactionData.to}
            onChange={e => setTransactionData(prev => ({ ...prev, to: e.target.value.trim() }))}
            placeholder="0x..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">보낼 토큰</label>
          <div className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700">
            {chainSymbol} (네이티브)
          </div>
          <p className="text-xs text-gray-500 mt-1">현재는 연결된 네트워크의 네이티브 토큰만 전송 가능합니다.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">보낼 수량 ({chainSymbol})</label>
          <input
            type="text"
            value={transactionData.value}
            onChange={e => setTransactionData(prev => ({ ...prev, value: e.target.value }))}
            placeholder="0.001"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
          {rawSaBalance !== null && (
            <button
              type="button"
              onClick={() =>
                setTransactionData(prev => ({
                  ...prev,
                  value: Number(formatEther(rawSaBalance)).toFixed(4),
                }))
              }
              className="text-xs text-indigo-600 hover:underline mt-1"
            >
              전액 사용
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={isTransacting || !sdk || saBalanceLoading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
        >
          {isTransacting ? '광고 시청 후 전송 중...' : '광고 보고 가스비 없이 전송하기'}
        </button>
      </form>

      {userError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{userError}</p>
        </div>
      )}

      {txHash && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 font-medium mb-1">전송 완료</p>
          <p className="font-mono text-xs text-green-700 break-all">TxHash: {txHash}</p>
        </div>
      )}

      {/* 데모용 광고 시청 모달 */}
      {showAdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h4 className="font-bold text-gray-900 mb-2">광고 시청</h4>
            <p className="text-gray-600 text-sm mb-4">
              데모: 아래 버튼을 누르면 광고 시청 완료로 간주하고 무료 전송을 진행합니다.
              (실제 연동 시 AdMob 등으로 교체)
            </p>
            <button
              type="button"
              onClick={resolveAd}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg"
            >
              시청 완료 후 전송하기
            </button>
            <p className="text-xs text-gray-500 mt-3 text-center">
              이탈 시 전송이 취소됩니다. (기획서: 광고를 끝까지 시청해 주세요)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
