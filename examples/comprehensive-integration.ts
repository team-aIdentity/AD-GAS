import {
  GaslessSDK,
  AccountAbstraction,
  SmartAccountFactory,
  RelayerService,
  PaymasterService,
  GaslessSDKConfig,
  WalletInterface,
} from '../src';
import { JsonRpcProvider } from 'ethers';

// Mock wallet for comprehensive example
class ComprehensiveWallet implements WalletInterface {
  constructor(private privateKey: string, private chainId: number = 5) {}

  async getAddress(): Promise<string> {
    return '0x742d35Cc6635C0532925a3b8D5c9f5b5aB3b6a8e';
  }

  async signMessage(message: string): Promise<string> {
    console.log('📝 Signing message:', message.slice(0, 100) + '...');
    return '0x' + '0'.repeat(130);
  }

  async signTypedData(domain: any, types: any, value: any): Promise<string> {
    console.log('📝 Signing EIP-712 data:', { domain: domain.name, types: Object.keys(types) });
    return '0x' + '1'.repeat(130);
  }

  async getChainId(): Promise<number> {
    return this.chainId;
  }
}

async function comprehensiveExample() {
  console.log('🏗️  Comprehensive Gasless SDK Integration Example');
  console.log('================================================');

  // Configuration for multiple networks
  const config: GaslessSDKConfig = {
    networks: [
      {
        chainId: 5,
        name: 'Ethereum Goerli',
        rpcUrl: 'https://eth-goerli.g.alchemy.com/v2/demo',
        relayerUrl: 'https://relayer.gasless-sdk.com',
        paymasterAddress: '0x1234567890123456789012345678901234567890',
        forwarderAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
        gasTokens: ['0x0000000000000000000000000000000000000000'],
      },
      {
        chainId: 80001,
        name: 'Polygon Mumbai',
        rpcUrl: 'https://polygon-mumbai.g.alchemy.com/v2/demo',
        relayerUrl: 'https://relayer.gasless-sdk.com',
        paymasterAddress: '0x1234567890123456789012345678901234567890',
        gasTokens: [
          '0x0000000000000000000000000000000000000000',
          '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        ],
      },
    ],
    defaultNetwork: 5,
    relayerEndpoint: 'https://relayer.gasless-sdk.com',
    paymasterEndpoint: 'https://paymaster.gasless-sdk.com',
    apiKey: 'demo-api-key',
    debug: true,
  };

  try {
    // 1. Initialize SDK
    console.log('🚀 Step 1: Initializing SDK');
    const sdk = new GaslessSDK(config);
    console.log('✅ SDK initialized with version:', sdk.getVersion());

    // 2. Connect wallet
    console.log('\n👛 Step 2: Connecting wallet');
    const wallet = new ComprehensiveWallet('demo-private-key', 5);
    await sdk.connectWallet(wallet);
    const userAddress = await wallet.getAddress();
    console.log('✅ Wallet connected:', userAddress);

    // 3. Network management
    console.log('\n🌐 Step 3: Network management');
    console.log('Current network:', sdk.getCurrentNetwork().name);
    console.log('Available networks:');
    sdk.getAvailableNetworks().forEach((network, index) => {
      console.log(`  ${index + 1}. ${network.name} (Chain ID: ${network.chainId})`);
    });

    // 4. Service status checks
    console.log('\n🔧 Step 4: Service status checks');
    
    try {
      const relayerService = sdk.getRelayerService();
      const relayerStatus = await relayerService.checkStatus();
      console.log('📡 Relayer status:', relayerStatus.status);
      console.log('📡 Relayer supported chains:', relayerStatus.chainIds);
    } catch (error) {
      console.log('⚠️  Relayer status check failed (expected in demo)');
    }

    try {
      const paymasterService = sdk.getPaymasterService();
      const paymasterStatus = await paymasterService.getStatus();
      console.log('💰 Paymaster status:', paymasterStatus.status);
      console.log('💰 Paymaster supported chains:', paymasterStatus.supportedChains);
    } catch (error) {
      console.log('⚠️  Paymaster status check failed (expected in demo)');
    }

    // 5. Account Abstraction setup
    console.log('\n🏗️  Step 5: Account Abstraction setup');
    const provider = new JsonRpcProvider(sdk.getCurrentNetwork().rpcUrl);
    const paymasterService = sdk.getPaymasterService();
    const logger = new (await import('../src/utils/Logger')).Logger(true);
    
    const accountAbstraction = new AccountAbstraction(paymasterService, logger);
    console.log('✅ Account Abstraction initialized');
    console.log('🎯 EntryPoint address:', accountAbstraction.getEntryPointAddress());

    // 6. Smart Account Factory
    console.log('\n🏭 Step 6: Smart Account Factory');
    const factoryAddress = '0x9406Cc6185a346906296840746125a0E44976454';
    const smartAccountFactory = new (await import('../src/utils/SmartAccountFactory')).SmartAccountFactory(
      provider,
      factoryAddress,
      logger
    );

    try {
      const smartAccountAddress = await smartAccountFactory.getAccountAddress(userAddress, '0');
      console.log('📍 Smart account address:', smartAccountAddress);
      
      const isDeployed = await smartAccountFactory.isAccountDeployed(smartAccountAddress);
      console.log('🏗️  Account deployed:', isDeployed);

      if (!isDeployed) {
        const initCode = smartAccountFactory.generateInitCode(userAddress, '0');
        console.log('📦 Generated initCode length:', initCode.length);
        
        const deploymentGas = await smartAccountFactory.estimateDeploymentGas(userAddress, '0');
        console.log('⛽ Deployment gas estimate:', deploymentGas.toString());
      }
    } catch (error) {
      console.log('⚠️  Smart account operations failed (expected in demo environment)');
    }

    // 7. Transaction examples
    console.log('\n💸 Step 7: Transaction examples');

    // Example ERC20 transfer transaction
    const transferTransaction = {
      to: '0xA0b86a33E6ddbFCFd3ad7CD6dc23b01B1b56A1A1', // Example ERC20 token
      data: '0xa9059cbb000000000000000000000000987654321098765432109876543210987654321000000000000000000000000000000000000000000000000000000000000186a0', // transfer(to, amount)
      value: 0,
    };

    try {
      console.log('⛽ Estimating gas for transaction...');
      const gasEstimate = await sdk.estimateGas(transferTransaction);
      console.log('Gas estimate:', gasEstimate.toString());
    } catch (error) {
      console.log('⚠️  Gas estimation failed (expected in demo environment)');
    }

    try {
      console.log('🚀 Sending gasless transaction...');
      const response = await sdk.sendGaslessTransaction(transferTransaction, (event) => {
        console.log('📊 Transaction event:', event.type, event.transactionHash || 'pending');
      });

      if (response.success) {
        console.log('✅ Gasless transaction successful!');
        console.log('📋 Transaction hash:', response.transactionHash);
        console.log('⛽ Gas used:', response.gasUsed?.toString());
      } else {
        console.log('❌ Gasless transaction failed:', response.error);
      }
    } catch (error) {
      console.log('⚠️  Gasless transaction failed (expected in demo environment)');
      console.log('   Error:', error);
    }

    // 8. Meta-transaction example
    console.log('\n🔄 Step 8: Meta-transaction example');
    
    const metaTransaction = {
      to: '0xA0b86a33E6ddbFCFd3ad7CD6dc23b01B1b56A1A1',
      data: '0xa9059cbb000000000000000000000000987654321098765432109876543210987654321000000000000000000000000000000000000000000000000000000000000186a0',
      value: 0,
      operation: 0, // Call operation
    };

    try {
      console.log('🔄 Sending meta-transaction...');
      const metaResponse = await sdk.sendMetaTransaction(metaTransaction, (event) => {
        console.log('📊 Meta-transaction event:', event.type, event.transactionHash || 'pending');
      });

      if (metaResponse.success) {
        console.log('✅ Meta-transaction successful!');
        console.log('📋 Transaction hash:', metaResponse.transactionHash);
      } else {
        console.log('❌ Meta-transaction failed:', metaResponse.error);
      }
    } catch (error) {
      console.log('⚠️  Meta-transaction failed (expected in demo environment)');
      console.log('   Error:', error);
    }

    // 9. Network switching example
    console.log('\n🌐 Step 9: Network switching');
    
    try {
      console.log('🔄 Switching to Polygon Mumbai...');
      await sdk.switchNetwork(80001);
      console.log('✅ Switched to:', sdk.getCurrentNetwork().name);
      
      // Switch back
      console.log('🔄 Switching back to Ethereum Goerli...');
      await sdk.switchNetwork(5);
      console.log('✅ Switched to:', sdk.getCurrentNetwork().name);
    } catch (error) {
      console.log('❌ Network switching failed:', error);
    }

    // 10. Cleanup
    console.log('\n🧹 Step 10: Cleanup');
    sdk.disconnect();
    console.log('✅ Wallet disconnected');

    console.log('\n🎉 Comprehensive example completed successfully!');
    console.log('================================================');

  } catch (error) {
    console.error('💥 Critical error in comprehensive example:', error);
  }
}

// Usage instructions
console.log(`
🚀 Gasless SDK Comprehensive Example
====================================

This example demonstrates all major features of the Gasless SDK:

1. ✅ SDK Initialization with multi-network support
2. ✅ Wallet connection and management  
3. ✅ Network switching and configuration
4. ✅ Service status monitoring (Relayer & Paymaster)
5. ✅ Account Abstraction with ERC-4337
6. ✅ Smart Account Factory operations
7. ✅ Gas estimation and optimization
8. ✅ Gasless transaction submission
9. ✅ Meta-transaction with EIP-2771
10. ✅ Proper error handling and cleanup

Run this example to see the SDK in action!
`);

// Run the example
if (require.main === module) {
  comprehensiveExample().catch(console.error);
}

export { comprehensiveExample };
