'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
} from 'wagmi';
import { getWalletClient, getPublicClient } from '@wagmi/core';
import { config } from '@/wagmi.config';
import { parseEther, formatEther } from 'viem';
import { toast } from 'sonner';
import { injected } from 'wagmi/connectors';
import { useLocale } from '@/contexts/LocaleContext';

// Admin 예치 지원 체인
const ADMIN_CHAIN_IDS = [8453, 56, 43114, 91342] as const;
type AdminChainId = (typeof ADMIN_CHAIN_IDS)[number];

const ADMIN_CHAINS = [
  { chainId: 8453, label: 'BASE', nativeToken: 'ETH', envKey: 'NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_BASE' as const },
  { chainId: 56, label: 'BNB', nativeToken: 'BNB', envKey: 'NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_BNB' as const },
  { chainId: 43114, label: 'AVAX', nativeToken: 'AVAX', envKey: 'NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_AVALANCHE' as const },
  { chainId: 91342, label: 'GIWA Sepolia', nativeToken: 'ETH', envKey: 'NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_GIWA_SEPOLIA' as const },
] as const;

// Next.js는 process.env.XXX 같은 정적 참조만 빌드 시 인라인함. 동적 키(process.env[key])는 인라인되지 않음.
function getContractAddress(chainId: number): `0x${string}` | null {
  let addr: string | undefined;
  switch (chainId) {
    case 8453:
      addr = process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_BASE;
      break;
    case 56:
      addr = process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_BNB;
      break;
    case 43114:
      addr = process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_AVALANCHE;
      break;
    case 91342:
      addr = process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_GIWA_SEPOLIA;
      break;
    default:
      return null;
  }
  if (!addr?.trim()) return null;
  const trimmed = addr.trim();
  return (trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`) as `0x${string}`;
}

const CONTRACT_ABI = [
  {
    inputs: [],
    name: 'depositNative',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'withdrawNative',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getNativeDepositPool',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'admin',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export function AdminDepositPage() {
  const { t } = useLocale();
  const { address, status: accountStatus } = useAccount();
  // 재연결 중에는 연결된 것처럼 보이지 않도록
  const isConnected = accountStatus === 'connected' && !!address;
  const { connect, connectors, status: connectStatus, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const [mounted, setMounted] = useState(false);
  const [selectedChainId, setSelectedChainId] = useState<AdminChainId>(43114); // 기본: AVAX
  const [depositAmount, setDepositAmount] = useState('1');
  const [withdrawAmount, setWithdrawAmount] = useState('0.1');
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  useEffect(() => setMounted(true), []);

  const isConnecting = connectStatus === 'pending';

  const selectedChain = useMemo(() => ADMIN_CHAINS.find((c) => c.chainId === selectedChainId), [selectedChainId]);
  const contractAddress = useMemo(() => getContractAddress(selectedChainId), [selectedChainId]);

  const canReadContract = !!contractAddress;
  const chainNotDeployed = selectedChain && !contractAddress;

  // 관리자 주소 확인
  const {
    data: adminAddress,
    error: adminError,
    isLoading: isLoadingAdmin,
  } = useReadContract({
    address: contractAddress ?? undefined,
    abi: CONTRACT_ABI,
    functionName: 'admin',
    chainId: selectedChainId,
    query: { enabled: canReadContract },
  });

  // 공유 풀 잔액 조회
  const {
    data: poolBalance,
    error: poolBalanceError,
    refetch: refetchPoolBalance,
  } = useReadContract({
    address: contractAddress ?? undefined,
    abi: CONTRACT_ABI,
    functionName: 'getNativeDepositPool',
    chainId: selectedChainId,
    query: { enabled: canReadContract, refetchInterval: 5000 },
  });

  // 관리자 주소 (임시 하드코딩 - 컨트랙트 재배포 전까지 사용)
  // 2026-06: 이전 키(0x39f1E010..212D) 탈취(EIP-7702 스위퍼)로 폐기 → 본인 지갑으로 교체
  const EXPECTED_ADMIN_ADDRESS = '0xb891EA232e0AA00319FC9e0985b119Cd40b54693';

  // 컨트랙트에서 읽은 관리자 주소가 있으면 사용, 없으면 하드코딩된 주소 사용
  const actualAdminAddress = adminAddress || EXPECTED_ADMIN_ADDRESS;
  const isAdmin = address && address.toLowerCase() === actualAdminAddress.toLowerCase();

  // 지갑 연결: 연결 전에 MetaMask 계정 선택창을 강제로 띄워, 이미 연결돼 있어도
  // 원하는 관리자 계정(0xb891)을 매번 직접 고를 수 있게 한다.
  const handleConnect = useCallback(async () => {
    // 지갑이 여러 개 설치된 환경에서 window.ethereum이 MetaMask가 아닐 수 있으므로
    // EIP-6963로 발견된 MetaMask 커넥터를 명시적으로 선택한다.
    const metaMaskConnector =
      connectors.find((c) => c.id === 'io.metamask') ||
      connectors.find((c) => /metamask/i.test(c.name)) ||
      connectors.find((c) => c.id === 'metaMaskSDK' || c.type === 'metaMask');
    const connector = metaMaskConnector || connectors.find((c) => c.id === 'injected') || injected();

    // MetaMask 공급자에 직접 권한 재요청 → 계정 선택 팝업 표시 (다른 지갑 무시)
    try {
      const provider = (await metaMaskConnector?.getProvider()) as
        | { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
        | undefined;
      if (provider?.request) {
        await provider.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
      }
    } catch {
      // 사용자가 선택창을 닫음(취소) → 연결 중단
      return;
    }

    // 기존 연결을 끊고 새로 연결해야 방금 고른 계정이 반영됨
    if (isConnected) {
      try {
        disconnect();
      } catch {
        /* ignore */
      }
    }
    connect({ connector });
  }, [connect, connectors, disconnect, isConnected]);

  // 연결 해제
  const handleDisconnect = useCallback(() => {
    disconnect();
    toast.success(t('admin.walletDisconnected'));
  }, [disconnect, t]);

  // Wagmi + MetaMask(가능한 범위) 초기화
  const handleResetAll = useCallback(() => {
    if (typeof window === 'undefined') return;

    // 1. Wagmi: localStorage에서 wagmi 관련 키 전부 삭제
    const removed: string[] = [];
    Object.keys(localStorage).forEach((key) => {
      if (key.toLowerCase().includes('wagmi')) {
        localStorage.removeItem(key);
        removed.push(key);
      }
    });

    // 2. sessionStorage 정리
    sessionStorage.clear();

    // 3. 현재 연결 해제
    try {
      disconnect();
    } catch (e) {
      // ignore
    }

    // 4. MetaMask: 권한 해제 시도 (지원하는 클라이언트만 동작)
    if (window.ethereum?.request) {
      window.ethereum
        .request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        } as any)
        .catch(() => {});
    }

    toast.success(t('admin.resetSuccess'), { duration: 8000 });
    // 5. 페이지 새로고침해서 wagmi 상태 깨끗하게
    setTimeout(() => window.location.reload(), 1500);
  }, [disconnect, t]);

  // 예치 함수
  const handleDeposit = useCallback(async () => {
    if (!address) {
      toast.error(t('toast.connectFirst'));
      return;
    }
    if (!contractAddress || !selectedChain) {
      toast.error('이 체인은 아직 배포되지 않았습니다.');
      return;
    }

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('toast.validAmount'));
      return;
    }

    setIsDepositing(true);
    try {
      await switchChainAsync({ chainId: selectedChainId });

      const walletClient = await getWalletClient(config);
      const publicClient = getPublicClient(config, { chainId: selectedChainId });
      if (!walletClient || !publicClient) {
        toast.error(t('toast.connectFirst'));
        return;
      }

      const amountWei = parseEther(depositAmount);
      const token = selectedChain.nativeToken;
      toast.info(`${depositAmount} ${token}를 예치합니다...`);

      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'depositNative',
        value: amountWei,
      });

      await publicClient.waitForTransactionReceipt({ hash });
      toast.success(`${depositAmount} ${token} 예치가 완료되었습니다!`);
      setDepositAmount('1');
      refetchPoolBalance();
    } catch (err: unknown) {
      let msg = '예치에 실패했습니다.';
      if (err instanceof Error && typeof err.message === 'string') msg = err.message;
      else if (typeof err === 'string') msg = err;
      else if (err && typeof err === 'object' && 'shortMessage' in err && typeof (err as any).shortMessage === 'string') msg = (err as any).shortMessage;
      toast.error(msg);
      console.error('Deposit error:', err);
    } finally {
      setIsDepositing(false);
    }
  }, [
    address,
    depositAmount,
    contractAddress,
    selectedChain,
    selectedChainId,
    switchChainAsync,
    refetchPoolBalance,
    t,
  ]);

  // 출금 함수
  const handleWithdraw = useCallback(async () => {
    if (!address) {
      toast.error(t('toast.connectFirst'));
      return;
    }
    if (!contractAddress || !selectedChain) {
      toast.error('이 체인은 아직 배포되지 않았습니다.');
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('toast.validAmount'));
      return;
    }

    setIsWithdrawing(true);
    try {
      await switchChainAsync({ chainId: selectedChainId });

      const walletClient = await getWalletClient(config);
      const publicClient = getPublicClient(config, { chainId: selectedChainId });
      if (!walletClient || !publicClient) {
        toast.error(t('toast.connectFirst'));
        return;
      }

      const amountWei = parseEther(withdrawAmount);
      const token = selectedChain.nativeToken;
      toast.info(`${withdrawAmount} ${token}를 출금합니다...`);

      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'withdrawNative',
        args: [amountWei],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      toast.success(`${withdrawAmount} ${token} 출금이 완료되었습니다!`);
      setWithdrawAmount('0.1');
      refetchPoolBalance();
    } catch (err: unknown) {
      let msg = '출금에 실패했습니다.';
      if (err instanceof Error && typeof err.message === 'string') msg = err.message;
      else if (typeof err === 'string') msg = err;
      else if (err && typeof err === 'object' && 'shortMessage' in err && typeof (err as any).shortMessage === 'string') msg = (err as any).shortMessage;
      toast.error(msg);
      console.error('Withdraw error:', err);
    } finally {
      setIsWithdrawing(false);
    }
  }, [
    address,
    withdrawAmount,
    contractAddress,
    selectedChain,
    selectedChainId,
    switchChainAsync,
    refetchPoolBalance,
    t,
  ]);

  return (
    <div className="relative z-[1] min-h-screen bg-[#0f172a] text-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold mb-2">{t('admin.title')}</h1>
          <p className="text-[#94a3b8]">{t('admin.subtitle')}</p>
        </div>

        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-[#94a3b8] mb-1">{t('admin.connectedWallet')}</p>
              <p className="font-mono text-lg break-all">{isConnected ? address : t('admin.notConnected')}</p>
              {isConnected && address && (
                <p className="text-xs text-[#64748b] mt-1">
                  {isAdmin ? '✓ 관리자 지갑' : '✗ 관리자 지갑이 아님'}
                </p>
              )}
            </div>
            {isConnected ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleDisconnect}
                    className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors"
                  >
                    {t('admin.disconnect')}
                  </button>
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConnecting ? t('admin.connecting') : t('admin.changeAccount')}
                  </button>
                  <button
                    onClick={handleResetAll}
                    className="px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 transition-colors text-amber-200 text-sm"
                    title={t('admin.resetSuccess')}
                  >
                    🧹 {t('admin.resetWagmi')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isConnecting ? t('admin.connecting') : t('connectWallet')}
                  </button>
                  <button
                    onClick={handleResetAll}
                    className="px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 transition-colors text-amber-200 text-sm"
                    title={t('admin.resetSuccess')}
                  >
                    🧹 {t('admin.resetWagmi')}
                  </button>
                </div>
                <p className="text-xs text-[#94a3b8] max-w-xs">
                  MetaMask에서 사용할 계정을 먼저 선택한 후 버튼을 클릭하세요. 연결 시 MetaMask 팝업이 뜹니다.
                </p>
                {connectError && (
                  <p className="text-xs text-red-400">
                    {connectError.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 왜 다른 주소가 나오나요? */}
          <details className="mt-4 p-3 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
            <summary className="text-sm text-[#94a3b8] cursor-pointer hover:text-white">
              왜 선택하지 않은 주소(예: 0xf0245...5380)가 계속 나오나요?
            </summary>
            <div className="mt-3 text-xs text-[#94a3b8] space-y-2">
              <p>
                그 주소는 <strong className="text-white">우리 코드에 없습니다</strong>. 두 가지가 합쳐진 결과입니다.
              </p>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  <strong className="text-white">Wagmi</strong>가 브라우저(localStorage)에 마지막 연결 계정을 저장하고, 페이지를 열 때마다 <strong>자동 재연결</strong>합니다.
                </li>
                <li>
                  <strong className="text-white">MetaMask</strong>는 “지금 선택된 계정” 하나만 사이트에 알려줍니다. 목록의 첫 번째이거나, 예전에 이 사이트에 연결했던 계정이 그대로 선택된 상태라면 그 주소가 나옵니다.
                </li>
              </ol>
              <p className="text-amber-200/90 font-medium mt-2">해결 방법 (한 번만 하면 됨)</p>
              <ol className="list-decimal list-inside space-y-1 text-[#94a3b8]">
                <li>MetaMask 확장 프로그램 열기 → 우측 상단 점 3개(⋮) → <strong>설정</strong></li>
                <li><strong>연결된 사이트</strong> → 이 사이트(localhost 등) 찾기 → <strong>연결 해제</strong></li>
                <li>MetaMask 상단에서 <strong>관리자로 쓸 계정</strong>을 클릭해 선택</li>
                <li>이 페이지에서 <strong>지갑 연결</strong> 클릭 → 팝업에서 다시 연결</li>
              </ol>
            </div>
          </details>

          {/* 관리자 확인 */}
          {isConnected && (
            <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.08)] space-y-2">
              {isLoadingAdmin ? (
                <div className="text-yellow-400">관리자 주소 확인 중...</div>
              ) : adminError ? (
                <div className="space-y-2">
                  <div className="text-red-400">
                    <span>✗</span> 컨트랙트에서 관리자 주소를 읽을 수 없습니다.
                  </div>
                  <div className="text-xs text-[#64748b]">
                    <p>에러: {adminError.message}</p>
                    <p className="mt-1">
                      현재 컨트랙트가 이전 버전일 수 있습니다. 관리자 기능을 사용하려면 새 버전의
                      컨트랙트를 배포해야 합니다.
                    </p>
                    <p className="mt-1 font-mono text-xs">컨트랙트 주소: {contractAddress ?? '(미설정)'}</p>
                  </div>
                </div>
              ) : isAdmin ? (
                <div className="flex items-center gap-2 text-green-400">
                  <span>✓</span>
                  <span>관리자 권한이 확인되었습니다.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-400">
                    <span>✗</span>
                    <span>관리자 지갑이 아닙니다.</span>
                  </div>
                  <div className="text-xs text-[#64748b] space-y-1">
                    <p>연결된 지갑: {address}</p>
                    <p>
                      컨트랙트의 관리자 주소:{' '}
                      {adminAddress || '컨트랙트에서 읽을 수 없음 (이전 버전일 수 있음)'}
                    </p>
                    <p className="mt-2 text-yellow-400">
                      예상 관리자 주소: {EXPECTED_ADMIN_ADDRESS}
                    </p>
                    {adminError && (
                      <p className="text-red-400 mt-1">
                        ⚠️ 컨트랙트에 admin 함수가 없습니다. 새 버전의 컨트랙트를 배포해야 합니다.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 체인 선택 */}
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 mb-6">
          <p className="text-sm text-[#94a3b8] mb-3">예치할 체인 선택</p>
          <div className="flex flex-wrap gap-2">
            {ADMIN_CHAINS.map((c) => {
              const hasContract = mounted ? !!getContractAddress(c.chainId) : true;
              const isSelected = selectedChainId === c.chainId;
              return (
                <button
                  key={c.chainId}
                  type="button"
                  onClick={() => setSelectedChainId(c.chainId)}
                  className={`px-4 py-2 rounded-xl font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-500/30 border border-blue-400 text-white'
                      : hasContract
                        ? 'bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.15)] hover:border-blue-500/50 text-[#94a3b8]'
                        : 'bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.15)] hover:border-blue-500/50 text-[#64748b]'
                  }`}
                >
                  {c.label}
                  {!hasContract && mounted && <span className="ml-1 text-xs opacity-75">(미배포)</span>}
                </button>
              );
            })}
          </div>
          {chainNotDeployed && (
            <p className="text-amber-400/90 text-sm mt-3">
              ⚠️ {selectedChain?.label} 체인은 아직 컨트랙트가 배포되지 않았습니다. 다른 체인을 선택하세요.
            </p>
          )}
        </div>

        {/* 예치 풀 잔액 */}
        <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 mb-6">
          <p className="text-sm text-[#94a3b8] mb-2">
            공유 예치 풀 잔액 ({selectedChain?.label})
          </p>
          {!contractAddress ? (
            <p className="text-amber-400/90">이 체인은 아직 배포되지 않았습니다.</p>
          ) : poolBalanceError ? (
            <div className="space-y-2">
              <p className="text-red-400">⚠️ 풀 잔액을 읽을 수 없습니다</p>
              <p className="text-xs text-[#64748b]">에러: {poolBalanceError.message}</p>
              <p className="text-xs text-yellow-400 mt-2">
                현재 컨트랙트가 이전 버전일 수 있습니다. 새 버전의 컨트랙트를 배포해야 합니다.
              </p>
            </div>
          ) : (
            <>
              <p className="text-3xl font-extrabold">
                {poolBalance !== undefined ? formatEther(poolBalance) : '0'} {selectedChain?.nativeToken ?? ''}
              </p>
              <p className="text-xs text-[#64748b] mt-2">
                {poolBalance !== undefined && poolBalance <= parseEther('0.001')
                  ? '⚠️ 서비스가 중지되었습니다. 예치가 필요합니다.'
                  : '✓ 서비스 정상 운영 중'}
              </p>
            </>
          )}
        </div>

        {/* 컨트랙트 버전 경고 */}
        {adminError && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-bold text-yellow-400 mb-2">⚠️ 컨트랙트 재배포 필요</h3>
            <p className="text-sm text-[#94a3b8] mb-4">
              현재 컨트랙트가 이전 버전입니다. 관리자 기능을 사용하려면 새 버전의 컨트랙트를
              배포해야 합니다.
            </p>
            <div className="bg-[rgba(0,0,0,0.3)] rounded-lg p-4 font-mono text-xs space-y-2">
              <p className="text-white">배포 명령어:</p>
              <code className="block text-green-400">
                cd AD-wallet-SDK/contracts
                <br />
                npm run deploy:sponsored-transfer:avalanche
              </code>
              <p className="text-white mt-4">배포 후:</p>
              <code className="block text-green-400">.env.local에 새 컨트랙트 주소 업데이트</code>
            </div>
          </div>
        )}

        {/* 예치 섹션 */}
        {isConnected && (
          <>
            <div className="relative z-10 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">예치 ({selectedChain?.label})</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#94a3b8] mb-2">예치할 금액 ({selectedChain?.nativeToken ?? '토큰'})</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-white placeholder-[#64748b] focus:outline-none focus:border-blue-500/50"
                    placeholder="1.0"
                  />
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); if (!isDepositing) handleDeposit(); }}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isDepositing) { e.preventDefault(); handleDeposit(); } }}
                  className={`w-full py-3 rounded-xl bg-gradient-to-b from-green-600 to-green-700 border border-green-500/30 text-center font-bold cursor-pointer select-none transition-all hover:from-green-500 hover:to-green-600 active:scale-[0.98] ${isDepositing ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  {isDepositing ? '예치 중...' : '예치하기'}
                </div>
              </div>
            </div>

            {/* 출금 섹션 */}
            <div className="relative z-10 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4">출금 ({selectedChain?.label})</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#94a3b8] mb-2">출금할 금액 ({selectedChain?.nativeToken ?? '토큰'})</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-white placeholder-[#64748b] focus:outline-none focus:border-blue-500/50"
                    placeholder="0.1"
                  />
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); if (!isWithdrawing) handleWithdraw(); }}
                  onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isWithdrawing) { e.preventDefault(); handleWithdraw(); } }}
                  className={`w-full py-3 rounded-xl bg-gradient-to-b from-red-600 to-red-700 border border-red-500/30 text-center font-bold cursor-pointer select-none transition-all hover:from-red-500 hover:to-red-600 active:scale-[0.98] ${isWithdrawing ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  {isWithdrawing ? '출금 중...' : '출금하기'}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
