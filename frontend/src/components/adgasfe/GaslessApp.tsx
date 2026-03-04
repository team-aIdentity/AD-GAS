'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useWalletClient,
  useSwitchChain,
  useBalance,
  usePublicClient,
  useWriteContract,
} from 'wagmi';
import {
  formatUnits,
  parseUnits,
  encodePacked,
  keccak256,
  getAddress,
  maxUint256,
} from 'viem';
import { Toaster } from 'sonner';
import { toast } from 'sonner';
import { AdWalletRelayerSDK } from '../../../../src';
import { SUPPORTED_NETWORKS } from '@/lib/networks';
import { TOKEN_ADDRESSES, TOKEN_INFO, PERMIT_TOKEN_CONFIG } from '@/lib/tokens';
import { erc20Abi } from 'viem';
import type { Network, Token } from '@/types/adgasfe';
import { Header } from './Header';
import { TabNavigation } from './TabNavigation';
import { NetworkSection } from './NetworkSection';
import { BalanceSection } from './BalanceSection';
import { TransferSection } from './TransferSection';
import { AdModal } from './AdModal';
import { TransactionModal } from './TransactionModal';
import { TransactionCompleteModal } from './TransactionCompleteModal';
import { MobileHeader } from './mobile/MobileHeader';
import { MobileNetworkSection } from './mobile/MobileNetworkSection';
import { MobileGasSavings } from './mobile/MobileGasSavings';
import { MobileTransferForm } from './mobile/MobileTransferForm';
import { useLocale } from '@/contexts/LocaleContext';

const DAILY_LIMIT = 5;

function detectMobileLayout(): boolean {
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua) || /iphone|ipad|ipod/i.test(ua)) {
      return true;
    }
  }
  if (typeof window !== 'undefined') {
    return window.innerWidth < 1024;
  }
  return false;
}

function getErrorKey(error: Error): string {
  const msg = error.message.toLowerCase();
  if (
    msg.includes('ad not completed') ||
    msg.includes('ad was not completed') ||
    msg.includes('ad incomplete') ||
    msg.includes('advertisement') ||
    msg.includes('광고')
  )
    return 'errors.adIncomplete';
  if (msg.includes('limit') || msg.includes('quota') || msg.includes('한도')) return 'errors.gasLimit';
  if (msg.includes('insufficient') || msg.includes('balance') || msg.includes('fund'))
    return 'errors.paymasterFunds';
  if (msg.includes('timeout') || msg.includes('network') || msg.includes('econnrefused'))
    return 'errors.network';
  return '';
}

function getFreeTransactionsUsed(): number {
  if (typeof window === 'undefined') return 0;
  const today = new Date().toDateString();
  const stored = localStorage.getItem('adGas_usage');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.date === today) return parsed.count;
    } catch {
      /* ignore */
    }
  }
  return 0;
}

export function GaslessApp() {
  const { t } = useLocale();
  const { address, status: accountStatus } = useAccount();
  // 재연결(reconnecting) 중에는 캐시된 주소가 보이지 않도록, 실제 연결됐을 때만 연결 상태 표시
  const isConnected = accountStatus === 'connected' && !!address;
  const { connectors, connect, status: connectStatus } = useConnect();
  const { disconnect } = useDisconnect();

  const mapErrorToMessage = (error: Error) => {
    const key = getErrorKey(error);
    return key ? t(key) : (error.message || t('errors.generic'));
  };
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();

  const [isMobile, setIsMobile] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);

  const [, setSelectedNetwork] = useState<Network>(SUPPORTED_NETWORKS[1]);
  const [activeTab, setActiveTab] = useState<'send' | 'transaction'>('send');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('0.0001');
  const [showAdModal, setShowAdModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completedTxHash, setCompletedTxHash] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [pendingTransaction, setPendingTransaction] = useState<{
    to: string;
    amount: string;
    token: { symbol: string };
    network: { name: string };
  } | null>(null);
  const [isTransacting, setIsTransacting] = useState(false); // used in handleAdComplete
  const [userError, setUserError] = useState<string | null>(null);
  const [freeTransactionsUsed, setFreeTransactionsUsed] = useState(0);
  const [transactions, setTransactions] = useState<
    {
      hash: string;
      to: string;
      amount: string;
      tokenSymbol: string;
      networkName: string;
      chainId: number;
      timestamp: number;
    }[]
  >([]);

  useEffect(() => {
    setFreeTransactionsUsed(getFreeTransactionsUsed());
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(detectMobileLayout());
    checkMobile();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }
    return () => {};
  }, []);

  // 앱(Capacitor WebView)에서 열렸을 때만 AdMob 초기화
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cap = (window as unknown as { Capacitor?: unknown }).Capacitor;
    if (!cap) return;
    import('@capacitor-community/admob')
      .then((m) => m.AdMob.initialize())
      .catch(() => {});
  }, []);

  const chainId = walletClient?.chain?.id;
  const currentNetwork =
    SUPPORTED_NETWORKS.find(n => n.chainId === chainId) ?? SUPPORTED_NETWORKS[1];

  // USDC, USDT 잔액 조회 (ERC20만 지원, 네이티브 토큰 제외)
  const tokenAddresses = chainId ? TOKEN_ADDRESSES[chainId] : null;
  const { data: usdcBalanceData, isLoading: usdcLoading } = useBalance({
    address: address ?? undefined,
    token: tokenAddresses?.USDC,
    chainId: chainId ?? undefined,
    query: { enabled: !!address && !!chainId && !!tokenAddresses?.USDC },
  });
  const { data: usdtBalanceData, isLoading: usdtLoading } = useBalance({
    address: address ?? undefined,
    token: tokenAddresses?.USDT,
    chainId: chainId ?? undefined,
    query: { enabled: !!address && !!chainId && !!tokenAddresses?.USDT },
  });

  const eoaBalanceLoading = usdcLoading || usdtLoading;

  // ERC20만 (USDC, USDT) - 네이티브 토큰 제거
  const availableTokens: Token[] = [];
  if (tokenAddresses?.USDC) {
    availableTokens.push({
      symbol: 'USDC',
      name: TOKEN_INFO.USDC.name,
      balance: usdcBalanceData ? Number(formatUnits(usdcBalanceData.value, TOKEN_INFO.USDC.decimals)) : 0,
      decimals: TOKEN_INFO.USDC.decimals,
      usdPrice: TOKEN_INFO.USDC.usdPrice,
    });
  }
  if (tokenAddresses?.USDT) {
    availableTokens.push({
      symbol: 'USDT',
      name: TOKEN_INFO.USDT.name,
      balance: usdtBalanceData ? Number(formatUnits(usdtBalanceData.value, TOKEN_INFO.USDT.decimals)) : 0,
      decimals: TOKEN_INFO.USDT.decimals,
      usdPrice: TOKEN_INFO.USDT.usdPrice,
    });
  }

  // selectedToken이 없거나 availableTokens에 없으면 첫 번째 토큰으로 설정
  useEffect(() => {
    if (availableTokens.length > 0) {
      const currentToken = selectedToken;
      if (!currentToken || !availableTokens.find(t => t.symbol === currentToken.symbol)) {
        setSelectedToken(availableTokens[0]);
      }
    } else {
      setSelectedToken(null);
    }
  }, [availableTokens, chainId]);

  const walletShort = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  // 컨트랙트 주소 조회 (체인별)
  const getContractAddress = useCallback((): `0x${string}` | undefined => {
    if (!chainId) return undefined;
    switch (chainId) {
      case 1:
        return process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_ETH as `0x${string}`;
      case 8453:
        return process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_BASE as `0x${string}`;
      case 43114:
        return process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_AVALANCHE as `0x${string}`;
      case 56:
        return process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_BNB as `0x${string}`;
      case 84532:
        return process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_BASE_SEPOLIA as `0x${string}`;
      default:
        return undefined;
    }
  }, [chainId]);

  const contractAddress = getContractAddress();

  const handleConnect = useCallback(() => {
    setShowConnectModal(true);
  }, []);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setShowConnectModal(false);
    setRecipientAddress('');
    setAmount('0.0001');
    toast.info(t('toast.walletDisconnected'));
  }, [disconnect, t]);

  const handleNetworkChange = useCallback(
    async (network: Network) => {
      setSelectedNetwork(network);
      try {
        const supportedChainId = network.chainId as 1 | 8453 | 84532 | 43114 | 56;
        await switchChainAsync({ chainId: supportedChainId });
        toast.success(t('toast.networkSwitched', { name: network.name }));
      } catch {
        toast.error(t('toast.networkSwitchFailed'));
      }
    },
    [switchChainAsync, t]
  );

  const handleAdComplete = useCallback(async () => {
    setShowAdModal(false);
    setShowTransactionModal(true);
    if (
      !address ||
      !pendingTransaction ||
      !selectedToken ||
      !chainId ||
      !walletClient ||
      !publicClient
    )
      return;
    setIsTransacting(true);

    try {
      // 컨트랙트 주소 조회 (체인별 환경 변수)
      let contractAddress: `0x${string}` | undefined;
      switch (chainId) {
        case 1:
          contractAddress = process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_ETH as `0x${string}`;
          break;
        case 8453:
          contractAddress = process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_BASE as `0x${string}`;
          break;
        case 43114:
          contractAddress = process.env
            .NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_AVALANCHE as `0x${string}`;
          break;
        case 56:
          contractAddress = process.env.NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_BNB as `0x${string}`;
          break;
        case 84532:
          contractAddress = process.env
            .NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_BASE_SEPOLIA as `0x${string}`;
          break;
      }
      if (!contractAddress) {
        setIsTransacting(false);
        setShowTransactionModal(false);
        toast.error(
          `이 네트워크에서는 서비스를 사용할 수 없습니다. (체인 ${chainId} 컨트랙트 미설정)`
        );
        return;
      }

      // 컨트랙트 코드 존재 여부 확인
      const code = await publicClient.getBytecode({ address: contractAddress });
      console.log('[handleAdComplete] Contract code check:', {
        address: contractAddress,
        hasCode: code && code !== '0x',
        codeLength: code?.length,
      });

      if (!code || code === '0x') {
        throw new Error(
          `주소 ${contractAddress}는 컨트랙트가 아닙니다 (EOA 지갑 주소일 수 있습니다). ` +
            `AdWalletSponsoredTransfer 컨트랙트를 배포하고 올바른 컨트랙트 주소를 .env.local에 설정해주세요. ` +
            `배포 명령: cd contracts && npm run deploy:sponsored-transfer:avalanche`
        );
      }

      // 사용자 nonce 조회
      let nonce: bigint;
      try {
        nonce = await publicClient.readContract({
          address: contractAddress,
          abi: [
            {
              inputs: [{ name: 'user', type: 'address' }],
              name: 'nonces',
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view',
              type: 'function',
            },
          ],
          functionName: 'nonces',
          args: [address],
        });
      } catch (nonceError: any) {
        throw new Error(
          `컨트랙트에서 nonces 함수를 호출할 수 없습니다. ` +
            `주소 ${contractAddress}가 올바른 AdWalletSponsoredTransfer 컨트랙트인지 확인해주세요. ` +
            `에러: ${nonceError?.message || String(nonceError)}`
        );
      }

      // ERC20만 지원 (USDC, USDT)
      const tokenAddresses = TOKEN_ADDRESSES[chainId];
      if (!tokenAddresses || (selectedToken.symbol !== 'USDC' && selectedToken.symbol !== 'USDT')) {
        throw new Error('해당 체인에서 지원하지 않는 토큰입니다.');
      }
      const tokenAddress = selectedToken.symbol === 'USDC' ? tokenAddresses.USDC : tokenAddresses.USDT;
      if (!tokenAddress) {
        throw new Error('해당 체인에서 지원하지 않는 토큰입니다.');
      }
      const tokenInfo = TOKEN_INFO[selectedToken.symbol];
      const amountUnits = parseUnits(pendingTransaction.amount, tokenInfo.decimals);

      const permitConfig = PERMIT_TOKEN_CONFIG[chainId]?.[selectedToken.symbol as 'USDC' | 'USDT'];
      const supportsPermit = !!permitConfig;

      let permitSignature: string | undefined;
      let deadline: number | undefined;

      const currentAllowance = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, contractAddress],
      });

      if (currentAllowance < amountUnits) {
        if (supportsPermit) {
          toast.info('Permit 서명 중... (가스비 없음)');
          const permitDeadline = Math.floor(Date.now() / 1000) + 60 * 20;
          const tokenNonce = await publicClient.readContract({
            address: tokenAddress,
            abi: [
              { inputs: [{ name: 'owner', type: 'address' }], name: 'nonces', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
            ],
            functionName: 'nonces',
            args: [address],
          });
          permitSignature = await walletClient.signTypedData({
            domain: {
              name: permitConfig!.name,
              version: permitConfig!.version,
              chainId,
              verifyingContract: tokenAddress,
            },
            types: {
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
              spender: contractAddress,
              value: amountUnits,
              nonce: tokenNonce,
              deadline: BigInt(permitDeadline),
            },
          });
          deadline = permitDeadline;
          toast.success('Permit 서명 완료');
        } else {
          toast.info(t('toast.tokenApprovalRequest'));
          const approveHash = await walletClient.writeContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [contractAddress, maxUint256],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
          toast.success(t('toast.tokenApproved'));
        }
      }

      // EIP-712 서명 생성
      const domain = {
        name: 'AdWalletSponsoredTransfer',
        version: '1',
        chainId,
        verifyingContract: contractAddress,
      };

      const types = {
        Transfer: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'token', type: 'address' },
          { name: 'chainId', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
        ],
      };

      const message = {
        from: address,
        to: pendingTransaction.to as `0x${string}`,
        amount: amountUnits,
        token: tokenAddress,
        chainId: BigInt(chainId),
        nonce,
      };

      console.log('[handleAdComplete] Starting signature...', {
        domain,
        message,
        nonce: nonce.toString(),
      });

      const signature = await walletClient.signTypedData({
        domain,
        types,
        primaryType: 'Transfer',
        message,
      });

      console.log('[handleAdComplete] Signature received:', signature);

      // Relayer SDK를 통해 스폰서(AD WALLET) 대납 전송 요청
      const sdk = new AdWalletRelayerSDK();
      console.log('[handleAdComplete] Calling sendSponsoredTransfer...');
      const { txHash } = await sdk.sendSponsoredTransfer({
        from: address as `0x${string}`,
        to: pendingTransaction.to as `0x${string}`,
        amount: pendingTransaction.amount,
        tokenSymbol: selectedToken.symbol as 'USDC' | 'USDT',
        chainId,
        signature,
        nonce: Number(nonce),
        ...(permitSignature && deadline !== undefined && { permitSignature, deadline }),
      });
      console.log('Sponsored transaction hash:', txHash);
      const newCount = getFreeTransactionsUsed() + 1;
      const today = new Date().toDateString();
      localStorage.setItem('adGas_usage', JSON.stringify({ date: today, count: newCount }));
      setFreeTransactionsUsed(newCount);
      // 트랜잭션 히스토리에 추가 (최신 순으로 앞에 쌓기)
      setTransactions(prev => [
        {
          hash: txHash,
          to: pendingTransaction.to,
          amount: pendingTransaction.amount,
          tokenSymbol: selectedToken.symbol,
          networkName: currentNetwork.name,
          chainId,
          timestamp: Date.now(),
        },
        ...prev,
      ]);

      // 완료 모달 표시
      setShowTransactionModal(false);
      setCompletedTxHash(txHash);
      setShowCompleteModal(true);

      // 입력 필드 초기화
      setRecipientAddress('');
      setAmount('0.0001');
      setPendingTransaction(null);
    } catch (err: any) {
      // 더 상세한 에러 로깅
      console.error('[handleAdComplete Error] Raw error:', err);
      console.error('[handleAdComplete Error] Error type:', typeof err);
      console.error('[handleAdComplete Error] Error string:', String(err));
      console.error(
        '[handleAdComplete Error] Error JSON:',
        JSON.stringify(err, Object.getOwnPropertyNames(err))
      );

      let errorMessage = t('errors.unknown');
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (err?.error) {
        errorMessage =
          typeof err.error === 'string' ? err.error : err.error?.message || String(err.error);
      } else {
        errorMessage = JSON.stringify(err) || t('errors.unknown');
      }

      const error = new Error(errorMessage);
      const friendlyMsg = mapErrorToMessage(error);
      setUserError(friendlyMsg);
      toast.error(friendlyMsg);
      setShowTransactionModal(false);
      setPendingTransaction(null);
    } finally {
      setIsTransacting(false);
    }
  }, [
    address,
    pendingTransaction,
    selectedToken,
    chainId,
    walletClient,
    publicClient,
    currentNetwork.name,
  ]);

  const handleAdSkip = useCallback(() => {
    setShowAdModal(false);
    setPendingTransaction(null);
    toast.info(t('toast.adCancelled'));
  }, []);

  const handleSendClick = useCallback(() => {
    if (!isConnected) {
      toast.error(t('toast.connectFirst'));
      return;
    }
    if (!recipientAddress.trim() || !amount) {
      toast.error(t('toast.fillAll'));
      return;
    }
    if (parseFloat(amount) <= 0) {
      toast.error(t('toast.validAmount'));
      return;
    }
    if (!selectedToken) {
      toast.error(t('toast.selectToken'));
      return;
    }

// ERC20 잔액 확인
    const tokenAmount = parseFloat(amount);
    if (selectedToken.balance < tokenAmount) {
      toast.error(t('toast.insufficientBalance'));
      return;
    }

    const used = getFreeTransactionsUsed();
    if (used >= DAILY_LIMIT) {
      toast.error(t('toast.dailyLimitReached'));
      return;
    }
    setUserError(null);
    setPendingTransaction({
      to: recipientAddress.trim(),
      amount,
      token: selectedToken,
      network: { name: currentNetwork.name },
    });
    setShowAdModal(true);
  }, [
    isConnected,
    recipientAddress,
    amount,
    selectedToken,
    currentNetwork.name,
    t,
  ]);

  const onTokenChange = useCallback((token: Token) => {
    setSelectedToken(token);
  }, []);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white">
        <Header
          isConnected={false}
          walletAddress=""
          onConnect={handleConnect}
          onDisconnect={() => {}}
        />
        <main className="px-12 py-8 flex items-center justify-center min-h-[60vh]">
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-[24px] p-8 max-w-md w-full text-center space-y-6">
            <p className="font-extrabold text-[20px]">{t('walletConnectPrompt')}</p>
            <p className="text-[#94a3b8] text-sm">{t('walletConnectDesc')}</p>
            <button
              type="button"
              onClick={handleConnect}
              className="w-full py-3 rounded-2xl bg-[rgba(99,102,241,0.19)] border border-[rgba(99,102,241,0.38)] hover:bg-[rgba(99,102,241,0.25)] transition-colors font-bold text-[15px]"
            >
              {t('connectWallet')}
            </button>
          </div>
        </main>
        {showConnectModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1e293b] rounded-3xl max-w-md w-full p-6 border border-[rgba(255,255,255,0.08)]">
              <h2 className="font-extrabold text-xl text-white mb-4">{t('connectWallet')}</h2>
              <div className="space-y-2">
                {connectors.map(connector => (
                  <button
                    key={connector.uid}
                    type="button"
                    disabled={connectStatus === 'pending'}
                    onClick={() => {
                      connect({ connector });
                      setShowConnectModal(false);
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(99,102,241,0.13)] text-left font-medium text-white transition-colors disabled:opacity-50"
                  >
                    {connector.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
className="mt-4 w-full py-2 text-[#94a3b8] text-sm hover:text-white"
                >
                {t('close')}
              </button>
            </div>
          </div>
        )}
        <Toaster />
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white">
        <MobileHeader
          isConnected={isConnected}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          freeTransactionsUsed={freeTransactionsUsed}
        />
        <main className="px-5 pb-8 space-y-5">
          <MobileNetworkSection
            networks={SUPPORTED_NETWORKS}
            selectedNetwork={currentNetwork}
            onNetworkChange={handleNetworkChange}
          />
          <MobileGasSavings freeTransactionsUsed={freeTransactionsUsed} dailyLimit={DAILY_LIMIT} />
          <MobileTransferForm
            isConnected={isConnected}
            walletAddress={walletShort}
            recipientAddress={recipientAddress}
            onRecipientChange={setRecipientAddress}
            selectedToken={selectedToken}
            onTokenChange={onTokenChange}
            amount={amount}
            onAmountChange={setAmount}
            availableTokens={availableTokens}
            onSendClick={handleSendClick}
          />
        </main>
        <AdModal
          isOpen={showAdModal}
          onComplete={handleAdComplete}
          onSkip={handleAdSkip}
          transaction={pendingTransaction}
        />
        <TransactionModal isOpen={showTransactionModal} transaction={pendingTransaction} />
        <TransactionCompleteModal
          isOpen={showCompleteModal}
          txHash={completedTxHash || ''}
          chainId={chainId || 43114}
          onClose={() => {
            setShowCompleteModal(false);
            setCompletedTxHash(null);
          }}
        />
        <Toaster />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <Header
        isConnected={isConnected}
        walletAddress={walletShort}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />
      <main className="px-12 py-8">
        <div className="max-w-[1400px] mx-auto space-y-6">
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
          {activeTab === 'send' && (
            <>
              <NetworkSection
                networks={SUPPORTED_NETWORKS}
                selectedNetwork={currentNetwork}
                onNetworkChange={handleNetworkChange}
              />
              <div className="flex gap-6">
                <BalanceSection
                  isConnected={isConnected}
                  walletAddress={address ?? ''}
                  token={selectedToken}
                  isLoading={eoaBalanceLoading}
                />
                <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-[24px] shadow-[0px_8px_32px_0px_rgba(0,0,0,0.19)] p-7 flex-1 w-[222px]">
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-1.5">
                      <p className="font-extrabold text-[20px] leading-6 text-white">
                        💰 {t('gasSavings')}
                      </p>
                      <p className="font-medium text-[14px] leading-[16.8px] text-[#e2e8f0]">
                        {t('gasSavingsDesc')}
                      </p>
                    </div>
                    <div className="flex gap-8 items-center justify-center py-4">
                      <div className="flex flex-col gap-1 items-center">
                        <p className="font-semibold text-[20px] leading-[15.6px] text-white text-center">
                          {t('freeTx')}
                        </p>
                        <p className="font-extrabold text-[32px] leading-[21.6px] text-white text-center mt-4">
                          {freeTransactionsUsed}{t('times')}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 items-center">
                        <p className="font-semibold text-[20px] leading-[15.6px] text-white text-center">
                          {t('remainingLimit')}
                        </p>
                        <p className="font-extrabold text-[32px] leading-[21.6px] text-white text-center mt-4">
                          {DAILY_LIMIT - freeTransactionsUsed}{t('perDay')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <TransferSection
                isConnected={isConnected}
                recipientAddress={recipientAddress}
                onRecipientChange={setRecipientAddress}
                selectedToken={selectedToken}
                onTokenChange={onTokenChange}
                amount={amount}
                onAmountChange={setAmount}
                availableTokens={availableTokens}
                selectedNetwork={currentNetwork}
                onSendClick={handleSendClick}
                onCancelClick={() => {
                  setRecipientAddress('');
                  setAmount('0.0001');
                }}
              />
              {userError && (
                <div className="p-4 bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.25)] rounded-lg">
                  <p className="text-[#ef4444] text-sm">{userError}</p>
                </div>
              )}
            </>
          )}
          {activeTab === 'transaction' && (
            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-[24px] p-7">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-1.5">
                  <p className="font-extrabold text-[20px] leading-6 text-white">{t('transactionHistory')}</p>
                  <p className="font-medium text-[14px] leading-[16.8px] text-[#94a3b8]">
                    {t('transactionHistoryDesc')}
                  </p>
                </div>
                {transactions.length === 0 ? (
                  <div className="text-center py-12 text-[#94a3b8]">
                    {t('noTransactionsYet')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map(tx => {
                      const date = new Date(tx.timestamp);
                      const shortHash = `${tx.hash.slice(0, 6)}...${tx.hash.slice(-4)}`;
                      return (
                        <div
                          key={tx.hash + tx.timestamp}
                          className="flex items-center justify-between bg-[rgba(15,23,42,0.8)] border border-[rgba(148,163,184,0.3)] rounded-2xl px-4 py-3"
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-white">
                              {tx.amount} {tx.tokenSymbol}
                            </span>
                            <span className="text-xs text-[#94a3b8]">
                              {tx.networkName} • {date.toLocaleString()}
                            </span>
                            <span className="text-xs text-[#64748b] break-all">To: {tx.to}</span>
                          </div>
                          <a
                            href={
                              tx.chainId === 43114
                                ? `https://snowtrace.io/tx/${tx.hash}`
                                : tx.chainId === 1
                                  ? `https://etherscan.io/tx/${tx.hash}`
                                  : tx.chainId === 8453
                                    ? `https://basescan.org/tx/${tx.hash}`
                                    : tx.chainId === 56
                                      ? `https://bscscan.com/tx/${tx.hash}`
                                      : '#'
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-[#60a5fa] hover:underline"
                          >
                            {shortHash}
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <footer className="py-8 text-center">
        <div className="flex items-center justify-center gap-8 text-[#64748b] text-sm">
          <span>{t('footer.poweredBy')}</span>
          <span>•</span>
          <span>{t('footer.web3')}</span>
          <span>•</span>
          <span>{t('footer.secure')}</span>
        </div>
      </footer>
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e293b] rounded-3xl max-w-md w-full p-6 border border-[rgba(255,255,255,0.08)]">
            <h2 className="font-extrabold text-xl text-white mb-4">{t('connectWallet')}</h2>
            <div className="space-y-2">
              {connectors.map(connector => (
                <button
                  key={connector.uid}
                  type="button"
                  disabled={connectStatus === 'pending'}
                  onClick={() => {
                    connect({ connector });
                    setShowConnectModal(false);
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(99,102,241,0.13)] text-left font-medium text-white transition-colors disabled:opacity-50"
                >
                  {connector.name}
                </button>
              ))}
            </div>
            <button
              type="button"
onClick={() => setShowConnectModal(false)}
            className="mt-4 w-full py-2 text-[#94a3b8] text-sm hover:text-white"
          >
            {t('close')}
          </button>
        </div>
      </div>
      )}
      <AdModal
        isOpen={showAdModal}
        onComplete={handleAdComplete}
        onSkip={handleAdSkip}
        transaction={pendingTransaction}
      />
      <TransactionModal isOpen={showTransactionModal} transaction={pendingTransaction} />
      <TransactionCompleteModal
        isOpen={showCompleteModal}
        txHash={completedTxHash || ''}
        chainId={chainId || 43114}
        onClose={() => {
          setShowCompleteModal(false);
          setCompletedTxHash(null);
        }}
      />
      <Toaster />
    </div>
  );
}
