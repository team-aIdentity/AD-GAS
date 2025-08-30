import React, { useState } from 'react';
import {
  useGaslessSDKComplete,
  GaslessSDKConfig,
  WalletInterface,
} from '../src';

// Example wallet implementation for React
class ReactWallet implements WalletInterface {
  constructor(private provider: any) {} // e.g., window.ethereum

  async getAddress(): Promise<string> {
    const accounts = await this.provider.request({ method: 'eth_requestAccounts' });
    return accounts[0];
  }

  async signMessage(message: string): Promise<string> {
    const address = await this.getAddress();
    return this.provider.request({
      method: 'personal_sign',
      params: [message, address],
    });
  }

  async signTypedData(domain: any, types: any, value: any): Promise<string> {
    const address = await this.getAddress();
    return this.provider.request({
      method: 'eth_signTypedData_v4',
      params: [address, JSON.stringify({ domain, types, message: value })],
    });
  }

  async getChainId(): Promise<number> {
    const chainId = await this.provider.request({ method: 'eth_chainId' });
    return parseInt(chainId, 16);
  }
}

// React component example
export const GaslessTransactionComponent: React.FC = () => {
  const [targetAddress, setTargetAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  // SDK configuration
  const config: GaslessSDKConfig = {
    networks: [
      {
        chainId: 137,
        name: 'Polygon Mainnet',
        rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/your-api-key',
        gasTokens: ['0x0000000000000000000000000000000000000000'],
      },
    ],
    defaultNetwork: 137,
    relayerEndpoint: 'https://relayer.example.com',
    paymasterEndpoint: 'https://paymaster.example.com',
    debug: true,
  };

  // Use the complete gasless SDK hook
  const {
    isInitialized,
    sdkError,
    isConnected,
    address,
    connect,
    disconnect,
    gaslessTransaction,
    networkManager,
    gasEstimation,
  } = useGaslessSDKComplete(config);

  // Connect wallet handler
  const handleConnectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const wallet = new ReactWallet((window as any).ethereum);
      await connect(wallet);
    } else {
      alert('Please install MetaMask or another Ethereum wallet');
    }
  };

  // Send transaction handler
  const handleSendTransaction = async () => {
    if (!targetAddress || !transferAmount) {
      alert('Please fill in all fields');
      return;
    }

    // Example ERC20 transfer call data (you'd generate this properly)
    const transferCallData = `0xa9059cbb${targetAddress.slice(2).padStart(64, '0')}${parseInt(transferAmount).toString(16).padStart(64, '0')}`;

    const transaction = {
      to: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
      data: transferCallData,
      value: 0,
    };

    await gaslessTransaction.sendTransaction(transaction);
  };

  // Estimate gas handler
  const handleEstimateGas = async () => {
    if (!targetAddress || !transferAmount) {
      alert('Please fill in all fields');
      return;
    }

    const transferCallData = `0xa9059cbb${targetAddress.slice(2).padStart(64, '0')}${parseInt(transferAmount).toString(16).padStart(64, '0')}`;

    const transaction = {
      to: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      data: transferCallData,
      value: 0,
    };

    await gasEstimation.estimateGas(transaction);
  };

  if (sdkError) {
    return (
      <div style={{ padding: '20px', border: '1px solid red', borderRadius: '8px' }}>
        <h3>❌ SDK Error</h3>
        <p>{sdkError}</p>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>🔄 Initializing Gasless SDK...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>🚀 Gasless SDK React Example</h2>

      {/* Wallet Connection Section */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>👛 Wallet Connection</h3>
        {!isConnected ? (
          <button 
            onClick={handleConnectWallet}
            style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Connect Wallet
          </button>
        ) : (
          <div>
            <p>✅ Connected: {address}</p>
            <p>🌐 Chain ID: {networkManager.currentNetwork?.chainId}</p>
            <button 
              onClick={disconnect}
              style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Network Information */}
      {isConnected && (
        <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h3>🌐 Network Information</h3>
          <p>Current Network: {networkManager.currentNetwork?.name}</p>
          <p>Available Networks:</p>
          <ul>
            {networkManager.availableNetworks.map(network => (
              <li key={network.chainId}>
                {network.name} (Chain ID: {network.chainId})
                {network.chainId !== networkManager.currentNetwork?.chainId && (
                  <button 
                    onClick={() => networkManager.switchNetwork(network.chainId)}
                    disabled={networkManager.isLoading}
                    style={{ marginLeft: '10px', padding: '5px 10px', fontSize: '12px' }}
                  >
                    Switch
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Transaction Form */}
      {isConnected && (
        <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h3>💸 Send Gasless Transaction</h3>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Target Address:</label>
            <input
              type="text"
              value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)}
              placeholder="0x..."
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Amount (USDC):</label>
            <input
              type="number"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="0"
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <button
              onClick={handleEstimateGas}
              disabled={gasEstimation.isLoading || gaslessTransaction.isLoading}
              style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {gasEstimation.isLoading ? '⏳ Estimating...' : '⛽ Estimate Gas'}
            </button>

            <button
              onClick={handleSendTransaction}
              disabled={gaslessTransaction.isLoading || gasEstimation.isLoading}
              style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {gaslessTransaction.isLoading ? '⏳ Sending...' : '🚀 Send Gasless Transaction'}
            </button>
          </div>

          {/* Gas Estimation Results */}
          {gasEstimation.estimate && (
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', marginBottom: '10px' }}>
              <strong>⛽ Gas Estimate:</strong> {gasEstimation.estimate.toString()}
            </div>
          )}

          {gasEstimation.error && (
            <div style={{ padding: '10px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px', marginBottom: '10px' }}>
              <strong>❌ Gas Estimation Error:</strong> {gasEstimation.error}
            </div>
          )}

          {/* Transaction Events */}
          {gaslessTransaction.events.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <strong>📊 Transaction Events:</strong>
              {gaslessTransaction.events.map((event, index) => (
                <div key={index} style={{ padding: '5px', backgroundColor: '#e7f3ff', marginTop: '5px', borderRadius: '4px' }}>
                  {event.type}: {event.transactionHash || 'Pending...'}
                </div>
              ))}
            </div>
          )}

          {/* Transaction Response */}
          {gaslessTransaction.response && (
            <div style={{ padding: '10px', backgroundColor: gaslessTransaction.response.success ? '#d4edda' : '#f8d7da', borderRadius: '4px', marginBottom: '10px' }}>
              {gaslessTransaction.response.success ? (
                <div>
                  <strong>✅ Transaction Successful!</strong>
                  <p>Hash: {gaslessTransaction.response.transactionHash}</p>
                  {gaslessTransaction.response.gasUsed && <p>Gas Used: {gaslessTransaction.response.gasUsed.toString()}</p>}
                </div>
              ) : (
                <div>
                  <strong>❌ Transaction Failed!</strong>
                  <p>{gaslessTransaction.response.error}</p>
                </div>
              )}
            </div>
          )}

          {gaslessTransaction.error && (
            <div style={{ padding: '10px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px' }}>
              <strong>❌ Error:</strong> {gaslessTransaction.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
