import { JsonRpcProvider, Contract, Interface, concat } from 'ethers';
import { GaslessSDKError, ErrorCodes, BigNumber } from '../types';
import { Logger } from './Logger';

export interface SmartAccountConfig {
  factoryAddress: string;
  implementationAddress: string;
  salt?: string;
}

export class SmartAccountFactory {
  private provider: JsonRpcProvider;
  private factoryAddress: string;
  private logger: Logger;

  constructor(provider: JsonRpcProvider, factoryAddress: string, logger?: Logger) {
    this.provider = provider;
    this.factoryAddress = factoryAddress;
    this.logger = logger || new Logger(false);
  }

  /**
   * Calculate smart account address before deployment
   */
  public async getAccountAddress(
    owner: string,
    salt: string = '0'
  ): Promise<string> {
    try {
      // Standard factory ABI for getAddress function
      const factoryAbi = [
        'function getAddress(address owner, uint256 salt) view returns (address)',
      ];

      const factoryContract = new Contract(
        this.factoryAddress,
        factoryAbi,
        this.provider
      );

      const accountAddress = await factoryContract.getFunction('getAddress')(owner, salt);
      
      this.logger.debug_log(`Calculated smart account address: ${accountAddress} for owner: ${owner}`);
      return accountAddress;
    } catch (error) {
      this.logger.error('Failed to calculate smart account address:', error);
      throw new GaslessSDKError(
        'Failed to calculate smart account address',
        ErrorCodes.NETWORK_ERROR,
        error
      );
    }
  }

  /**
   * Check if smart account is already deployed
   */
  public async isAccountDeployed(accountAddress: string): Promise<boolean> {
    try {
      const code = await this.provider.getCode(accountAddress);
      return code !== '0x';
    } catch (error) {
      this.logger.error('Failed to check account deployment status:', error);
      return false;
    }
  }

  /**
   * Generate initCode for smart account deployment
   */
  public generateInitCode(
    owner: string,
    salt: string = '0'
  ): string {
    try {
      // Standard factory call for createAccount
      const factoryInterface = new Interface([
        'function createAccount(address owner, uint256 salt) returns (address)',
      ]);

      const callData = factoryInterface.encodeFunctionData('createAccount', [owner, salt]);
      
      // Combine factory address and call data
      const initCode = concat([this.factoryAddress, callData]);
      
      this.logger.debug_log(`Generated initCode: ${initCode}`);
      return initCode;
    } catch (error) {
      this.logger.error('Failed to generate initCode:', error);
      throw new GaslessSDKError(
        'Failed to generate initCode',
        ErrorCodes.INVALID_SIGNATURE,
        error
      );
    }
  }

  /**
   * Deploy smart account if not already deployed
   */
  public async deployAccountIfNeeded(
    owner: string,
    salt: string = '0'
  ): Promise<{ accountAddress: string; isDeployed: boolean; deploymentTx?: string }> {
    try {
      const accountAddress = await this.getAccountAddress(owner, salt);
      const isDeployed = await this.isAccountDeployed(accountAddress);

      if (isDeployed) {
        this.logger.info(`Smart account already deployed at: ${accountAddress}`);
        return { accountAddress, isDeployed: true };
      }

      this.logger.info(`Deploying smart account for owner: ${owner}`);

      // For actual deployment, this would require a transaction
      // This is a placeholder - in practice, deployment happens via UserOperation
      
      return {
        accountAddress,
        isDeployed: false,
        deploymentTx: undefined,
      };
    } catch (error) {
      this.logger.error('Failed to deploy smart account:', error);
      throw new GaslessSDKError(
        'Failed to deploy smart account',
        ErrorCodes.TRANSACTION_FAILED,
        error
      );
    }
  }

  /**
   * Estimate gas for smart account deployment
   */
  public async estimateDeploymentGas(
    owner: string,
    salt: string = '0'
  ): Promise<BigNumber> {
    try {
      const factoryAbi = [
        'function createAccount(address owner, uint256 salt) returns (address)',
      ];

      const factoryContract = new Contract(
        this.factoryAddress,
        factoryAbi,
        this.provider
      );

      const gasEstimate = await factoryContract.getFunction('createAccount').estimateGas(owner, salt);
      
      // Add 20% buffer
      return (gasEstimate * BigInt(120)) / BigInt(100);
    } catch (error) {
      this.logger.error('Failed to estimate deployment gas:', error);
      // Return default estimate if calculation fails
      return BigInt(500000);
    }
  }

  /**
   * Get smart account factory address
   */
  public getFactoryAddress(): string {
    return this.factoryAddress;
  }

  /**
   * Update factory address
   */
  public setFactoryAddress(address: string): void {
    this.factoryAddress = address;
    this.logger.info(`Factory address updated to: ${address}`);
  }
}
