'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useReadContracts,
} from 'wagmi';
import { bytesToHex, formatUnits, isAddress, parseUnits, maxUint256 } from 'viem';
import { Toaster } from 'sonner';
import { toast } from 'sonner';
import { AdWalletRelayerSDK, type SponsoredTransferRequest } from '../../../../src';
import { SUPPORTED_NETWORKS, DEFAULT_NETWORK } from '@/lib/networks';
import { getChainTokens, findChainToken, tokenDefToUiToken, getDefaultUiToken } from '@/lib/tokens';
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
import { TransactionHistory } from './TransactionHistory';
import { MobileHeader } from './mobile/MobileHeader';
import { WalletConnectModal } from './WalletConnectModal';
import { MobileNetworkSection } from './mobile/MobileNetworkSection';
import { MobileGasSavings } from './mobile/MobileGasSavings';
import { MobileTransferForm } from './mobile/MobileTransferForm';
import { useLocale } from '@/contexts/LocaleContext';
import { useGoogleRewardedAd } from '@/hooks/useGoogleRewardedAd';
import { isCapacitorNativeApp } from '@/utils/capacitorNative';
import {
  getCapacitorPreferredConnector,
} from '@/lib/walletConnectEnvironment';
import { getRelayerApiBase } from '@/lib/relayerApiBase';
import {
  cancelWalletSessionRecovery,
  isWalletSessionRecoveryActive,
  setWalletLinkingFlag,
} from '@/components/CapacitorWalletBootstrap';
import {
  beginWalletTxSigning,
  endWalletTxSigning,
  signTypedDataForTx,
} from '@/lib/walletSigning';
import {
  clearWalletChainCache,
  ensureWalletOnChain,
  isWalletSwitchRejectedError,
  readProviderChainId,
  verifyWalletOnChain,
  type SupportedChainId,
} from '@/lib/ensureWalletChain';
import { getPublicClient, writeContract } from '@wagmi/core';
import { config as wagmiConfig } from '@/wagmi.config';
import { ensureWagmiClients } from '@/lib/ensureWagmiClients';
import { getSponsoredTransferContractAddress } from '@/lib/sponsoredTransferContracts';
import { preloadAdMobRewarded } from '@/utils/admobRewarded';
import { isGiwaDojangRecipientVerified } from '@/lib/giwaDojang';
import {
  isAdRewardServerVerificationRequired,
  issueAdRewardChallenge,
} from '@/lib/adRewardClient';

const DAILY_LIMIT = 10;

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
    msg.includes('rpcer53') ||
    msg.includes('transport request timed out') ||
    (msg.includes('rpc client invoke method') && msg.includes('timed out'))
  )
    return 'errors.walletTransportTimeout';
  if (
    msg.includes('ad not completed') ||
    msg.includes('ad was not completed') ||
    msg.includes('ad incomplete') ||
    msg.includes('advertisement') ||
    msg.includes('광고')
  )
    return 'errors.adIncomplete';
  if (msg.includes('limit') || msg.includes('quota') || msg.includes('한도'))
    return 'errors.gasLimit';
  if (msg.includes('insufficient') || msg.includes('balance') || msg.includes('fund'))
    return 'errors.paymasterFunds';
  if (msg.includes('timeout') || msg.includes('network') || msg.includes('econnrefused'))
    return 'errors.network';
  if (
    msg.includes('0xb12c8f91') ||
    msg.includes('notverified') ||
    msg.includes('not verified') ||
    msg.includes('dojang') ||
    msg.includes('verifiedtoken')
  )
    return 'errors.giwaRecipientNotVerified';
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
  const rewardedAd = useGoogleRewardedAd();
  const { address: connectedAddress, status: accountStatus } = useAccount();
  const retainedAddressRef = useRef<typeof connectedAddress>(undefined);
  if (connectedAddress) retainedAddressRef.current = connectedAddress;
  const isRecoveringWalletSession =
    isCapacitorNativeApp() && isWalletSessionRecoveryActive();
  // 트랜잭션 성공 직후 SDK의 일시적인 disconnect/reconnecting 이벤트가 와도
  // 기존 승인 주소와 연결 화면을 유지한다. 수동 해제 시에는 복구 상태를 먼저 지운다.
  const address =
    connectedAddress ??
    (isRecoveringWalletSession ? retainedAddressRef.current : undefined);
  const isConnected =
    !!address &&
    (accountStatus === 'connected' ||
      accountStatus === 'reconnecting' ||
      isRecoveringWalletSession);
  const { connectors, connect, reset: resetConnect, isPending: isConnectPending } = useConnect();
  const { disconnect } = useDisconnect();

  const mapErrorToMessage = useCallback((error: Error) => {
    const key = getErrorKey(error);
    return key ? t(key) : error.message || t('errors.generic');
  }, [t]);
  const [isMobile, setIsMobile] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const unsupportedChainWarnedRef = useRef<number | null>(null);
  const adCompletionInFlightRef = useRef(false);

  const [selectedNetwork, setSelectedNetwork] = useState<Network>(DEFAULT_NETWORK);
  // 사용자가 앱에서 선택한 체인은 지갑의 지연된 chainId 이벤트보다 우선한다.
  const selectedNetworkRef = useRef<Network>(DEFAULT_NETWORK);
  const networkIntentChainIdRef = useRef<SupportedChainId | null>(null);
  const networkChangeRequestRef = useRef(0);
  const [activeTab, setActiveTab] = useState<'send' | 'transaction'>('send');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('0.0001');
  const [showAdModal, setShowAdModal] = useState(false);
  const [adChallengeId, setAdChallengeId] = useState<string | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completedTxHash, setCompletedTxHash] = useState<string | null>(null);
  const [completedTxChainId, setCompletedTxChainId] = useState<SupportedChainId | null>(null);
  const [selectedToken, setSelectedToken] = useState<Token | null>(() =>
    getDefaultUiToken(DEFAULT_NETWORK.chainId)
  );
  const [pendingTransaction, setPendingTransaction] = useState<{
    to: string;
    amount: string;
    token: { symbol: string };
    network: { name: string };
    chainId: SupportedChainId;
  } | null>(null);
  const [isPreparingSend, setIsPreparingSend] = useState(false);
  const [txStatusMessage, setTxStatusMessage] = useState<string | undefined>();
  const [userError, setUserError] = useState<string | null>(null);
  const [freeTransactionsUsed, setFreeTransactionsUsed] = useState(0);

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

  // 앱 진입 시 리워드 영상을 미리 준비해 전송 버튼에서 바로 표시한다.
  useEffect(() => {
    if (!isCapacitorNativeApp()) return;
    void preloadAdMobRewarded().catch(() => {});
  }, []);

  const connectedChainId = useChainId();
  const chainId = connectedChainId || undefined;

  // 지갑 연결·체인 변경 시 UI 선택과 동기화한다. 다만 앱에서 GIWA 등을
  // 명시적으로 선택한 뒤 도착하는 이전 체인(Base) 이벤트는 무시한다.
  useEffect(() => {
    if (!isConnected || !chainId) return;
    const intendedChainId = networkIntentChainIdRef.current;
    if (intendedChainId != null && chainId !== intendedChainId) return;

    const matched = SUPPORTED_NETWORKS.find(n => n.chainId === chainId);
    if (matched) {
      unsupportedChainWarnedRef.current = null;
      selectedNetworkRef.current = matched;
      setSelectedNetwork(matched);
      return;
    }
    if (unsupportedChainWarnedRef.current !== chainId) {
      unsupportedChainWarnedRef.current = chainId;
      toast.error(
        `지원하지 않는 네트워크입니다 (chainId: ${chainId}). MetaMask에서 Base, Avalanche 또는 GIWA Sepolia로 전환해주세요.`
      );
    }
  }, [isConnected, chainId]);

  // 토큰 목록과 잔액은 사용자가 선택한 네트워크를 기준으로 조회한다.
  // 모바일 지갑의 chainId 이벤트는 앱 복귀 후 늦게 도착할 수 있으므로,
  // connectedNetwork를 우선하면 전환 직후 이전 체인의 토큰이 잠시 표시된다.
  const tokenChainId = selectedNetwork.chainId as
    | 8453
    | 91342
    | 43114
    | 56;

  const chainTokens = getChainTokens(tokenChainId);
  const { data: balanceResults, isLoading: eoaBalanceLoading } = useReadContracts({
    contracts: chainTokens.map((tk) => ({
      address: tk.address,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: address ? [address] : undefined,
      chainId: tokenChainId,
    })),
    query: { enabled: !!address && chainTokens.length > 0 },
  });

  const availableTokens: Token[] = chainTokens.map((tk, i) => {
    const raw = balanceResults?.[i]?.result as bigint | undefined;
    return tokenDefToUiToken(
      tk,
      raw !== undefined ? Number(formatUnits(raw, tk.decimals)) : 0
    );
  });

  // 선택 토큰: 목록과 동기화 (연결 직후 null 방지 — 기본 첫 토큰 유지)
  useEffect(() => {
    if (availableTokens.length === 0) return;
    setSelectedToken(prev => {
      const matched = prev
        ? availableTokens.find(t => t.symbol === prev.symbol)
        : undefined;
      return matched ?? availableTokens[0];
    });
  }, [availableTokens, tokenChainId]);

  const walletShort = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  const handleConnect = useCallback(() => {
    resetConnect();
    flushSync(() => setShowConnectModal(true));
  }, [resetConnect]);

  // MetaMask 승인 후 account 상태가 먼저 연결되면 SDK mutation 완료를 더 기다리지 않고
  // 연결 모달을 즉시 닫는다. 네트워크 선택/전환은 메인 화면에서 별도로 수행한다.
  useEffect(() => {
    if (!isConnected || !showConnectModal) return;
    resetConnect();
    setWalletLinkingFlag(false);
    setShowConnectModal(false);
  }, [isConnected, resetConnect, showConnectModal]);

  const handleDisconnect = useCallback(() => {
    cancelWalletSessionRecovery();
    disconnect();
    clearWalletChainCache();
    setShowConnectModal(false);
    setRecipientAddress('');
    setAmount('0.0001');
    toast.info(t('toast.walletDisconnected'));
  }, [disconnect, t]);

  const handleNetworkChange = useCallback(
    async (network: Network) => {
      if (network.enabled === false) {
        toast.info(`${network.name}은(는) 준비 중입니다. 곧 지원할 예정이에요.`);
        return;
      }
      if (
        network.chainId === selectedNetwork.chainId &&
        !isConnected
      ) {
        return;
      }

      const targetChainId = network.chainId as SupportedChainId;
      const requestId = ++networkChangeRequestRef.current;
      const previousNetwork = selectedNetworkRef.current;
      selectedNetworkRef.current = network;
      networkIntentChainIdRef.current = targetChainId;
      setSelectedNetwork(network);

      if (!isConnected) return;

      try {
        if (isCapacitorNativeApp()) setWalletLinkingFlag(true);
        toast.info(`${network.name} 네트워크로 전환해 주세요.`);
        await ensureWalletOnChain(targetChainId);
        if (requestId !== networkChangeRequestRef.current) return;
        toast.success(t('toast.networkSwitched', { name: network.name }));
      } catch (error) {
        if (requestId !== networkChangeRequestRef.current) return;
        // provider 실제 체인이 target이면 지연된 Wagmi 값과 무관하게 성공 처리한다.
        // 실패한 경우에만 확인된 실제 체인(또는 전환 전 선택)으로 UI를 되돌린다.
        const rejected = isWalletSwitchRejectedError(error);
        const providerChainId = await readProviderChainId(1500);
        if (providerChainId === targetChainId) {
          selectedNetworkRef.current = network;
          networkIntentChainIdRef.current = targetChainId;
          setSelectedNetwork(network);
          toast.success(t('toast.networkSwitched', { name: network.name }));
          return;
        }

        const actualChainId = providerChainId ?? chainId;
        const actual = SUPPORTED_NETWORKS.find(n => n.chainId === actualChainId);
        if (actual) {
          selectedNetworkRef.current = actual;
          networkIntentChainIdRef.current = actual.chainId as SupportedChainId;
          setSelectedNetwork(actual);
        } else {
          selectedNetworkRef.current = previousNetwork;
          networkIntentChainIdRef.current = previousNetwork.chainId as SupportedChainId;
          setSelectedNetwork(previousNetwork);
        }
        toast.error(
          rejected
            ? t('toast.networkSwitchRejected', { name: network.name })
            : error instanceof Error && error.message
              ? error.message
              : t('toast.networkSwitchFailed')
        );
      } finally {
        if (
          isCapacitorNativeApp() &&
          requestId === networkChangeRequestRef.current
        ) {
          setWalletLinkingFlag(false);
        }
      }
    },
    [t, isConnected, chainId, selectedNetwork.chainId]
  );

  const handleAdComplete = useCallback(async () => {
    // 광고 SDK의 reward/dismiss 콜백이 매우 가깝게 도착하거나 WebView가 복귀하며
    // 콜백을 다시 전달해도 동일 전송의 EIP-712 서명을 두 번 요청하지 않는다.
    if (adCompletionInFlightRef.current) return;
    adCompletionInFlightRef.current = true;

    setShowAdModal(false);
    setTxStatusMessage(t('txModal.checkingNetwork'));
    setShowTransactionModal(true);

    if (!address || !pendingTransaction) {
      setShowTransactionModal(false);
      setTxStatusMessage(undefined);
      toast.error(t('toast.connectFirst'));
      adCompletionInFlightRef.current = false;
      return;
    }

    // 광고·MetaMask 왕복 중 UI chainId가 잠시 Base로 돌아와도 최초 요청 체인을 유지한다.
    const targetChainId = pendingTransaction.chainId;
    networkIntentChainIdRef.current = targetChainId;

    const completeSponsoredTransfer = (txHash: string) => {
      const newCount = getFreeTransactionsUsed() + 1;
      const today = new Date().toDateString();
      localStorage.setItem('adGas_usage', JSON.stringify({ date: today, count: newCount }));
      setFreeTransactionsUsed(newCount);
      setShowTransactionModal(false);
      setTxStatusMessage(undefined);
      setCompletedTxHash(txHash);
      setCompletedTxChainId(targetChainId);
      setShowCompleteModal(true);
      setRecipientAddress('');
      setAmount('0.0001');
      setPendingTransaction(null);
      setAdChallengeId(null);
    };

    if (isCapacitorNativeApp()) beginWalletTxSigning();

    try {
      setTxStatusMessage(t('txModal.checkingNetwork'));
      await verifyWalletOnChain(targetChainId);

      setTxStatusMessage(t('txModal.preparingWallet'));
      const clients = await ensureWagmiClients({
        chainId: targetChainId,
        expectedAddress: address,
      });
      if (!clients) {
        throw new Error(t('errors.walletNotReadyAfterAd'));
      }
      const { publicClient: activePublicClient } = clients;
      const signingConnector = getCapacitorPreferredConnector(wagmiConfig.connectors);
      setTxStatusMessage(t('txModal.preparingTransfer'));

      // 체인별 지원 토큰 (ERC20)
      const tokenDef = findChainToken(targetChainId, pendingTransaction.token.symbol);
      if (!tokenDef) {
        throw new Error('해당 체인에서 지원하지 않는 토큰입니다.');
      }
      const tokenAddress = tokenDef.address;
      const amountUnits = parseUnits(pendingTransaction.amount, tokenDef.decimals);

      // EIP-3009 토큰은 토큰 컨트랙트가 authorization nonce를 온체인에서 직접 소비한다.
      // 별도 AD-GAS allowance/nonce가 필요 없고, 최초 전송부터 한 번의 서명으로 완료된다.
      if (tokenDef.authorization) {
        const validAfter = Math.floor(Date.now() / 1000) - 60;
        const validBefore = Math.floor(Date.now() / 1000) + 60 * 20;
        const authorizationNonce = bytesToHex(
          globalThis.crypto.getRandomValues(new Uint8Array(32))
        );

        setTxStatusMessage(t('txModal.authorizationSign'));
        toast.info(t('txModal.authorizationSign'));
        const authorizationSignature = await signTypedDataForTx({
          account: address,
          ...(signingConnector ? { connector: signingConnector } : {}),
          domain: {
            name: tokenDef.authorization.name,
            version: tokenDef.authorization.version,
            chainId: targetChainId,
            verifyingContract: tokenAddress,
          },
          types: {
            TransferWithAuthorization: [
              { name: 'from', type: 'address' },
              { name: 'to', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'validAfter', type: 'uint256' },
              { name: 'validBefore', type: 'uint256' },
              { name: 'nonce', type: 'bytes32' },
            ],
          },
          primaryType: 'TransferWithAuthorization',
          message: {
            from: address,
            to: pendingTransaction.to as `0x${string}`,
            value: amountUnits,
            validAfter: BigInt(validAfter),
            validBefore: BigInt(validBefore),
            nonce: authorizationNonce,
          },
        });

        const authorizationPayload: SponsoredTransferRequest = {
          from: address as `0x${string}`,
          to: pendingTransaction.to as `0x${string}`,
          amount: pendingTransaction.amount,
          tokenSymbol: pendingTransaction.token.symbol,
          chainId: targetChainId,
          authorizationSignature,
          authorizationNonce,
          validAfter,
          validBefore,
          ...(adChallengeId ? { adChallengeId } : {}),
        };
        setTxStatusMessage(t('txModal.relayerSending'));
        const sdk = new AdWalletRelayerSDK({ baseUrl: getRelayerApiBase() });
        const { txHash } = await sdk.sendSponsoredTransfer(authorizationPayload);
        completeSponsoredTransfer(txHash);
        return;
      }

      const contractAddress = getSponsoredTransferContractAddress(targetChainId);
      if (!contractAddress) {
        setShowTransactionModal(false);
        setTxStatusMessage(undefined);
        toast.error(
          `이 네트워크에서는 서비스를 사용할 수 없습니다. (체인 ${targetChainId} 컨트랙트 미설정)`
        );
        return;
      }

      // 컨트랙트 코드 존재 여부 확인
      const code = await activePublicClient.getBytecode({ address: contractAddress });
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
        nonce = await activePublicClient.readContract({
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
      } catch (nonceError: unknown) {
        const nonceErrorMessage =
          nonceError instanceof Error ? nonceError.message : String(nonceError);
        throw new Error(
          `컨트랙트에서 nonces 함수를 호출할 수 없습니다. ` +
            `주소 ${contractAddress}가 올바른 AdWalletSponsoredTransfer 컨트랙트인지 확인해주세요. ` +
            `에러: ${nonceErrorMessage}`
        );
      }

      const permitConfig = tokenDef.permit;
      const supportsPermit = !!permitConfig;

      let permitSignature: string | undefined;
      let deadline: number | undefined;
      let approvalTransactionSent = false;

      const currentAllowance = await activePublicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, contractAddress],
      });

      if (currentAllowance < amountUnits) {
        if (supportsPermit) {
          setTxStatusMessage(t('txModal.permitSign'));
          toast.info(t('txModal.permitSign'));
          const permitDeadline = Math.floor(Date.now() / 1000) + 60 * 20;
          const tokenNonce = await activePublicClient.readContract({
            address: tokenAddress,
            abi: [
              {
                inputs: [{ name: 'owner', type: 'address' }],
                name: 'nonces',
                outputs: [{ type: 'uint256' }],
                stateMutability: 'view',
                type: 'function',
              },
            ],
            functionName: 'nonces',
            args: [address],
          });
          // EIP-712 도메인: 토큰의 name()/version()을 온체인에서 읽어 사용 (Base Sepolia USDC는 name="USDC", version="2")
          const permitVersionAbi = [
            {
              inputs: [],
              name: 'version',
              outputs: [{ type: 'string' }],
              stateMutability: 'view',
              type: 'function',
            },
          ] as const;
          let permitDomainName = permitConfig!.name;
          let permitDomainVersion = permitConfig!.version;
          try {
            const tokenName = await activePublicClient.readContract({
              address: tokenAddress,
              abi: erc20Abi,
              functionName: 'name',
              args: [],
            });
            if (typeof tokenName === 'string' && tokenName) permitDomainName = tokenName;
          } catch {
            /* 설정값 유지 */
          }
          if (permitConfig!.useOnchainVersion !== false) {
            try {
              const tokenVersion = await activePublicClient.readContract({
                address: tokenAddress,
                abi: permitVersionAbi,
                functionName: 'version',
                args: [],
              });
              if (typeof tokenVersion === 'string' && tokenVersion)
                permitDomainVersion = tokenVersion;
            } catch {
              /* 설정값 유지 (일부 토큰은 version() 없음) */
            }
          }
          permitSignature = await signTypedDataForTx({
            account: address,
            ...(signingConnector ? { connector: signingConnector } : {}),
            domain: {
              name: permitDomainName,
              version: permitDomainVersion,
              chainId: targetChainId,
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
          setTxStatusMessage(t('txModal.transferSign'));
          toast.info(t('txModal.transferSign'));
        } else {
          toast.info(t('toast.tokenApprovalRequest'));
          setTxStatusMessage(t('toast.tokenApprovalRequest'));
          if (isCapacitorNativeApp()) setWalletLinkingFlag(true);
          const approveHash = await writeContract(wagmiConfig, {
            account: address,
            chainId: targetChainId,
            ...(signingConnector ? { connector: signingConnector } : {}),
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [contractAddress, maxUint256],
          });
          await activePublicClient.waitForTransactionReceipt({ hash: approveHash });
          approvalTransactionSent = true;
          toast.success(t('toast.tokenApproved'));
        }
      }

      // EIP-712 서명 생성
      const domain = {
        name: 'AdWalletSponsoredTransfer',
        version: '1',
        chainId: targetChainId,
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
        chainId: BigInt(targetChainId),
        nonce,
      };

      console.log('[handleAdComplete] Starting signature...', {
        domain,
        message,
        nonce: nonce.toString(),
      });

      setTxStatusMessage(t('txModal.transferSign'));
      const signature = await signTypedDataForTx(
        {
          account: address,
          ...(signingConnector ? { connector: signingConnector } : {}),
          domain,
          types,
          primaryType: 'Transfer',
          message,
        },
        { immediateAfterWalletReturn: !!permitSignature || approvalTransactionSent }
      );

      console.log('[handleAdComplete] Signature received:', signature);

      // Relayer SDK를 통해 스폰서(AD WALLET) 대납 전송 요청
      setTxStatusMessage(t('txModal.relayerSending'));
      const sdk = new AdWalletRelayerSDK({ baseUrl: getRelayerApiBase() });
      console.log('[handleAdComplete] Calling sendSponsoredTransfer...');
      const { txHash } = await sdk.sendSponsoredTransfer({
        from: address as `0x${string}`,
        to: pendingTransaction.to as `0x${string}`,
        amount: pendingTransaction.amount,
        tokenSymbol: pendingTransaction.token.symbol,
        chainId: targetChainId,
        signature,
        nonce: nonce.toString(),
        ...(adChallengeId ? { adChallengeId } : {}),
        ...(permitSignature && deadline !== undefined && { permitSignature, deadline }),
      });
      console.log('Sponsored transaction hash:', txHash);
      completeSponsoredTransfer(txHash);
    } catch (err: unknown) {
      // 더 상세한 에러 로깅
      console.error('[handleAdComplete Error] Raw error:', err);
      console.error('[handleAdComplete Error] Error type:', typeof err);
      console.error('[handleAdComplete Error] Error string:', String(err));
      if (typeof err === 'object' && err !== null) {
        console.error(
          '[handleAdComplete Error] Error JSON:',
          JSON.stringify(err, Object.getOwnPropertyNames(err))
        );
      }

      let errorMessage = t('errors.unknown');
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (typeof err === 'object' && err !== null) {
        const record = err as { message?: unknown; error?: unknown };
        if (typeof record.message === 'string') {
          errorMessage = record.message;
        } else if (typeof record.error === 'string') {
          errorMessage = record.error;
        } else if (record.error instanceof Error) {
          errorMessage = record.error.message;
        } else if (record.error !== undefined) {
          errorMessage = String(record.error);
        }
      } else {
        errorMessage = JSON.stringify(err) || t('errors.unknown');
      }

      const error = new Error(errorMessage);
      const friendlyMsg = mapErrorToMessage(error);
      setUserError(friendlyMsg);
      toast.error(friendlyMsg);
      setShowTransactionModal(false);
      setTxStatusMessage(undefined);
      setPendingTransaction(null);
      setAdChallengeId(null);
    } finally {
      adCompletionInFlightRef.current = false;
      if (isCapacitorNativeApp()) endWalletTxSigning();
      else setWalletLinkingFlag(false);
    }
  }, [
    address,
    pendingTransaction,
    adChallengeId,
    t,
    mapErrorToMessage,
  ]);

  const handleAdSkip = useCallback(() => {
    setShowAdModal(false);
    setPendingTransaction(null);
    setAdChallengeId(null);
    toast.info(t('toast.adCancelled'));
  }, [t]);

  const handleSendClick = useCallback(async () => {
    if (isPreparingSend) return;
    if (!isConnected) {
      toast.error(t('toast.connectFirst'));
      return;
    }
    if (!recipientAddress.trim() || !amount) {
      toast.error(t('toast.fillAll'));
      return;
    }
    if (!isAddress(recipientAddress.trim())) {
      toast.error(t('toast.invalidRecipientAddress'));
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

    const targetNetwork = selectedNetworkRef.current;
    const targetChainId = targetNetwork.chainId as SupportedChainId;
    const targetToken = selectedToken;
    networkIntentChainIdRef.current = targetChainId;
    let nextAdChallengeId: string | null = null;

    // 광고를 먼저 재생한 뒤 서명에서 체인 불일치를 발견하면 사용자가 광고만 보게 된다.
    // MetaMask SDK의 실제 activeChain이 선택 체인과 일치한 뒤에만 광고를 시작한다.
    setIsPreparingSend(true);
    try {
      await ensureWalletOnChain(targetChainId);
      await verifyWalletOnChain(targetChainId);

      const tokenDef = findChainToken(targetChainId, targetToken.symbol);
      if (tokenDef?.recipientVerification === 'giwa-dojang') {
        if (targetChainId !== 91342) throw new Error(t('errors.network'));
        const publicClient = getPublicClient(wagmiConfig, { chainId: 91342 });
        if (!publicClient) throw new Error(t('errors.network'));

        const recipientVerified = await isGiwaDojangRecipientVerified(
          publicClient,
          tokenDef.address,
          recipientAddress.trim() as `0x${string}`
        );
        if (!recipientVerified) {
          throw new Error(t('errors.giwaRecipientNotVerified'));
        }
      }

      if (isCapacitorNativeApp()) {
        const testAd = process.env.NEXT_PUBLIC_ADMOB_USE_TEST_ADS === 'true';
        const challenge = await issueAdRewardChallenge({
          from: address as `0x${string}`,
          to: recipientAddress.trim(),
          amount,
          tokenSymbol: targetToken.symbol,
          chainId: targetChainId,
          ...(testAd ? { testAd: true } : {}),
        });
        if (challenge.required) {
          nextAdChallengeId = challenge.challengeId;
          await preloadAdMobRewarded(
            testAd ? {} : { ssvCustomData: nextAdChallengeId || undefined }
          );
        }
      } else if (await isAdRewardServerVerificationRequired()) {
        throw new Error(
          '서버 검증이 적용된 무료 전송은 현재 Android 앱의 AdMob 광고에서 지원됩니다.'
        );
      }
    } catch (error) {
      toast.error(
        isWalletSwitchRejectedError(error)
          ? t('toast.networkSwitchRejected', { name: targetNetwork.name })
          : error instanceof Error && error.message
            ? error.message
            : t('toast.networkSwitchFailed')
      );
      return;
    } finally {
      setIsPreparingSend(false);
      if (isCapacitorNativeApp()) setWalletLinkingFlag(false);
    }

    flushSync(() => {
      setUserError(null);
      setAdChallengeId(nextAdChallengeId);
      setPendingTransaction({
        to: recipientAddress.trim(),
        amount,
        token: targetToken,
        network: { name: targetNetwork.name },
        chainId: targetChainId,
      });
      setShowAdModal(true);
    });
  }, [
    isConnected,
    isPreparingSend,
    recipientAddress,
    amount,
    selectedToken,
    address,
    t,
  ]);

  const onTokenChange = useCallback((token: Token) => {
    setSelectedToken(token);
  }, []);

  if (!isConnected) {
    const promptCard = (
      <div className="w-full max-w-md space-y-6 rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-6 text-center sm:p-8">
        <p className="text-[18px] font-extrabold sm:text-[20px]">{t('walletConnectPrompt')}</p>
        <p className="text-sm text-[#94a3b8]">{t('walletConnectDesc')}</p>
        <button
          type="button"
          onClick={handleConnect}
          className="w-full rounded-2xl border border-[rgba(99,102,241,0.38)] bg-[rgba(99,102,241,0.19)] py-3 text-[14px] font-bold transition-colors hover:bg-[rgba(99,102,241,0.25)] sm:text-[15px]"
        >
          {t('connectWallet')}
        </button>
        <a
          href="/privacy"
          className="inline-flex text-xs font-semibold text-[#93c5fd] hover:underline"
        >
          {t('footer.privacy')}
        </a>
      </div>
    );

    return (
      <div className="min-h-screen bg-[#0f172a] text-white">
        <div className="lg:hidden">
          <MobileHeader
            isConnected={false}
            onConnect={handleConnect}
            onDisconnect={() => {}}
            freeTransactionsUsed={getFreeTransactionsUsed()}
          />
        </div>
        <div className="hidden lg:block">
          <Header
            isConnected={false}
            walletAddress=""
            onConnect={handleConnect}
            onDisconnect={() => {}}
          />
        </div>
        <main className="flex min-h-[50vh] items-center justify-center px-[calc(1.25rem+10px)] pb-8 pt-2 lg:min-h-[60vh] lg:px-12 lg:py-8">
          {promptCard}
        </main>
        <WalletConnectModal
          open={showConnectModal}
          onClose={() => {
            setWalletLinkingFlag(false);
            setShowConnectModal(false);
          }}
          connectors={connectors}
          connect={connect}
          reset={resetConnect}
          isPending={isConnectPending}
          targetChainId={selectedNetwork.chainId as SupportedChainId}
        />
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
        <div className="px-5 pb-4">
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
        <main className="px-5 pb-8 space-y-5">
          {activeTab === 'send' ? (
            <>
              <MobileNetworkSection
                networks={SUPPORTED_NETWORKS}
                selectedNetwork={selectedNetwork}
                onNetworkChange={handleNetworkChange}
              />
              <MobileGasSavings
                freeTransactionsUsed={freeTransactionsUsed}
                dailyLimit={DAILY_LIMIT}
              />
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
                isPreparing={isPreparingSend}
              />
            </>
          ) : (
            <TransactionHistory
              address={address}
              chainId={selectedNetwork.chainId}
              networkName={selectedNetwork.name}
            />
          )}
        </main>
        <footer className="px-5 pb-8 text-center">
          <a href="/privacy" className="text-xs font-semibold text-[#93c5fd] hover:underline">
            {t('footer.privacy')}
          </a>
        </footer>
        <AdModal
          isOpen={showAdModal}
          onComplete={handleAdComplete}
          onSkip={handleAdSkip}
          transaction={pendingTransaction}
          showRealRewardedAd={rewardedAd.showRewardedAd}
          isRewardedAdConfigured={rewardedAd.isConfigured}
          adChallengeId={adChallengeId}
        />
        <TransactionModal
          isOpen={showTransactionModal}
          transaction={pendingTransaction}
          statusMessage={txStatusMessage}
        />
        <TransactionCompleteModal
          isOpen={showCompleteModal}
          txHash={completedTxHash || ''}
          chainId={completedTxChainId ?? selectedNetwork.chainId}
          onClose={() => {
            setShowCompleteModal(false);
            setCompletedTxHash(null);
            setCompletedTxChainId(null);
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
                selectedNetwork={selectedNetwork}
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
                          {freeTransactionsUsed}
                          {t('times')}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 items-center">
                        <p className="font-semibold text-[20px] leading-[15.6px] text-white text-center">
                          {t('remainingLimit')}
                        </p>
                        <p className="font-extrabold text-[32px] leading-[21.6px] text-white text-center mt-4">
                          {DAILY_LIMIT - freeTransactionsUsed}
                          {t('perDay')}
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
                selectedNetwork={selectedNetwork}
                onSendClick={handleSendClick}
                isPreparing={isPreparingSend}
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
            <TransactionHistory
              address={address}
              chainId={selectedNetwork.chainId}
              networkName={selectedNetwork.name}
            />
          )}
        </div>
      </main>
      <footer className="py-8 text-center">
        <div className="flex flex-wrap items-center justify-center gap-4 text-[#64748b] text-sm sm:gap-8">
          <span>{t('footer.poweredBy')}</span>
          <span>•</span>
          <span>{t('footer.web3')}</span>
          <span>•</span>
          <span>{t('footer.secure')}</span>
          <span>•</span>
          <a href="/privacy" className="font-semibold text-[#93c5fd] hover:underline">
            {t('footer.privacy')}
          </a>
        </div>
      </footer>
      <WalletConnectModal
        open={showConnectModal}
        onClose={() => {
          setWalletLinkingFlag(false);
          setShowConnectModal(false);
        }}
        connectors={connectors}
        connect={connect}
        reset={resetConnect}
        isPending={isConnectPending}
        targetChainId={selectedNetwork.chainId as SupportedChainId}
      />
      <AdModal
        isOpen={showAdModal}
        onComplete={handleAdComplete}
        onSkip={handleAdSkip}
        transaction={pendingTransaction}
        showRealRewardedAd={rewardedAd.showRewardedAd}
        isRewardedAdConfigured={rewardedAd.isConfigured}
        adChallengeId={adChallengeId}
      />
      <TransactionModal
        isOpen={showTransactionModal}
        transaction={pendingTransaction}
        statusMessage={txStatusMessage}
      />
      <TransactionCompleteModal
        isOpen={showCompleteModal}
        txHash={completedTxHash || ''}
        chainId={completedTxChainId ?? selectedNetwork.chainId}
        onClose={() => {
          setShowCompleteModal(false);
          setCompletedTxHash(null);
          setCompletedTxChainId(null);
        }}
      />
      <Toaster />
    </div>
  );
}
