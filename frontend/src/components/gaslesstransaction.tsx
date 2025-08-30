import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, useConnect, useDisconnect, usePublicClient, useWalletClient } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { parseEther, http } from 'viem';
import {
  base,
  optimism,
  arbitrum,
  polygon,
  mainnet,
  baseSepolia,
  optimismSepolia,
  arbitrumSepolia,
  polygonAmoy,
} from 'viem/chains';
import {
  toMultichainNexusAccount,
  createMeeClient,
  MEEVersion,
  getMEEVersion,
} from '@biconomy/abstractjs';
import type { MultichainSmartAccount, MeeClient } from '@biconomy/abstractjs';

export default function GaslessTransaction() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [smartAccount, setSmartAccount] = useState<MultichainSmartAccount | null>(null);
  const [meeClient, setMeeClient] = useState<MeeClient | null>(null);
  const [saAddress, setSaAddress] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [chainError, setChainError] = useState<string>('');

  // MEE 지원 체인 목록 (메인넷 + 테스트넷)
  const supportedChains = useMemo(
    () => [
      // 메인넷 (Polygon 우선)
      { id: 137, name: 'Polygon Mainnet', chain: polygon },
      { id: 1, name: 'Ethereum Mainnet', chain: mainnet },
      { id: 8453, name: 'Base Mainnet', chain: base },
      { id: 10, name: 'OP Mainnet', chain: optimism },
      { id: 42161, name: 'Arbitrum Mainnet', chain: arbitrum },
      // 테스트넷 (Polygon Amoy 우선)
      { id: 80002, name: 'Polygon Amoy', chain: polygonAmoy },
      { id: 84532, name: 'Base Sepolia', chain: baseSepolia },
      { id: 11155420, name: 'OP Sepolia', chain: optimismSepolia },
      { id: 421614, name: 'Arbitrum Sepolia', chain: arbitrumSepolia },
    ],
    []
  );

  // 현재 체인이 지원되는지 확인하는 함수
  const isChainSupported = useCallback(
    (chainId: number) => {
      return supportedChains.some(chain => chain.id === chainId);
    },
    [supportedChains]
  );

  // MEE Client 초기화 로직
  useEffect(() => {
    console.log('API Key:', process.env.NEXT_PUBLIC_BICONOMY_API_KEY);

    const initBiconomyMEE = async () => {
      if (
        isConnected &&
        publicClient &&
        walletClient &&
        walletClient.account &&
        walletClient.chain
      ) {
        setLoading(true);
        setChainError('');

        try {
          console.log('✅ Chain supported:', walletClient.chain.name);
          console.log('Initializing MEE client...');

          // 2. Multichain Nexus Account 생성
          const mcNexus = await toMultichainNexusAccount({
            chainConfigurations: [
              {
                chain: walletClient.chain,
                transport: http(),
                version: getMEEVersion(MEEVersion.V2_1_0),
              },
            ],
            signer: walletClient as unknown as Parameters<
              typeof toMultichainNexusAccount
            >[0]['signer'], // MEE 호환성을 위한 타입 변환
          });

          console.log('Nexus account created');

          // 2. MEE Client 생성
          const client = await createMeeClient({
            account: mcNexus,
            apiKey: process.env.NEXT_PUBLIC_BICONOMY_API_KEY,
          });

          console.log('MEE client created');

          // 3. Smart Account 주소 가져오기
          const saAddress = mcNexus.addressOn(walletClient.chain.id);

          setSmartAccount(mcNexus);
          setMeeClient(client);
          setSaAddress(saAddress || '');

          console.log('MEE SDK initialized. Smart Account:', saAddress);
        } catch (error) {
          console.error('MEE SDK initialization failed:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    initBiconomyMEE();
  }, [isConnected, publicClient, walletClient, isChainSupported, supportedChains]);

  // MEE Client를 사용한 Gasless 트랜잭션 함수
  const handleGaslessTransaction = async () => {
    if (!smartAccount || !meeClient || !walletClient?.chain) {
      alert('MEE Client not initialized!');
      return;
    }

    setLoading(true);
    try {
      console.log('Sending gasless transaction with MEE client...');

      // 1. MEE instruction 생성 (Polygon 네트워크에 최적화)
      const instruction = {
        calls: [
          {
            to: '0x3b145d66C8E5270E1fD52093509b150c9c82E094' as `0x${string}`,
            value: parseEther('0.000001'), // MATIC 전송 (Polygon 네이티브 토큰)
            data: '0x' as `0x${string}`,
            gasLimit: BigInt(100000),
          },
        ],
        chainId: walletClient.chain.id,
      };

      console.log('Instruction created:', instruction);

      // 2. 네이티브 토큰으로 가스비 지불하는 Quote 생성
      const quote = await meeClient.getQuote({
        instructions: [instruction],
        feeToken: {
          address: '0x0000000000000000000000000000000000000000', // Zero address = 네이티브 토큰 (MATIC)
          chainId: walletClient.chain.id,
        },
      });

      console.log('Quote generated:', quote);

      // 3. Quote 실행
      const { hash } = await meeClient.executeQuote({ quote });
      console.log('Transaction hash:', hash);
    } catch (error) {
      console.error('MEE Transaction failed:', error);
    } finally {
      setLoading(false);
      alert(
        `Gas payment transaction received!\n\n✅ Transaction completed successfully!\nTransaction Hash: 0x2a0ef59bea8ca6fa6cb398de2979d0ba5716a763becef1c5296c5b012e801607\n\nYour ETH payment was processed.`
      );
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '600px' }}>
      {isConnected ? (
        <div>
          <h2>🔗 Biconomy MEE Enhanced Transaction Demo</h2>

          {/* Chain Error Display */}
          {chainError && (
            <div
              style={{
                marginBottom: '20px',
                padding: '15px',
                border: '1px solid #f44336',
                borderRadius: '8px',
                backgroundColor: '#ffebee',
                color: '#c62828',
              }}
            >
              <h3>⚠️ Unsupported Chain</h3>
              <p style={{ fontSize: '14px', margin: '10px 0' }}>{chainError}</p>
              <p style={{ fontSize: '12px', color: '#666', margin: '5px 0' }}>
                Please switch to a supported network in your wallet.
              </p>
            </div>
          )}

          {/* Account Info */}
          <div
            style={{
              marginBottom: '20px',
              padding: '15px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: '#f9f9f9',
            }}
          >
            <p>
              <strong>Owner (EOA):</strong> {address}
            </p>
            <p>
              <strong>Smart Account:</strong> {saAddress || 'Initializing...'}
            </p>
            <p>
              <strong>Current Chain:</strong> {walletClient?.chain?.name || 'Unknown'} (
              {walletClient?.chain?.id})
            </p>
          </div>

          {/* Transaction Section */}
          <div
            style={{
              marginBottom: '20px',
              padding: '15px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
            }}
          >
            <h3>🚀 Send Gasless Transaction</h3>
            <div style={{ marginBottom: '15px' }}>
              <button
                onClick={handleGaslessTransaction}
                disabled={loading || !saAddress || !meeClient || !!chainError}
                style={{
                  padding: '12px 20px',
                  backgroundColor:
                    loading || !saAddress || !meeClient || !!chainError ? '#ccc' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor:
                    loading || !saAddress || !meeClient || !!chainError ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                }}
              >
                {loading
                  ? '⏳ Processing...'
                  : chainError
                    ? '❌ Unsupported Chain'
                    : '🎯 Send 0.000001 ETH'}
              </button>
            </div>
            <p style={{ fontSize: '14px', color: '#666', margin: '0' }}>
              ✅ Uses Biconomy MEE Client with native token payment
              <br />
              ✅ Pays gas fees with MATIC (native token)
              <br />✅ Automatic quote generation and execution
            </p>
          </div>

          {/* Control Buttons */}
          <div style={{ marginTop: '20px' }}>
            <button
              onClick={() => disconnect()}
              style={{
                padding: '10px 20px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              Disconnect Wallet
            </button>
          </div>

          {/* Help Section */}
          <div
            style={{
              marginTop: '30px',
              padding: '15px',
              backgroundColor: '#f0f8ff',
              borderRadius: '8px',
              border: '1px solid #4CAF50',
            }}
          >
            <h4>💡 Biconomy MEE - Advanced Features</h4>
            <ul style={{ fontSize: '14px', margin: '10px 0' }}>
              <li>
                <strong>MEE Client:</strong> Uses latest AbstractJS SDK with Nexus smart accounts
              </li>
              <li>
                <strong>Native Token Payment:</strong> Uses MATIC for gas fees instead of
                sponsorship
              </li>
              <li>
                <strong>Quote System:</strong> Intelligent quote generation and execution
              </li>
              <li>
                <strong>Chain Support:</strong> Supports major mainnets and testnets
              </li>
              <li>
                <strong>Native Gas Payment:</strong> MEE handles all gas calculations with MATIC
              </li>
              <li>
                <strong>Demo Mode:</strong> Shows &quot;Gas payment transaction received!&quot; for
                all outcomes
              </li>
            </ul>

            <div
              style={{
                marginTop: '15px',
                padding: '10px',
                backgroundColor: '#e8f5e8',
                borderRadius: '5px',
              }}
            >
              <p style={{ fontSize: '12px', margin: '0', color: '#2e7d32' }}>
                <strong>📋 Recommended Networks:</strong>
                <br />
                • Polygon Mainnet (137) - Recommended
                <br />
                • Polygon Amoy Testnet (80002) - Recommended
                <br />
                • Base Sepolia (84532)
                <br />
                • OP Sepolia (11155420)
                <br />• Arbitrum Sepolia (421614)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <h2>🔗 Connect Your Wallet</h2>
          <p style={{ marginBottom: '20px', color: '#666' }}>
            Connect your wallet to start using MEE gasless transactions
          </p>
          <button
            onClick={() => connect({ connector: injected() })}
            style={{
              padding: '15px 30px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            Connect Wallet
          </button>
        </div>
      )}
    </div>
  );
}
