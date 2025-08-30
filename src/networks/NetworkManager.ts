import { NetworkConfig, GaslessSDKError, ErrorCodes } from '../types';

export class NetworkManager {
  private networks: Map<number, NetworkConfig>;
  private currentNetworkId: number;

  constructor(networks: NetworkConfig[]) {
    this.networks = new Map();
    
    // Add default networks if none provided
    if (networks.length === 0) {
      networks = this.getDefaultNetworks();
    }

    networks.forEach(network => {
      this.networks.set(network.chainId, network);
    });

    this.currentNetworkId = networks[0]?.chainId || 1;
  }

  /**
   * Get default network configurations
   */
  private getDefaultNetworks(): NetworkConfig[] {
    return [
      {
        chainId: 1,
        name: 'Ethereum Mainnet',
        rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/your-api-key',
        gasTokens: ['0x0000000000000000000000000000000000000000'], // ETH
      },
      {
        chainId: 5,
        name: 'Ethereum Goerli',
        rpcUrl: 'https://eth-goerli.g.alchemy.com/v2/your-api-key',
        gasTokens: ['0x0000000000000000000000000000000000000000'], // ETH
      },
      {
        chainId: 137,
        name: 'Polygon Mainnet',
        rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/your-api-key',
        gasTokens: [
          '0x0000000000000000000000000000000000000000', // MATIC
          '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
        ],
      },
      {
        chainId: 80001,
        name: 'Polygon Mumbai',
        rpcUrl: 'https://polygon-mumbai.g.alchemy.com/v2/your-api-key',
        gasTokens: ['0x0000000000000000000000000000000000000000'], // MATIC
      },
      {
        chainId: 42161,
        name: 'Arbitrum One',
        rpcUrl: 'https://arb-mainnet.g.alchemy.com/v2/your-api-key',
        gasTokens: ['0x0000000000000000000000000000000000000000'], // ETH
      },
      {
        chainId: 56,
        name: 'BSC Mainnet',
        rpcUrl: 'https://bsc-dataseed.binance.org/',
        gasTokens: [
          '0x0000000000000000000000000000000000000000', // BNB
          '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC
        ],
      },
    ];
  }

  /**
   * Get current network configuration
   */
  public getCurrentNetwork(): NetworkConfig {
    const network = this.networks.get(this.currentNetworkId);
    if (!network) {
      throw new GaslessSDKError(
        `Network ${this.currentNetworkId} not found`,
        ErrorCodes.NETWORK_ERROR
      );
    }
    return network;
  }

  /**
   * Switch to a different network
   */
  public async switchNetwork(chainId: number): Promise<void> {
    if (!this.networks.has(chainId)) {
      throw new GaslessSDKError(
        `Network ${chainId} is not supported`,
        ErrorCodes.NETWORK_ERROR
      );
    }

    this.currentNetworkId = chainId;
  }

  /**
   * Add a new network configuration
   */
  public addNetwork(network: NetworkConfig): void {
    this.networks.set(network.chainId, network);
  }

  /**
   * Remove a network configuration
   */
  public removeNetwork(chainId: number): void {
    if (chainId === this.currentNetworkId) {
      throw new GaslessSDKError(
        'Cannot remove currently active network',
        ErrorCodes.NETWORK_ERROR
      );
    }
    this.networks.delete(chainId);
  }

  /**
   * Get all available networks
   */
  public getAvailableNetworks(): NetworkConfig[] {
    return Array.from(this.networks.values());
  }

  /**
   * Get network by chain ID
   */
  public getNetwork(chainId: number): NetworkConfig | undefined {
    return this.networks.get(chainId);
  }

  /**
   * Check if network is supported
   */
  public isNetworkSupported(chainId: number): boolean {
    return this.networks.has(chainId);
  }

  /**
   * Get supported chain IDs
   */
  public getSupportedChainIds(): number[] {
    return Array.from(this.networks.keys());
  }
}
