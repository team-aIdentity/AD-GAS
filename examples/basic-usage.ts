import { GaslessSDK, GaslessSDKConfig } from '../src';

// Example configuration
const config: GaslessSDKConfig = {
  networks: [
    {
      chainId: 137,
      name: 'Polygon Mainnet',
      rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/your-api-key',
      relayerUrl: 'https://relayer.example.com',
      paymasterAddress: '0x1234567890123456789012345678901234567890',
      gasTokens: [
        '0x0000000000000000000000000000000000000000', // MATIC
        '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
      ],
    },
  ],
  defaultNetwork: 137,
  relayerEndpoint: 'https://relayer.example.com',
  paymasterEndpoint: 'https://paymaster.example.com',
  debug: true,
};

// Initialize SDK
const sdk = new GaslessSDK(config);

// Example wallet interface implementation
class ExampleWallet {
  constructor(private privateKey: string) {}

  async getAddress(): Promise<string> {
    // In a real implementation, derive address from private key
    return '0x1234567890123456789012345678901234567890';
  }

  async signMessage(message: string): Promise<string> {
    // In a real implementation, sign the message with private key
    console.log('Signing message:', message);
    return '0x' + '0'.repeat(130); // Mock signature
  }

  async signTypedData(domain: any, types: any, value: any): Promise<string> {
    // In a real implementation, sign EIP-712 typed data
    console.log('Signing typed data:', { domain, types, value });
    return '0x' + '1'.repeat(130); // Mock signature
  }

  async getChainId(): Promise<number> {
    return 137; // Polygon
  }
}

async function main() {
  try {
    console.log('🚀 Gasless SDK Example');
    console.log('SDK Version:', sdk.getVersion());

    // Connect wallet
    const wallet = new ExampleWallet('your-private-key');
    await sdk.connectWallet(wallet);
    console.log('✅ Wallet connected');

    // Get current network info
    const network = sdk.getCurrentNetwork();
    console.log('📡 Current network:', network.name);

    // Example: Send a gasless transaction
    console.log('💸 Sending gasless transaction...');
    
    try {
      const transaction = {
        to: '0x9876543210987654321098765432109876543210',
        data: '0xa9059cbb000000000000000000000000123456789012345678901234567890123456789000000000000000000000000000000000000000000000000000000000000186a0', // ERC20 transfer
        value: 0,
      };

      // Estimate gas first
      console.log('⛽ Estimating gas...');
      const gasEstimate = await sdk.estimateGas(transaction);
      console.log('Gas estimate:', gasEstimate.toString());

      // Send transaction with progress callback
      const response = await sdk.sendGaslessTransaction(transaction, (event) => {
        console.log('📊 Transaction event:', event.type, event.transactionHash);
      });

      if (response.success) {
        console.log('✅ Transaction successful!');
        console.log('Transaction hash:', response.transactionHash);
        console.log('Gas used:', response.gasUsed?.toString());
      } else {
        console.log('❌ Transaction failed:', response.error);
      }
    } catch (error) {
      console.log('❌ Transaction error:', error);
    }

    // Example: Send meta-transaction
    console.log('🔄 Sending meta-transaction...');
    
    try {
      const metaTransaction = {
        to: '0x9876543210987654321098765432109876543210',
        data: '0xa9059cbb000000000000000000000000123456789012345678901234567890123456789000000000000000000000000000000000000000000000000000000000000186a0',
        value: 0,
        operation: 0, // Call
      };

      const metaResponse = await sdk.sendMetaTransaction(metaTransaction, (event) => {
        console.log('📊 Meta-transaction event:', event.type, event.transactionHash);
      });

      if (metaResponse.success) {
        console.log('✅ Meta-transaction successful!');
        console.log('Transaction hash:', metaResponse.transactionHash);
      } else {
        console.log('❌ Meta-transaction failed:', metaResponse.error);
      }
    } catch (error) {
      console.log('❌ Meta-transaction error:', error);
    }

    // Example: Switch networks
    console.log('🔄 Switching networks...');
    const availableNetworks = sdk.getAvailableNetworks();
    console.log('Available networks:', availableNetworks.map(n => `${n.name} (${n.chainId})`));

    // Example: Access services
    console.log('🔧 Accessing services...');
    const relayerService = sdk.getRelayerService();
    const paymasterService = sdk.getPaymasterService();
    
    console.log('Relayer service available:', !!relayerService);
    console.log('Paymaster service available:', !!paymasterService);

    // Disconnect
    sdk.disconnect();
    console.log('👋 Wallet disconnected');

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { main as runExample };
