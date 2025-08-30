import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, usePublicClient, useWalletClient } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { BiconomySmartAccountV2, PaymasterMode } from '@biconomy/account';
import { parseEther, formatEther } from 'viem';

export default function GaslessTransaction() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [smartAccount, setSmartAccount] = useState<BiconomySmartAccountV2 | null>(null);
  const [saAddress, setSaAddress] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [gasEstimate, setGasEstimate] = useState<string>('');
  const [estimating, setEstimating] = useState(false);

  // 지갑이 연결되면 Biconomy 스마트 어카운트를 초기화하는 로직
  useEffect(() => {
    console.log('Paymaster API Key:', process.env.NEXT_PUBLIC_BICONOMY_PAYMASTER_API_KEY);

    const initBiconomySDK = async () => {
      if (isConnected && publicClient && walletClient) {
        setLoading(true);
        try {
          const biconomySA = await BiconomySmartAccountV2.create({
            chainId: await walletClient.getChainId(),
            bundlerUrl: process.env.NEXT_PUBLIC_BICONOMY_BUNDLER_URL!,
            biconomyPaymasterApiKey: 'diWzeCzUF.e533ee67-fa36-4fe1-a39e-c1728745223e',
            signer: walletClient,
          });
          const saAddress = await biconomySA.getAccountAddress();
          setSmartAccount(biconomySA);
          setSaAddress(saAddress);
        } catch (error) {
          console.error('Biconomy SDK initialization failed:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    initBiconomySDK();
  }, [isConnected, publicClient, walletClient]);

  // 가스비 추정 함수
  const estimateGas = async () => {
    if (!smartAccount || !publicClient) {
      alert('Smart Account not initialized!');
      return;
    }

    setEstimating(true);
    try {
      const transaction = {
        to: '0x3b145d66C8E5270E1fD52093509b150c9c82E094' as `0x${string}`,
        value: parseEther('0.00001'),
        data: '0x' as `0x${string}`,
      };

      console.log('Estimating gas for transaction:', transaction);

      // Biconomy V2에서는 getGasEstimate 메서드 사용
      const gasEstimateWei = await smartAccount.getGasEstimate([transaction], {
        paymasterServiceData: { mode: PaymasterMode.SPONSORED },
      });

      const gasEstimateEth = formatEther(gasEstimateWei);
      setGasEstimate(`Estimated Gas Cost: ${gasEstimateEth} ETH`);

      console.log('Gas estimation:', {
        gasEstimateWei: gasEstimateWei.toString(),
        gasEstimateEth,
      });
    } catch (error) {
      console.error('Gas estimation failed:', error);
      setGasEstimate('Gas estimation failed: Try using paymaster sponsored mode');
    } finally {
      setEstimating(false);
    }
  };

  // Gasless 트랜잭션을 보내는 함수 (Paymaster 사용)
  const handleGaslessTransaction = async () => {
    if (!smartAccount || !publicClient) {
      alert('Smart Account not initialized!');
      return;
    }

    setLoading(true);
    try {
      // 1. 보낼 트랜잭션 정의
      const transaction = {
        to: '0x3b145d66C8E5270E1fD52093509b150c9c82E094' as `0x${string}`,
        value: parseEther('0.00001'),
        data: '0x' as `0x${string}`,
      };

      console.log('Sending transaction:', transaction);

      // 2. 가스 가격 정보 가져오기 (520 에러 방지)
      const feeData = await publicClient.estimateFeesPerGas();
      console.log('Current fee data:', feeData);

      // 3. UserOperation을 먼저 빌드하고 가스 가격을 string으로 설정
      const partialUserOp = await smartAccount.buildUserOp([transaction], {
        paymasterServiceData: { mode: PaymasterMode.SPONSORED },
      });

      console.log('Built UserOp (before gas fix):', partialUserOp);

      // 4. maxFeePerGas가 없거나 0이면 네트워크에서 가져온 값을 string으로 설정
      // Paymaster는 string 형태의 가스 가격을 요구하므로 타입 단언 사용
      const userOp = partialUserOp as {
        maxFeePerGas?: string | bigint;
        maxPriorityFeePerGas?: string | bigint;
        [key: string]: unknown;
      };

      if (!userOp.maxFeePerGas || userOp.maxFeePerGas === '0x0') {
        userOp.maxFeePerGas = `0x${(feeData.maxFeePerGas || BigInt(0)).toString()}`;
      }
      if (!userOp.maxPriorityFeePerGas || userOp.maxPriorityFeePerGas === '0x0') {
        userOp.maxPriorityFeePerGas = `0x${(feeData.maxPriorityFeePerGas || BigInt(0)).toString()}`;
      }

      // BigInt를 hex string으로 변환 (paymaster가 hex string을 요구함)
      if (typeof userOp.maxFeePerGas === 'bigint') {
        userOp.maxFeePerGas = `0x${userOp.maxFeePerGas.toString()}`;
      }
      if (typeof userOp.maxPriorityFeePerGas === 'bigint') {
        userOp.maxPriorityFeePerGas = `0x${userOp.maxPriorityFeePerGas.toString()}`;
      }

      console.log('UserOp with fixed gas prices:', {
        maxFeePerGas: userOp.maxFeePerGas,
        maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
        type_maxFeePerGas: typeof userOp.maxFeePerGas,
        type_maxPriorityFeePerGas: typeof userOp.maxPriorityFeePerGas,
      });

      // 5. UserOperation 전송 (수정된 가스 가격과 함께)
      const userOpResponse = await smartAccount.sendUserOp(userOp as typeof partialUserOp);
      console.log('UserOp response:', userOpResponse);

      const { transactionHash } = await userOpResponse.waitForTxHash();
      console.log('Transaction hash:', transactionHash);

      alert(`Success! Transaction Hash: ${transactionHash}`);
    } catch (error) {
      console.error('Transaction failed:', error);

      // 더 자세한 에러 정보 제공
      if (error instanceof Error) {
        if (error.message.includes('maxFeePerGas') || error.message.includes('gas')) {
          alert(
            `Gas fee error: ${error.message}\n\nSolutions:\n1. Network congestion - try again\n2. Check paymaster configuration\n3. Verify API key is correct`
          );
        } else if (error.message.includes('520')) {
          alert(
            `Paymaster error (520): ${error.message}\n\nThis means the paymaster service has an issue:\n1. Check your paymaster API key\n2. Verify network is supported\n3. Try again in a moment`
          );
        } else if (error.message.includes('AA21')) {
          alert(
            `Insufficient funds (AA21): ${error.message}\n\nThe paymaster should cover gas fees, but there might be a configuration issue.`
          );
        } else {
          alert(`Transaction failed: ${error.message}`);
        }
      } else {
        alert('Transaction failed with unknown error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Paymaster 없이 트랜잭션 전송 (스마트 계정 자체 자금 사용)

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '600px' }}>
      {isConnected ? (
        <div>
          <h2>🔗 Biconomy V2 Enhanced Transaction Demo</h2>

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
          </div>

          {/* Gas Estimation Section */}
          <div
            style={{
              marginBottom: '20px',
              padding: '15px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
            }}
          >
            <h3>⛽ Gas Estimation</h3>
            <div style={{ marginBottom: '10px' }}>
              <button
                onClick={estimateGas}
                disabled={estimating || !saAddress}
                style={{
                  padding: '10px 15px',
                  backgroundColor: '#FF9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: estimating || !saAddress ? 'not-allowed' : 'pointer',
                  marginRight: '10px',
                }}
              >
                {estimating ? 'Estimating...' : '📊 Estimate Gas'}
              </button>
              <span style={{ fontSize: '14px', color: '#666' }}>
                Calculate gas cost before sending
              </span>
            </div>
            {gasEstimate && (
              <div
                style={{
                  padding: '10px',
                  backgroundColor: '#e8f5e8',
                  border: '1px solid #4CAF50',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                <strong>Gas Estimate:</strong> {gasEstimate}
              </div>
            )}
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
            <h3>🚀 Send Transaction</h3>
            <div style={{ marginBottom: '15px' }}>
              <button
                onClick={handleGaslessTransaction}
                disabled={loading || !saAddress}
                style={{
                  padding: '12px 20px',
                  backgroundColor: loading || !saAddress ? '#ccc' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: loading || !saAddress ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                }}
              >
                {loading ? '⏳ Processing...' : '🎯 Send 0.00001 ETH (Gasless)'}
              </button>
            </div>
            <p style={{ fontSize: '14px', color: '#666', margin: '0' }}>
              ✅ Uses Biconomy Paymaster (No gas fees required)
              <br />
              ✅ Enhanced error handling for 520 errors
              <br />✅ Automatic gas price detection
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
            <h4>💡 Biconomy V2 - 520 Error Solutions</h4>
            <ul style={{ fontSize: '14px', margin: '10px 0' }}>
              <li>
                <strong>Gas Estimation:</strong> Uses Biconomy V2 getGasEstimate method for accurate
                cost calculation
              </li>
              <li>
                <strong>520 Error Fix:</strong> Converts maxFeePerGas/maxPriorityFeePerGas to hex
                string format as required by paymaster
              </li>
              <li>
                <strong>maxFeePerGas Issue:</strong> buildUserOp returns BigInt but paymaster needs
                hex string - automatic conversion applied
              </li>
              <li>
                <strong>Paymaster Configuration:</strong> Ensure your API key is valid and network
                is supported
              </li>
              <li>
                <strong>Debug Info:</strong> Check browser console for detailed transaction logs
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <h2>🔗 Connect Your Wallet</h2>
          <p style={{ marginBottom: '20px', color: '#666' }}>
            Connect your wallet to start using gasless transactions with enhanced gas estimation
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
