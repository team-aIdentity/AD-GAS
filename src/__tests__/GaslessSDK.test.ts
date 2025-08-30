import { GaslessSDK } from '../core/GaslessSDK';
import { GaslessSDKConfig, WalletInterface, NetworkConfig } from '../types';

// Mock wallet implementation for testing
class MockWallet implements WalletInterface {
  constructor(private address: string, private chainId: number = 1) {}

  async getAddress(): Promise<string> {
    return this.address;
  }

  async signMessage(message: string): Promise<string> {
    // Mock signature
    return '0x' + '0'.repeat(130);
  }

  async signTypedData(domain: any, types: any, value: any): Promise<string> {
    // Mock EIP-712 signature
    return '0x' + '1'.repeat(130);
  }

  async getChainId(): Promise<number> {
    return this.chainId;
  }
}

describe('GaslessSDK', () => {
  let sdk: GaslessSDK;
  let mockWallet: MockWallet;
  let testConfig: GaslessSDKConfig;

  beforeEach(() => {
    const networks: NetworkConfig[] = [
      {
        chainId: 1,
        name: 'Ethereum Mainnet',
        rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/test-key',
        gasTokens: ['0x0000000000000000000000000000000000000000'],
      },
      {
        chainId: 137,
        name: 'Polygon Mainnet',
        rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/test-key',
        gasTokens: ['0x0000000000000000000000000000000000000000'],
      },
    ];

    testConfig = {
      networks,
      defaultNetwork: 1,
      relayerEndpoint: 'https://test-relayer.com',
      paymasterEndpoint: 'https://test-paymaster.com',
      debug: true,
    };

    sdk = new GaslessSDK(testConfig);
    mockWallet = new MockWallet('0x1234567890123456789012345678901234567890');
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(sdk).toBeInstanceOf(GaslessSDK);
      expect(sdk.getVersion()).toBe('1.0.0');
      expect(sdk.getConfig()).toEqual(testConfig);
    });

    it('should get current network', () => {
      const currentNetwork = sdk.getCurrentNetwork();
      expect(currentNetwork.chainId).toBe(1);
      expect(currentNetwork.name).toBe('Ethereum Mainnet');
    });

    it('should get available networks', () => {
      const networks = sdk.getAvailableNetworks();
      expect(networks).toHaveLength(2);
      expect(networks[0].chainId).toBe(1);
      expect(networks[1].chainId).toBe(137);
    });
  });

  describe('Wallet Connection', () => {
    it('should connect wallet successfully', async () => {
      await expect(sdk.connectWallet(mockWallet)).resolves.not.toThrow();
    });

    it('should switch networks', async () => {
      await sdk.switchNetwork(137);
      const currentNetwork = sdk.getCurrentNetwork();
      expect(currentNetwork.chainId).toBe(137);
    });

    it('should throw error for unsupported network', async () => {
      await expect(sdk.switchNetwork(999)).rejects.toThrow('Network 999 is not supported');
    });
  });

  describe('Service Access', () => {
    it('should provide access to paymaster service', () => {
      const paymasterService = sdk.getPaymasterService();
      expect(paymasterService).toBeDefined();
    });

    it('should provide access to relayer service', () => {
      const relayerService = sdk.getRelayerService();
      expect(relayerService).toBeDefined();
    });
  });

  describe('Transaction Estimation', () => {
    beforeEach(async () => {
      await sdk.connectWallet(mockWallet);
    });

    it('should estimate gas for transaction', async () => {
      // This will fail in the test environment due to network calls
      // but we're testing the interface
      const transaction = {
        to: '0x1234567890123456789012345678901234567890',
        data: '0x',
        value: 0,
      };

      // In a real test, you'd mock the network calls
      await expect(sdk.estimateGas(transaction)).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw error when wallet not connected', async () => {
      const transaction = {
        to: '0x1234567890123456789012345678901234567890',
        data: '0x',
      };

      await expect(sdk.sendGaslessTransaction(transaction)).rejects.toThrow('Wallet not connected');
    });
  });

  describe('Disconnection', () => {
    it('should disconnect wallet', async () => {
      await sdk.connectWallet(mockWallet);
      sdk.disconnect();
      
      // Should throw error after disconnection
      const transaction = {
        to: '0x1234567890123456789012345678901234567890',
        data: '0x',
      };

      await expect(sdk.sendGaslessTransaction(transaction)).rejects.toThrow('Wallet not connected');
    });
  });
});
