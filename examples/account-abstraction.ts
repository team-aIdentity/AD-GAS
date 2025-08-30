import { GaslessSDK, GaslessSDKConfig } from '../src';
import { AccountAbstraction } from '../src/core/AccountAbstraction';
import { SmartAccountFactory } from '../src/utils/SmartAccountFactory';
import { JsonRpcProvider } from 'ethers';

// Example configuration for Account Abstraction
const config: GaslessSDKConfig = {
  networks: [
    {
      chainId: 5, // Goerli testnet
      name: 'Ethereum Goerli',
      rpcUrl: 'https://eth-goerli.g.alchemy.com/v2/your-api-key',
      paymasterAddress: '0x1234567890123456789012345678901234567890',
      forwarderAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
      gasTokens: ['0x0000000000000000000000000000000000000000'],
    },
  ],
  defaultNetwork: 5,
  relayerEndpoint: 'https://relayer.example.com',
  paymasterEndpoint: 'https://paymaster.example.com',
  debug: true,
};

async function accountAbstractionExample() {
  try {
    console.log('🏗️  Account Abstraction Example');

    // Initialize SDK
    const sdk = new GaslessSDK(config);
    const network = sdk.getCurrentNetwork();
    const provider = new JsonRpcProvider(network.rpcUrl);

    // Initialize Account Abstraction components
    const paymasterService = sdk.getPaymasterService();
    const logger = new (await import('../src/utils/Logger')).Logger(true);
    const accountAbstraction = new AccountAbstraction(paymasterService, logger);

    // Smart Account Factory setup
    const factoryAddress = '0x9406Cc6185a346906296840746125a0E44976454'; // Example SimpleAccountFactory
    const smartAccountFactory = new SmartAccountFactory(provider, factoryAddress, logger);

    // Example user EOA
    const userAddress = '0x1234567890123456789012345678901234567890';

    console.log('👤 User EOA:', userAddress);

    // Step 1: Calculate smart account address
    console.log('🔍 Calculating smart account address...');
    const smartAccountAddress = await smartAccountFactory.getAccountAddress(userAddress, '0');
    console.log('📍 Smart account address:', smartAccountAddress);

    // Step 2: Check if account is deployed
    const isDeployed = await smartAccountFactory.isAccountDeployed(smartAccountAddress);
    console.log('🏗️  Account deployed:', isDeployed);

    // Step 3: Generate initCode if not deployed
    let initCode = '0x';
    if (!isDeployed) {
      console.log('📦 Generating initCode for deployment...');
      initCode = smartAccountFactory.generateInitCode(userAddress, '0');
      console.log('📋 InitCode:', initCode.slice(0, 50) + '...');
    }

    // Step 4: Create a User Operation
    console.log('📝 Creating User Operation...');
    
    // Example: ERC20 transfer call data
    const transferCallData = '0xa9059cbb000000000000000000000000987654321098765432109876543210987654321000000000000000000000000000000000000000000000000000000000000186a0';
    
    const userOp = await accountAbstraction.createUserOperation(
      smartAccountAddress,
      transferCallData,
      initCode,
      network.chainId,
      provider
    );

    console.log('👆 User Operation created:');
    console.log('  Sender:', userOp.sender);
    console.log('  Nonce:', userOp.nonce.toString());
    console.log('  Call gas limit:', userOp.callGasLimit.toString());

    // Step 5: Get paymaster sponsorship
    console.log('💰 Requesting paymaster sponsorship...');
    
    try {
      const sponsoredUserOp = await accountAbstraction.getSponsoredUserOperation(
        userOp,
        network.chainId
      );

      console.log('✅ Sponsorship approved!');
      console.log('  Paymaster data:', sponsoredUserOp.paymasterAndData.slice(0, 50) + '...');
      console.log('  Verification gas:', sponsoredUserOp.verificationGasLimit.toString());

      // Step 6: Calculate User Operation hash
      const userOpHash = accountAbstraction.calculateUserOperationHash(sponsoredUserOp, network.chainId);
      console.log('🔗 User Operation hash:', userOpHash);

      // Step 7: Submit to bundler (this would normally require proper signature)
      console.log('📤 Submitting to bundler...');
      
      // In a real scenario, you would:
      // 1. Sign the userOpHash with the user's wallet
      // 2. Add the signature to the User Operation
      // 3. Submit to the bundler
      
      console.log('ℹ️  Note: In production, you would sign the User Operation and submit to bundler');

    } catch (error) {
      console.log('❌ Sponsorship failed:', error);
    }

    // Additional features
    console.log('🔧 Additional features:');
    
    // Check paymaster status
    try {
      const paymasterStatus = await paymasterService.getStatus();
      console.log('📊 Paymaster status:', paymasterStatus.status);
      console.log('🌐 Supported chains:', paymasterStatus.supportedChains);
    } catch (error) {
      console.log('❌ Failed to get paymaster status:', error);
    }

    // Get gas estimates
    try {
      const gasEstimates = await paymasterService.getGasEstimates(userOp, network.chainId);
      console.log('⛽ Gas estimates:');
      console.log('  Pre-verification:', gasEstimates.preVerificationGas.toString());
      console.log('  Verification limit:', gasEstimates.verificationGasLimit.toString());
      console.log('  Call limit:', gasEstimates.callGasLimit.toString());
    } catch (error) {
      console.log('❌ Failed to get gas estimates:', error);
    }

  } catch (error) {
    console.error('💥 Error in Account Abstraction example:', error);
  }
}

// Run the example
if (require.main === module) {
  accountAbstractionExample().catch(console.error);
}

export { accountAbstractionExample };
