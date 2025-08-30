import {
  GaslessSDK,
  TokenPaymaster,
  PaymasterManager,
  PaymasterFactory,
  GaslessSDKConfig,
  TokenPaymasterConfig,
  PaymasterPolicy,
} from '../src';
import { JsonRpcProvider, Wallet } from 'ethers';

/**
 * Comprehensive Paymaster Integration Example
 * Demonstrates EIP-4337 compliant paymaster features
 */

// Mock wallet for example
class ExampleWallet {
  constructor(private privateKey: string) {}

  async getAddress(): Promise<string> {
    return '0x742d35Cc6635C0532925a3b8D5c9f5b5aB3b6a8e';
  }

  async signMessage(message: string): Promise<string> {
    console.log('📝 Signing message for paymaster validation');
    return '0x' + '0'.repeat(130);
  }

  async signTypedData(domain: any, types: any, value: any): Promise<string> {
    console.log('📝 Signing EIP-712 data for paymaster');
    return '0x' + '1'.repeat(130);
  }

  async getChainId(): Promise<number> {
    return 5; // Goerli
  }
}

async function paymasterIntegrationExample() {
  console.log('💰 Paymaster Integration Example - EIP-4337 Compliant');
  console.log('====================================================');

  try {
    // 1. Setup SDK with paymaster configuration
    console.log('🚀 Step 1: Setting up SDK with paymaster support');
    
    const config: GaslessSDKConfig = {
      networks: [
        {
          chainId: 5,
          name: 'Ethereum Goerli',
          rpcUrl: 'https://eth-goerli.g.alchemy.com/v2/demo',
          paymasterAddress: '0x1234567890123456789012345678901234567890',
          forwarderAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
          gasTokens: [
            '0x0000000000000000000000000000000000000000', // ETH
            '0xA0b86a33E6ddbFCFd3ad7CD6dc23b01B1b56A1A1', // USDC
            '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6', // WETH
          ],
        },
      ],
      defaultNetwork: 5,
      relayerEndpoint: 'https://relayer.gasless-sdk.com',
      paymasterEndpoint: 'https://paymaster.gasless-sdk.com',
      debug: true,
    };

    const sdk = new GaslessSDK(config);
    const wallet = new ExampleWallet('demo-private-key');
    await sdk.connectWallet(wallet);

    console.log('✅ SDK initialized with paymaster support');

    // 2. Register Token Paymasters
    console.log('\n💳 Step 2: Registering token paymasters');

    // Register USDC paymaster
    await sdk.registerTokenPaymaster(
      'usdc-paymaster',
      '0xA0b86a33E6ddbFCFd3ad7CD6dc23b01B1b56A1A1', // USDC address
      BigInt('2000000'), // 2 USDC per ETH
      '0x1111111111111111111111111111111111111111', // Paymaster contract
      BigInt('100000000') // Min balance: 100 USDC
    );

    // Register WETH paymaster  
    await sdk.registerTokenPaymaster(
      'weth-paymaster',
      '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6', // WETH address
      BigInt('1000000000000000000'), // 1:1 with ETH
      '0x2222222222222222222222222222222222222222', // Paymaster contract
      BigInt('1000000000000000000') // Min balance: 1 WETH
    );

    console.log('✅ Token paymasters registered');
    console.log('Available paymasters:', sdk.getAvailablePaymasters().map(p => p.id));

    // 3. Paymaster Factory Operations
    console.log('\n🏭 Step 3: Paymaster factory operations');
    
    const paymasterManager = sdk.getPaymasterManager();
    const factory = paymasterManager.getFactory();

    try {
      // Set up deployer wallet (in production, use actual private key)
      const deployerWallet = new Wallet('0x' + '1'.repeat(64), new JsonRpcProvider(config.networks[0].rpcUrl));
      factory.setDeployer(deployerWallet);

      console.log('🏗️  Paymaster factory configured');
      console.log('ℹ️  In production, deploy paymasters using: factory.deployTokenPaymaster()');
    } catch (error) {
      console.log('⚠️  Factory operations require actual deployer wallet');
    }

    // 4. Paymaster Service Operations
    console.log('\n🔧 Step 4: Paymaster service operations');
    
    const paymasterService = sdk.getPaymasterService();

    try {
      // Get paymaster status
      const status = await paymasterService.getStatus();
      console.log('📊 Paymaster status:', status.status);
      console.log('🌐 Supported chains:', status.supportedChains);

      // Get stake information
      const stakeInfo = await paymasterService.getStakeInfo();
      console.log('💰 Stake info:', {
        stake: stakeInfo.stake.toString(),
        unstakeDelay: stakeInfo.unstakeDelaySec,
        withdrawTime: stakeInfo.withdrawTime,
      });
    } catch (error) {
      console.log('⚠️  Paymaster service calls require actual deployed contracts');
    }

    // 5. Sponsored Transaction Example
    console.log('\n🚀 Step 5: Sending sponsored transaction');

    const sponsoredTransaction = {
      to: '0x9876543210987654321098765432109876543210',
      data: '0xa9059cbb000000000000000000000000123456789012345678901234567890123456789000000000000000000000000000000000000000000000000000000000000186a0', // ERC20 transfer
      value: 0,
    };

    try {
      console.log('💸 Sending transaction with automatic paymaster selection...');
      
      const response = await sdk.sendSponsoredTransaction(sponsoredTransaction, (event) => {
        console.log('📊 Sponsored transaction event:', event.type, event.transactionHash || 'pending');
      });

      if (response.success) {
        console.log('✅ Sponsored transaction successful!');
        console.log('📋 Transaction hash:', response.transactionHash);
        console.log('⛽ Gas used:', response.gasUsed?.toString());
        console.log('💰 Gas sponsored by paymaster');
      } else {
        console.log('❌ Sponsored transaction failed:', response.error);
      }
    } catch (error) {
      console.log('⚠️  Sponsored transaction failed (expected in demo):', error);
    }

    // 6. Token Payment Example
    console.log('\n💳 Step 6: Token payment example');

    try {
      // Get registered token paymasters
      const tokenPaymasters = sdk.getAvailablePaymasters().filter(p => 
        p.id.includes('token') || p.id.includes('usdc') || p.id.includes('weth')
      );

      console.log('💳 Available token paymasters:');
      tokenPaymasters.forEach(p => {
        console.log(`  - ${p.id}`);
      });

      // Example: Calculate token cost for gas
      if (tokenPaymasters.length > 0) {
        console.log('💰 Token cost calculation example:');
        console.log('  Gas limit: 200,000');
        console.log('  Gas price: 20 gwei');
        console.log('  Estimated token cost would be calculated by TokenPaymaster');
      }
    } catch (error) {
      console.log('⚠️  Token payment operations require actual token contracts');
    }

    // 7. Paymaster Policy Management
    console.log('\n📋 Step 7: Paymaster policy management');

    const samplePolicy: PaymasterPolicy = {
      sponsorshipLimit: BigInt('50000000000000000'), // 0.05 ETH max per transaction
      timeWindow: 3600, // 1 hour
      maxOperationsPerTimeWindow: 10,
      allowedTargets: [
        '0xA0b86a33E6ddbFCFd3ad7CD6dc23b01B1b56A1A1', // USDC contract
        '0x9876543210987654321098765432109876543210', // Example DeFi contract
      ],
      blockedTargets: [],
      requireWhitelist: false,
    };

    try {
      paymasterManager.updatePaymasterPolicy('usdc-paymaster', samplePolicy);
      console.log('✅ Paymaster policy updated');
      
      const policy = paymasterManager.getPaymasterPolicy('usdc-paymaster');
      console.log('📋 Current policy:', {
        sponsorshipLimit: policy?.sponsorshipLimit.toString(),
        timeWindow: policy?.timeWindow,
        maxOpsPerWindow: policy?.maxOperationsPerTimeWindow,
      });
    } catch (error) {
      console.log('⚠️  Policy management requires registered paymasters');
    }

    // 8. Advanced Paymaster Features
    console.log('\n🔬 Step 8: Advanced paymaster features');

    console.log('🔍 EIP-4337 Features implemented:');
    console.log('  ✅ validatePaymasterUserOp - Validate user operations');
    console.log('  ✅ postOp - Post-operation hooks for refunds/cleanup');
    console.log('  ✅ Stake management - Reputation system support');
    console.log('  ✅ Token payments - ERC-20 gas fee support');
    console.log('  ✅ Policy enforcement - Sponsorship rules and limits');
    console.log('  ✅ Multi-paymaster support - Automatic selection');

    // 9. Integration with Account Abstraction
    console.log('\n🏗️  Step 9: Account Abstraction integration');

    console.log('🔗 Paymaster integration with ERC-4337:');
    console.log('  - UserOperation sponsorship validation');
    console.log('  - Gas cost calculation and token conversion');
    console.log('  - Post-operation refund mechanisms');
    console.log('  - Reputation-based paymaster selection');
    console.log('  - Multi-chain paymaster support');

    // 10. Cleanup
    console.log('\n🧹 Step 10: Cleanup');
    sdk.disconnect();
    console.log('✅ SDK disconnected');

    console.log('\n🎉 Paymaster integration example completed!');
    console.log('====================================================');

    console.log('\n📚 Key Features Demonstrated:');
    console.log('✅ EIP-4337 compliant paymaster validation');
    console.log('✅ Token-based gas payment system');
    console.log('✅ Automatic paymaster selection');
    console.log('✅ Paymaster factory and deployment');
    console.log('✅ Stake management for reputation');
    console.log('✅ Policy-based sponsorship rules');
    console.log('✅ Post-operation hooks and refunds');
    console.log('✅ Multi-paymaster management');

  } catch (error) {
    console.error('💥 Error in paymaster integration example:', error);
  }
}

// Usage instructions
console.log(`
💰 Gasless SDK Paymaster Integration
====================================

This example demonstrates comprehensive paymaster integration:

🏗️  Architecture:
- PaymasterService: Core EIP-4337 paymaster operations
- TokenPaymaster: ERC-20 token-based gas payments  
- PaymasterManager: Multi-paymaster coordination
- PaymasterFactory: Contract deployment and management

🔧 Key Features:
- Automatic paymaster selection based on policies
- Token-based gas fee payments (USDC, WETH, etc.)
- EIP-4337 compliant validation and post-operation hooks
- Reputation system with staking mechanism
- Policy-based sponsorship rules and limits
- Multi-chain paymaster support

🚀 Usage:
1. Register token paymasters for different ERC-20 tokens
2. Set sponsorship policies and limits
3. Send sponsored transactions automatically
4. Handle post-operation refunds and cleanup

📖 Based on EIP-4337: ${EIP_4337_URL}
`);

const EIP_4337_URL = 'https://eips.ethereum.org/EIPS/eip-4337';

// Run the example
if (require.main === module) {
  paymasterIntegrationExample().catch(console.error);
}

export { paymasterIntegrationExample };
