import { AccountAbstraction } from '../core/AccountAbstraction';
import { PaymasterService } from '../paymaster/PaymasterService';
import { Logger } from '../utils/Logger';
import { UserOperation } from '../types';

// Mock PaymasterService
class MockPaymasterService extends PaymasterService {
  constructor() {
    super('https://mock-paymaster.com', new Logger(false));
  }

  async getGasEstimates() {
    return {
      preVerificationGas: '21000',
      verificationGasLimit: '100000',
      callGasLimit: '200000',
    };
  }

  async requestSponsorship() {
    return {
      paymasterAndData: '0x1234567890123456789012345678901234567890000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      preVerificationGas: '21000',
      verificationGasLimit: '100000',
      callGasLimit: '200000',
    };
  }
}

describe('AccountAbstraction', () => {
  let accountAbstraction: AccountAbstraction;
  let mockPaymasterService: MockPaymasterService;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger(false);
    mockPaymasterService = new MockPaymasterService();
    accountAbstraction = new AccountAbstraction(mockPaymasterService, logger);
  });

  describe('Initialization', () => {
    it('should initialize with default EntryPoint address', () => {
      expect(accountAbstraction.getEntryPointAddress()).toBe('0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789');
    });

    it('should allow custom EntryPoint address', () => {
      const customEntryPoint = '0x1234567890123456789012345678901234567890';
      const customAA = new AccountAbstraction(mockPaymasterService, logger, customEntryPoint);
      expect(customAA.getEntryPointAddress()).toBe(customEntryPoint);
    });

    it('should update EntryPoint address', () => {
      const newAddress = '0x9876543210987654321098765432109876543210';
      accountAbstraction.setEntryPointAddress(newAddress);
      expect(accountAbstraction.getEntryPointAddress()).toBe(newAddress);
    });
  });

  describe('User Operation Hash Calculation', () => {
    it('should calculate User Operation hash', () => {
      const userOp: UserOperation = {
        sender: '0x1234567890123456789012345678901234567890',
        nonce: 0,
        initCode: '0x',
        callData: '0x',
        callGasLimit: 200000,
        verificationGasLimit: 100000,
        preVerificationGas: 21000,
        maxFeePerGas: 1000000000,
        maxPriorityFeePerGas: 1000000000,
        paymasterAndData: '0x',
        signature: '0x',
      };

      const hash = accountAbstraction.calculateUserOperationHash(userOp, 1);
      expect(hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
    });
  });

  describe('User Operation Receipt', () => {
    it('should handle getUserOperationReceipt gracefully', async () => {
      // This will fail in test environment but should not throw
      const receipt = await accountAbstraction.getUserOperationReceipt(
        '0x1234567890123456789012345678901234567890123456789012345678901234',
        1
      );
      expect(receipt).toBeNull();
    });
  });
});
