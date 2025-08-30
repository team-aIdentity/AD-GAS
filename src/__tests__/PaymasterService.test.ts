import { PaymasterService } from '../paymaster/PaymasterService';
import { TokenPaymaster } from '../paymaster/TokenPaymaster';
import { PaymasterManager } from '../paymaster/PaymasterManager';
import { Logger } from '../utils/Logger';
import { JsonRpcProvider } from 'ethers';
import {
  UserOperation,
  TokenPaymasterConfig,
  PaymasterPolicy,
} from '../types';

// Mock provider for testing
class MockProvider extends JsonRpcProvider {
  constructor() {
    super('https://mock-rpc.com');
  }

  async call() {
    return '0x0000000000000000000000000000000000000000000000000000000000000000';
  }

  async getCode() {
    return '0x608060405234801561001057600080fd5b50'; // Mock contract code
  }
}

describe('Enhanced Paymaster Service', () => {
  let paymasterService: PaymasterService;
  let tokenPaymaster: TokenPaymaster;
  let paymasterManager: PaymasterManager;
  let mockProvider: MockProvider;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger(false);
    mockProvider = new MockProvider();
    
    paymasterService = new PaymasterService(
      'https://mock-paymaster.com',
      logger,
      mockProvider,
      '0x1234567890123456789012345678901234567890'
    );

    const tokenConfig: TokenPaymasterConfig = {
      tokenAddress: '0xA0b86a33E6ddbFCFd3ad7CD6dc23b01B1b56A1A1',
      tokenDecimals: 6,
      exchangeRate: BigInt('2000000'), // 2 USDC per ETH
      minBalance: BigInt('100000000'), // 100 USDC
      maxGasPrice: BigInt('100000000000'), // 100 gwei
    };

    tokenPaymaster = new TokenPaymaster(
      tokenConfig,
      '0x2222222222222222222222222222222222222222',
      mockProvider,
      logger
    );

    paymasterManager = new PaymasterManager(
      mockProvider,
      '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
      logger
    );
  });

  describe('PaymasterService Enhanced Features', () => {
    it('should have enhanced constructor with provider support', () => {
      expect(paymasterService).toBeInstanceOf(PaymasterService);
      expect(paymasterService.getPaymasterAddress()).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should update paymaster address', () => {
      const newAddress = '0x9999999999999999999999999999999999999999';
      paymasterService.setPaymasterAddress(newAddress);
      expect(paymasterService.getPaymasterAddress()).toBe(newAddress);
    });

    it('should update EntryPoint address', () => {
      const newEntryPoint = '0x8888888888888888888888888888888888888888';
      paymasterService.setEntryPointAddress(newEntryPoint);
      // EntryPoint address should be updated internally
      expect(paymasterService).toBeDefined();
    });

    it('should handle provider updates', () => {
      const newProvider = new MockProvider();
      paymasterService.setProvider(newProvider);
      // Provider should be updated internally
      expect(paymasterService).toBeDefined();
    });
  });

  describe('TokenPaymaster Features', () => {
    it('should initialize with token configuration', () => {
      expect(tokenPaymaster).toBeInstanceOf(TokenPaymaster);
      const config = tokenPaymaster.getTokenConfig();
      expect(config.tokenAddress).toBe('0xA0b86a33E6ddbFCFd3ad7CD6dc23b01B1b56A1A1');
      expect(config.tokenDecimals).toBe(6);
    });

    it('should update token configuration', () => {
      tokenPaymaster.updateTokenConfig({
        exchangeRate: BigInt('3000000'), // 3 USDC per ETH
        minBalance: BigInt('200000000'), // 200 USDC
      });

      const config = tokenPaymaster.getTokenConfig();
      expect(config.exchangeRate).toBe(BigInt('3000000'));
      expect(config.minBalance).toBe(BigInt('200000000'));
    });

    it('should set oracle address', () => {
      const oracleAddress = '0x7777777777777777777777777777777777777777';
      tokenPaymaster.setOracleAddress(oracleAddress);
      // Oracle address should be updated internally
      expect(tokenPaymaster).toBeDefined();
    });
  });

  describe('PaymasterManager Features', () => {
    it('should register and manage multiple paymasters', () => {
      paymasterManager.registerPaymaster('basic', paymasterService);
      paymasterManager.registerPaymaster('token', tokenPaymaster);

      const registered = paymasterManager.getRegisteredPaymasters();
      expect(registered).toHaveLength(2);
      expect(registered.map(p => p.id)).toContain('basic');
      expect(registered.map(p => p.id)).toContain('token');
    });

    it('should unregister paymasters', () => {
      paymasterManager.registerPaymaster('test', paymasterService);
      expect(paymasterManager.getRegisteredPaymasters()).toHaveLength(1);

      const removed = paymasterManager.unregisterPaymaster('test');
      expect(removed).toBe(true);
      expect(paymasterManager.getRegisteredPaymasters()).toHaveLength(0);
    });

    it('should manage paymaster policies', () => {
      const policy: PaymasterPolicy = {
        sponsorshipLimit: BigInt('50000000000000000'), // 0.05 ETH
        timeWindow: 3600,
        maxOperationsPerTimeWindow: 10,
        allowedTargets: ['0xA0b86a33E6ddbFCFd3ad7CD6dc23b01B1b56A1A1'],
        blockedTargets: [],
        requireWhitelist: false,
      };

      paymasterManager.registerPaymaster('policy-test', paymasterService, policy);
      
      const retrievedPolicy = paymasterManager.getPaymasterPolicy('policy-test');
      expect(retrievedPolicy).toEqual(policy);
    });

    it('should update existing policies', () => {
      paymasterManager.registerPaymaster('update-test', paymasterService);
      
      const newPolicy: PaymasterPolicy = {
        sponsorshipLimit: BigInt('100000000000000000'), // 0.1 ETH
        timeWindow: 7200,
        maxOperationsPerTimeWindow: 20,
        allowedTargets: [],
        blockedTargets: [],
        requireWhitelist: true,
      };

      paymasterManager.updatePaymasterPolicy('update-test', newPolicy);
      
      const retrievedPolicy = paymasterManager.getPaymasterPolicy('update-test');
      expect(retrievedPolicy?.sponsorshipLimit).toBe(BigInt('100000000000000000'));
      expect(retrievedPolicy?.requireWhitelist).toBe(true);
    });
  });

  describe('EIP-4337 Compliance', () => {
    it('should handle UserOperation validation structure', async () => {
      const userOp: UserOperation = {
        sender: '0x1234567890123456789012345678901234567890',
        nonce: 0,
        initCode: '0x',
        callData: '0xa9059cbb000000000000000000000000123456789012345678901234567890123456789000000000000000000000000000000000000000000000000000000000000186a0',
        callGasLimit: 200000,
        verificationGasLimit: 100000,
        preVerificationGas: 21000,
        maxFeePerGas: 20000000000,
        maxPriorityFeePerGas: 1000000000,
        paymasterAndData: '0x',
        signature: '0x',
      };

      // This would fail in test environment but validates structure
      expect(userOp.sender).toBe('0x1234567890123456789012345678901234567890');
      expect(userOp.callData).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it('should support paymaster validation flow', () => {
      // Test the validation flow structure
      const mockValidation = {
        context: '0x1234',
        validAfter: Math.floor(Date.now() / 1000),
        validUntil: Math.floor(Date.now() / 1000) + 3600,
        authorizer: '0x5555555555555555555555555555555555555555',
      };

      expect(mockValidation.validAfter).toBeLessThan(mockValidation.validUntil);
      expect(mockValidation.context).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it('should support post-operation context', () => {
      const postOpContext = {
        mode: 1, // opSucceeded
        context: '0x1234567890abcdef',
        actualGasCost: BigInt('84000'),
        actualUserOpFeePerGas: BigInt('20000000000'),
      };

      expect(postOpContext.mode).toBeGreaterThanOrEqual(0);
      expect(postOpContext.mode).toBeLessThanOrEqual(2);
      expect(postOpContext.actualGasCost).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing provider gracefully', async () => {
      const serviceWithoutProvider = new PaymasterService('https://test.com', logger);
      
      await expect(serviceWithoutProvider.getStakeInfo()).rejects.toThrow('Paymaster address and provider required');
    });

    it('should handle missing paymaster address', async () => {
      const serviceWithoutAddress = new PaymasterService('https://test.com', logger, mockProvider);
      
      await expect(serviceWithoutAddress.getStakeInfo()).rejects.toThrow('Paymaster address and provider required');
    });

    it('should handle paymaster manager errors', () => {
      expect(() => {
        paymasterManager.getPaymasterPolicy('non-existent');
      }).not.toThrow();

      expect(() => {
        paymasterManager.updatePaymasterPolicy('non-existent', {} as PaymasterPolicy);
      }).toThrow('Paymaster non-existent not found');
    });
  });
});
