import { JsonRpcProvider, Contract } from 'ethers';
import {
  PaymasterStakeInfo,
  PaymasterPolicy,
  UserOperation,
  PaymasterValidationResult,
  GaslessSDKError,
  ErrorCodes,
  BigNumber,
} from '../types';
import { PaymasterService } from './PaymasterService';
import { TokenPaymaster } from './TokenPaymaster';
import { PaymasterFactory } from './PaymasterFactory';
import { Logger } from '../utils/Logger';

/**
 * Comprehensive paymaster management system
 * Handles multiple paymasters and policies
 */
export class PaymasterManager {
  private provider: JsonRpcProvider;
  private entryPointAddress: string;
  private logger: Logger;
  private paymasters: Map<string, PaymasterService>;
  private policies: Map<string, PaymasterPolicy>;
  private factory: PaymasterFactory;

  constructor(
    provider: JsonRpcProvider,
    entryPointAddress: string,
    logger?: Logger
  ) {
    this.provider = provider;
    this.entryPointAddress = entryPointAddress;
    this.logger = logger || new Logger(false);
    this.paymasters = new Map();
    this.policies = new Map();
    this.factory = new PaymasterFactory(provider, entryPointAddress, logger);
  }

  /**
   * Register a paymaster with the manager
   */
  public registerPaymaster(
    id: string,
    paymaster: PaymasterService,
    policy?: PaymasterPolicy
  ): void {
    this.paymasters.set(id, paymaster);
    if (policy) {
      this.policies.set(id, policy);
    }
    this.logger.info(`Paymaster registered: ${id}`);
  }

  /**
   * Find the best paymaster for a user operation
   */
  public async findBestPaymaster(
    userOp: UserOperation,
    chainId: number
  ): Promise<{ paymaster: PaymasterService; id: string } | null> {
    try {
      this.logger.info('Finding best paymaster for user operation');

      for (const [id, paymaster] of this.paymasters) {
        try {
          // Check if paymaster can sponsor this operation
          const canSponsor = await paymaster.canSponsor(
            userOp.sender,
            userOp.callData,
            chainId
          );

          if (canSponsor.canSponsor) {
            // Check policy compliance
            const policy = this.policies.get(id);
            if (policy && !(await this.checkPolicyCompliance(userOp, policy))) {
              continue;
            }

            this.logger.info(`Selected paymaster: ${id}`);
            return { paymaster, id };
          }
        } catch (error) {
          this.logger.warn(`Paymaster ${id} failed sponsorship check:`, error);
          continue;
        }
      }

      this.logger.warn('No suitable paymaster found');
      return null;
    } catch (error) {
      this.logger.error('Failed to find best paymaster:', error);
      return null;
    }
  }

  /**
   * Check if user operation complies with paymaster policy
   */
  private async checkPolicyCompliance(
    userOp: UserOperation,
    policy: PaymasterPolicy
  ): Promise<boolean> {
    try {
      // Check gas price limits
      if (BigInt(userOp.maxFeePerGas) > policy.sponsorshipLimit) {
        return false;
      }

      // Check allowed/blocked targets
      if (policy.allowedTargets && policy.allowedTargets.length > 0) {
        // Extract target from calldata (assume first 20 bytes after function selector)
        const target = userOp.callData.slice(0, 42); // 0x + 40 chars
        if (!policy.allowedTargets.includes(target)) {
          return false;
        }
      }

      if (policy.blockedTargets && policy.blockedTargets.length > 0) {
        const target = userOp.callData.slice(0, 42);
        if (policy.blockedTargets.includes(target)) {
          return false;
        }
      }

      // Check rate limiting (would need to implement storage for this)
      // This is a simplified check
      return true;
    } catch (error) {
      this.logger.error('Failed to check policy compliance:', error);
      return false;
    }
  }

  /**
   * Get all registered paymasters
   */
  public getRegisteredPaymasters(): Array<{ id: string; paymaster: PaymasterService }> {
    return Array.from(this.paymasters.entries()).map(([id, paymaster]) => ({
      id,
      paymaster,
    }));
  }

  /**
   * Remove a paymaster from the manager
   */
  public unregisterPaymaster(id: string): boolean {
    const removed = this.paymasters.delete(id);
    this.policies.delete(id);
    
    if (removed) {
      this.logger.info(`Paymaster unregistered: ${id}`);
    }
    
    return removed;
  }

  /**
   * Update paymaster policy
   */
  public updatePaymasterPolicy(id: string, policy: PaymasterPolicy): void {
    if (!this.paymasters.has(id)) {
      throw new GaslessSDKError(
        `Paymaster ${id} not found`,
        ErrorCodes.PAYMASTER_ERROR
      );
    }

    this.policies.set(id, policy);
    this.logger.info(`Policy updated for paymaster: ${id}`);
  }

  /**
   * Get paymaster policy
   */
  public getPaymasterPolicy(id: string): PaymasterPolicy | undefined {
    return this.policies.get(id);
  }

  /**
   * Get paymaster factory
   */
  public getFactory(): PaymasterFactory {
    return this.factory;
  }

  /**
   * Get comprehensive paymaster status
   */
  public async getPaymasterStatus(id: string): Promise<{
    status: any;
    stakeInfo: PaymasterStakeInfo;
    policy?: PaymasterPolicy;
  }> {
    try {
      const paymaster = this.paymasters.get(id);
      if (!paymaster) {
        throw new GaslessSDKError(
          `Paymaster ${id} not found`,
          ErrorCodes.PAYMASTER_ERROR
        );
      }

      const [status, stakeInfo] = await Promise.all([
        paymaster.getStatus(),
        paymaster.getStakeInfo(),
      ]);

      return {
        status,
        stakeInfo,
        policy: this.policies.get(id),
      };
    } catch (error) {
      this.logger.error(`Failed to get paymaster status for ${id}:`, error);
      throw new GaslessSDKError(
        'Failed to get paymaster status',
        ErrorCodes.PAYMASTER_ERROR,
        error
      );
    }
  }

  /**
   * Validate user operation with best available paymaster
   */
  public async validateWithBestPaymaster(
    userOp: UserOperation,
    chainId: number,
    maxCost: BigNumber
  ): Promise<{ 
    validation: PaymasterValidationResult; 
    paymasterId: string;
    enhancedUserOp: UserOperation;
  } | null> {
    try {
      const bestPaymaster = await this.findBestPaymaster(userOp, chainId);
      
      if (!bestPaymaster) {
        return null;
      }

      // Get sponsorship data
      const sponsorship = await bestPaymaster.paymaster.requestSponsorship({
        userOp,
        entryPoint: this.entryPointAddress,
        chainId,
      });

      // Update user operation with paymaster data
      const enhancedUserOp: UserOperation = {
        ...userOp,
        paymasterAndData: sponsorship.paymasterAndData,
        callGasLimit: sponsorship.callGasLimit,
        verificationGasLimit: sponsorship.verificationGasLimit,
        preVerificationGas: sponsorship.preVerificationGas,
      };

      // Validate with paymaster
      const validation = await bestPaymaster.paymaster.validatePaymasterUserOp(
        enhancedUserOp,
        maxCost
      );

      return {
        validation,
        paymasterId: bestPaymaster.id,
        enhancedUserOp,
      };
    } catch (error) {
      this.logger.error('Failed to validate with best paymaster:', error);
      return null;
    }
  }
}
