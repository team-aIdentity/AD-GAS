import { ethers, Contract, JsonRpcProvider } from 'ethers';
import {
  UserOperation,
  PaymasterRequest,
  PaymasterResponse,
  PaymasterValidationResult,
  PaymasterPostOpContext,
  TokenPaymasterConfig,
  GaslessSDKError,
  ErrorCodes,
  BigNumber,
} from '../types';
import { PaymasterService } from './PaymasterService';
import { Logger } from '../utils/Logger';

/**
 * Token Paymaster for paying gas fees with ERC-20 tokens
 * Based on EIP-4337 specification
 */
export class TokenPaymaster extends PaymasterService {
  private tokenConfig: TokenPaymasterConfig;
  private oracleAddress?: string;

  constructor(
    tokenConfig: TokenPaymasterConfig,
    paymasterAddress: string,
    provider: JsonRpcProvider,
    logger?: Logger,
    oracleAddress?: string,
    entryPointAddress?: string
  ) {
    super(
      undefined, // No HTTP endpoint needed for direct contract interaction
      logger,
      provider,
      paymasterAddress,
      entryPointAddress
    );
    
    this.tokenConfig = tokenConfig;
    this.oracleAddress = oracleAddress;
  }

  /**
   * Request sponsorship with token payment
   */
  public async requestSponsorship(request: PaymasterRequest): Promise<PaymasterResponse> {
    try {
      this.logger.info('Requesting token paymaster sponsorship');

      // Check if user has sufficient token balance
      const hasBalance = await this.checkTokenBalance(
        request.userOp.sender,
        request.userOp.callGasLimit
      );

      if (!hasBalance) {
        throw new GaslessSDKError(
          'Insufficient token balance for gas payment',
          ErrorCodes.INSUFFICIENT_FUNDS
        );
      }

      // Get current token exchange rate
      const exchangeRate = await this.getTokenExchangeRate();

      // Calculate required token amount
      const maxGasCost = BigInt(request.userOp.callGasLimit) * BigInt(request.userOp.maxFeePerGas);
      const requiredTokens = (maxGasCost * exchangeRate) / BigInt(10 ** 18);

      // Encode paymaster data
      const paymasterAndData = await this.encodePaymasterData(
        request.userOp.sender,
        requiredTokens
      );

      // Get gas estimates
      const gasEstimates = await this.getGasEstimates(request.userOp, request.chainId);

      return {
        paymasterAndData,
        preVerificationGas: gasEstimates.preVerificationGas,
        verificationGasLimit: gasEstimates.verificationGasLimit,
        callGasLimit: gasEstimates.callGasLimit,
        maxFeePerGas: request.userOp.maxFeePerGas,
        maxPriorityFeePerGas: request.userOp.maxPriorityFeePerGas,
      };
    } catch (error) {
      this.logger.error('Failed to request token paymaster sponsorship:', error);
      throw new GaslessSDKError(
        'Failed to request token paymaster sponsorship',
        ErrorCodes.PAYMASTER_ERROR,
        error
      );
    }
  }

  /**
   * Check if user has sufficient token balance
   */
  private async checkTokenBalance(userAddress: string, gasLimit: BigNumber): Promise<boolean> {
    try {
      if (!this.provider) {
        return false;
      }

      // ERC-20 token ABI
      const tokenAbi = [
        'function balanceOf(address owner) view returns (uint256)',
        'function allowance(address owner, address spender) view returns (uint256)',
      ];

      const tokenContract = new Contract(
        this.tokenConfig.tokenAddress,
        tokenAbi,
        this.provider
      );

      // Get user's token balance
      const balance = await tokenContract.balanceOf(userAddress);
      
      // Get allowance for paymaster
      const allowance = await tokenContract.allowance(userAddress, this.getPaymasterAddress());

      // Calculate required tokens
      const exchangeRate = await this.getTokenExchangeRate();
      const maxGasCost = BigInt(gasLimit) * this.tokenConfig.maxGasPrice;
      const requiredTokens = (maxGasCost * exchangeRate) / BigInt(10 ** 18);

      const hasBalance = BigInt(balance) >= requiredTokens;
      const hasAllowance = BigInt(allowance) >= requiredTokens;

      this.logger.debug_log('Token balance check:', {
        balance: balance.toString(),
        allowance: allowance.toString(),
        required: requiredTokens.toString(),
        hasBalance,
        hasAllowance,
      });

      return hasBalance && hasAllowance;
    } catch (error) {
      this.logger.error('Failed to check token balance:', error);
      return false;
    }
  }

  /**
   * Get token exchange rate (tokens per ETH)
   */
  private async getTokenExchangeRate(): Promise<BigNumber> {
    try {
      if (this.oracleAddress && this.provider) {
        // Use price oracle if available
        const oracleAbi = [
          'function getPrice() view returns (uint256)',
        ];

        const oracleContract = new Contract(
          this.oracleAddress,
          oracleAbi,
          this.provider
        );

        const price = await oracleContract.getPrice();
        return price;
      } else {
        // Use configured exchange rate
        return this.tokenConfig.exchangeRate;
      }
    } catch (error) {
      this.logger.warn('Failed to get oracle price, using configured rate:', error);
      return this.tokenConfig.exchangeRate;
    }
  }

  /**
   * Encode paymaster data for token payment
   */
  private async encodePaymasterData(userAddress: string, tokenAmount: BigNumber): Promise<string> {
    try {
      const paymasterAddress = this.getPaymasterAddress();
      if (!paymasterAddress) {
        throw new Error('Paymaster address not set');
      }

      // Encode paymaster data: paymaster address + token address + amount + user signature
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      
      const paymasterData = abiCoder.encode(
        ['address', 'uint256', 'uint48', 'uint48'],
        [
          this.tokenConfig.tokenAddress,
          tokenAmount,
          Math.floor(Date.now() / 1000), // validAfter
          Math.floor(Date.now() / 1000) + 3600, // validUntil (1 hour)
        ]
      );

      // Combine paymaster address with data
      return ethers.concat([paymasterAddress, paymasterData]);
    } catch (error) {
      this.logger.error('Failed to encode paymaster data:', error);
      throw new GaslessSDKError(
        'Failed to encode paymaster data',
        ErrorCodes.PAYMASTER_ERROR,
        error
      );
    }
  }

  /**
   * Validate token paymaster operation
   */
  public async validateTokenPayment(
    userOp: UserOperation,
    maxCost: BigNumber
  ): Promise<PaymasterValidationResult> {
    try {
      this.logger.info('Validating token paymaster operation');

      // Check token balance and allowance
      const hasBalance = await this.checkTokenBalance(userOp.sender, userOp.callGasLimit);
      
      if (!hasBalance) {
        throw new GaslessSDKError(
          'Insufficient token balance or allowance',
          ErrorCodes.INSUFFICIENT_FUNDS
        );
      }

      // Validate with contract
      return await this.validatePaymasterUserOp(userOp, maxCost);
    } catch (error) {
      this.logger.error('Failed to validate token payment:', error);
      throw new GaslessSDKError(
        'Failed to validate token payment',
        ErrorCodes.PAYMASTER_ERROR,
        error
      );
    }
  }

  /**
   * Calculate token cost for gas
   */
  public async calculateTokenCost(gasLimit: BigNumber, gasPrice: BigNumber): Promise<BigNumber> {
    try {
      const exchangeRate = await this.getTokenExchangeRate();
      const gasCostInWei = BigInt(gasLimit) * BigInt(gasPrice);
      const tokenCost = (gasCostInWei * exchangeRate) / BigInt(10 ** 18);
      
      return tokenCost;
    } catch (error) {
      this.logger.error('Failed to calculate token cost:', error);
      throw new GaslessSDKError(
        'Failed to calculate token cost',
        ErrorCodes.PAYMASTER_ERROR,
        error
      );
    }
  }

  /**
   * Get token configuration
   */
  public getTokenConfig(): TokenPaymasterConfig {
    return this.tokenConfig;
  }

  /**
   * Update token configuration
   */
  public updateTokenConfig(config: Partial<TokenPaymasterConfig>): void {
    this.tokenConfig = { ...this.tokenConfig, ...config };
    this.logger.info('Token paymaster configuration updated');
  }

  /**
   * Set oracle address for dynamic pricing
   */
  public setOracleAddress(address: string): void {
    this.oracleAddress = address;
    this.logger.info(`Token paymaster oracle address updated to: ${address}`);
  }
}
