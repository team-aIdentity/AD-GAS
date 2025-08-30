import { NetworkManager } from '../networks/NetworkManager';
import { NetworkConfig } from '../types';

describe('NetworkManager', () => {
  let networkManager: NetworkManager;
  let testNetworks: NetworkConfig[];

  beforeEach(() => {
    testNetworks = [
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

    networkManager = new NetworkManager(testNetworks);
  });

  describe('Initialization', () => {
    it('should initialize with provided networks', () => {
      expect(networkManager.getAvailableNetworks()).toHaveLength(2);
      expect(networkManager.getCurrentNetwork().chainId).toBe(1);
    });

    it('should initialize with default networks when none provided', () => {
      const emptyNetworkManager = new NetworkManager([]);
      const networks = emptyNetworkManager.getAvailableNetworks();
      expect(networks.length).toBeGreaterThan(0);
    });
  });

  describe('Network Operations', () => {
    it('should get current network', () => {
      const currentNetwork = networkManager.getCurrentNetwork();
      expect(currentNetwork.chainId).toBe(1);
      expect(currentNetwork.name).toBe('Ethereum Mainnet');
    });

    it('should switch networks successfully', async () => {
      await networkManager.switchNetwork(137);
      const currentNetwork = networkManager.getCurrentNetwork();
      expect(currentNetwork.chainId).toBe(137);
    });

    it('should throw error for unsupported network', async () => {
      await expect(networkManager.switchNetwork(999)).rejects.toThrow('Network 999 is not supported');
    });

    it('should add new network', () => {
      const newNetwork: NetworkConfig = {
        chainId: 42161,
        name: 'Arbitrum One',
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
        gasTokens: ['0x0000000000000000000000000000000000000000'],
      };

      networkManager.addNetwork(newNetwork);
      expect(networkManager.isNetworkSupported(42161)).toBe(true);
      expect(networkManager.getNetwork(42161)).toEqual(newNetwork);
    });

    it('should remove network', () => {
      networkManager.removeNetwork(137);
      expect(networkManager.isNetworkSupported(137)).toBe(false);
    });

    it('should not remove current network', () => {
      expect(() => networkManager.removeNetwork(1)).toThrow('Cannot remove currently active network');
    });
  });

  describe('Network Queries', () => {
    it('should check if network is supported', () => {
      expect(networkManager.isNetworkSupported(1)).toBe(true);
      expect(networkManager.isNetworkSupported(137)).toBe(true);
      expect(networkManager.isNetworkSupported(999)).toBe(false);
    });

    it('should get supported chain IDs', () => {
      const chainIds = networkManager.getSupportedChainIds();
      expect(chainIds).toContain(1);
      expect(chainIds).toContain(137);
      expect(chainIds).toHaveLength(2);
    });

    it('should get network by chain ID', () => {
      const network = networkManager.getNetwork(137);
      expect(network?.name).toBe('Polygon Mainnet');
      
      const nonExistentNetwork = networkManager.getNetwork(999);
      expect(nonExistentNetwork).toBeUndefined();
    });
  });
});
