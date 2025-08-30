import { ethers, Contract, JsonRpcProvider, Wallet } from 'ethers';
import {
  PaymasterStakeInfo,
  PaymasterPolicy,
  TokenPaymasterConfig,
  GaslessSDKError,
  ErrorCodes,
  BigNumber,
} from '../types';
import { Logger } from '../utils/Logger';

/**
 * Factory for creating and managing paymaster contracts
 * Implements EIP-4337 paymaster deployment and management
 */
export class PaymasterFactory {
  private provider: JsonRpcProvider;
  private entryPointAddress: string;
  private logger: Logger;
  private deployer?: Wallet;

  constructor(
    provider: JsonRpcProvider,
    entryPointAddress: string,
    logger?: Logger,
    deployer?: Wallet
  ) {
    this.provider = provider;
    this.entryPointAddress = entryPointAddress;
    this.logger = logger || new Logger(false);
    this.deployer = deployer;
  }

  /**
   * Deploy a new basic paymaster contract
   */
  public async deployBasicPaymaster(
    owner: string,
    initialDeposit: BigNumber = BigInt(0)
  ): Promise<{ address: string; transactionHash: string }> {
    try {
      if (!this.deployer) {
        throw new GaslessSDKError(
          'Deployer wallet required for paymaster deployment',
          ErrorCodes.INVALID_SIGNATURE
        );
      }

      this.logger.info('Deploying basic paymaster contract');

      // Basic paymaster contract bytecode (simplified version)
      const paymasterBytecode = await this.getBasicPaymasterBytecode();
      
      // Deploy contract
      const factory = new ethers.ContractFactory(
        this.getBasicPaymasterABI(),
        paymasterBytecode,
        this.deployer
      );

      const paymaster = await factory.deploy(this.entryPointAddress, owner, {
        value: initialDeposit,
      });

      await paymaster.waitForDeployment();
      const address = await paymaster.getAddress();
      const deploymentTx = paymaster.deploymentTransaction();

      this.logger.info(`Basic paymaster deployed at: ${address}`);

      return {
        address,
        transactionHash: deploymentTx?.hash || '',
      };
    } catch (error) {
      this.logger.error('Failed to deploy basic paymaster:', error);
      throw new GaslessSDKError(
        'Failed to deploy basic paymaster',
        ErrorCodes.TRANSACTION_FAILED,
        error
      );
    }
  }

  /**
   * Deploy a token paymaster contract
   */
  public async deployTokenPaymaster(
    tokenConfig: TokenPaymasterConfig,
    owner: string,
    initialDeposit: BigNumber = BigInt(0)
  ): Promise<{ address: string; transactionHash: string }> {
    try {
      if (!this.deployer) {
        throw new GaslessSDKError(
          'Deployer wallet required for paymaster deployment',
          ErrorCodes.INVALID_SIGNATURE
        );
      }

      this.logger.info('Deploying token paymaster contract');

      // Token paymaster contract bytecode
      const paymasterBytecode = await this.getTokenPaymasterBytecode();
      
      // Deploy contract
      const factory = new ethers.ContractFactory(
        this.getTokenPaymasterABI(),
        paymasterBytecode,
        this.deployer
      );

      const paymaster = await factory.deploy(
        this.entryPointAddress,
        owner,
        tokenConfig.tokenAddress,
        tokenConfig.exchangeRate,
        {
          value: initialDeposit,
        }
      );

      await paymaster.waitForDeployment();
      const address = await paymaster.getAddress();
      const deploymentTx = paymaster.deploymentTransaction();

      this.logger.info(`Token paymaster deployed at: ${address}`);

      return {
        address,
        transactionHash: deploymentTx?.hash || '',
      };
    } catch (error) {
      this.logger.error('Failed to deploy token paymaster:', error);
      throw new GaslessSDKError(
        'Failed to deploy token paymaster',
        ErrorCodes.TRANSACTION_FAILED,
        error
      );
    }
  }

  /**
   * Stake ETH for paymaster reputation
   */
  public async stakeForPaymaster(
    paymasterAddress: string,
    stakeAmount: BigNumber,
    unstakeDelaySec: number = 86400 // 1 day default
  ): Promise<string> {
    try {
      if (!this.deployer) {
        throw new GaslessSDKError(
          'Deployer wallet required for staking',
          ErrorCodes.INVALID_SIGNATURE
        );
      }

      this.logger.info(`Staking ${stakeAmount.toString()} ETH for paymaster: ${paymasterAddress}`);

      // EntryPoint contract ABI for staking
      const entryPointAbi = [
        'function addStake(uint32 unstakeDelaySec) external payable',
      ];

      const entryPointContract = new Contract(
        this.entryPointAddress,
        entryPointAbi,
        this.deployer
      );

      // Add stake
      const tx = await entryPointContract.addStake(unstakeDelaySec, {
        value: stakeAmount,
      });

      await tx.wait();

      this.logger.info(`Staking transaction completed: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      this.logger.error('Failed to stake for paymaster:', error);
      throw new GaslessSDKError(
        'Failed to stake for paymaster',
        ErrorCodes.TRANSACTION_FAILED,
        error
      );
    }
  }

  /**
   * Withdraw stake from paymaster
   */
  public async withdrawStake(paymasterAddress: string, withdrawAddress: string): Promise<string> {
    try {
      if (!this.deployer) {
        throw new GaslessSDKError(
          'Deployer wallet required for withdrawal',
          ErrorCodes.INVALID_SIGNATURE
        );
      }

      this.logger.info(`Withdrawing stake for paymaster: ${paymasterAddress}`);

      // EntryPoint contract ABI for withdrawal
      const entryPointAbi = [
        'function withdrawStake(address payable withdrawAddress) external',
      ];

      const entryPointContract = new Contract(
        this.entryPointAddress,
        entryPointAbi,
        this.deployer
      );

      // Withdraw stake
      const tx = await entryPointContract.withdrawStake(withdrawAddress);
      await tx.wait();

      this.logger.info(`Stake withdrawal transaction completed: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      this.logger.error('Failed to withdraw stake:', error);
      throw new GaslessSDKError(
        'Failed to withdraw stake',
        ErrorCodes.TRANSACTION_FAILED,
        error
      );
    }
  }

  /**
   * Deposit ETH to paymaster for gas payments
   */
  public async depositToPaymaster(
    paymasterAddress: string,
    amount: BigNumber
  ): Promise<string> {
    try {
      if (!this.deployer) {
        throw new GaslessSDKError(
          'Deployer wallet required for deposit',
          ErrorCodes.INVALID_SIGNATURE
        );
      }

      this.logger.info(`Depositing ${amount.toString()} ETH to paymaster: ${paymasterAddress}`);

      // EntryPoint contract ABI for deposits
      const entryPointAbi = [
        'function depositTo(address account) external payable',
      ];

      const entryPointContract = new Contract(
        this.entryPointAddress,
        entryPointAbi,
        this.deployer
      );

      // Deposit to paymaster
      const tx = await entryPointContract.depositTo(paymasterAddress, {
        value: amount,
      });

      await tx.wait();

      this.logger.info(`Deposit transaction completed: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      this.logger.error('Failed to deposit to paymaster:', error);
      throw new GaslessSDKError(
        'Failed to deposit to paymaster',
        ErrorCodes.TRANSACTION_FAILED,
        error
      );
    }
  }

  /**
   * Get basic paymaster ABI
   */
  private getBasicPaymasterABI(): string[] {
    return [
      'constructor(address entryPoint, address owner)',
      'function validatePaymasterUserOp(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash, uint256 maxCost) external returns (bytes context, uint256 validationData)',
      'function postOp(uint8 mode, bytes context, uint256 actualGasCost, uint256 actualUserOpFeePerGas) external',
      'function deposit() external payable',
      'function withdrawTo(address payable withdrawAddress, uint256 amount) external',
      'function addStake(uint32 unstakeDelaySec) external payable',
      'function unlockStake() external',
      'function withdrawStake(address payable withdrawAddress) external',
    ];
  }

  /**
   * Get token paymaster ABI
   */
  private getTokenPaymasterABI(): string[] {
    return [
      'constructor(address entryPoint, address owner, address token, uint256 exchangeRate)',
      'function validatePaymasterUserOp(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp, bytes32 userOpHash, uint256 maxCost) external returns (bytes context, uint256 validationData)',
      'function postOp(uint8 mode, bytes context, uint256 actualGasCost, uint256 actualUserOpFeePerGas) external',
      'function setExchangeRate(uint256 newRate) external',
      'function setTokenAddress(address newToken) external',
      'function withdrawToken(address token, address to, uint256 amount) external',
    ];
  }

  /**
   * Get basic paymaster bytecode (placeholder - in production, use actual compiled bytecode)
   */
  private async getBasicPaymasterBytecode(): Promise<string> {
    // This would contain the actual compiled bytecode of a basic paymaster contract
    // For now, returning a placeholder
    throw new GaslessSDKError(
      'Paymaster bytecode not available - deploy using external tools',
      ErrorCodes.PAYMASTER_ERROR
    );
  }

  /**
   * Get token paymaster bytecode (placeholder - in production, use actual compiled bytecode)
   */
  private async getTokenPaymasterBytecode(): Promise<string> {
    // This would contain the actual compiled bytecode of a token paymaster contract
    // For now, returning a placeholder
    throw new GaslessSDKError(
      'Token paymaster bytecode not available - deploy using external tools',
      ErrorCodes.PAYMASTER_ERROR
    );
  }

  /**
   * Calculate paymaster deployment address before deployment
   */
  public async calculatePaymasterAddress(
    salt: string,
    initCode: string
  ): Promise<string> {
    try {
      if (!this.deployer) {
        throw new GaslessSDKError(
          'Deployer wallet required',
          ErrorCodes.INVALID_SIGNATURE
        );
      }

      // Calculate CREATE2 address
      const deployerAddress = await this.deployer.getAddress();
      const initCodeHash = ethers.keccak256(initCode);
      
      const address = ethers.getCreate2Address(
        deployerAddress,
        salt,
        initCodeHash
      );

      return address;
    } catch (error) {
      this.logger.error('Failed to calculate paymaster address:', error);
      throw new GaslessSDKError(
        'Failed to calculate paymaster address',
        ErrorCodes.PAYMASTER_ERROR,
        error
      );
    }
  }

  /**
   * Set deployer wallet
   */
  public setDeployer(deployer: Wallet): void {
    this.deployer = deployer;
    this.logger.info('Paymaster factory deployer wallet updated');
  }
}
