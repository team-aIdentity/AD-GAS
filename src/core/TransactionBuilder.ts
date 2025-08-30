import { ethers, JsonRpcProvider } from 'ethers';
import { BigNumber } from '../types';
import {
  GaslessTransaction,
  MetaTransaction,
  WalletInterface,
  GaslessSDKError,
  ErrorCodes,
} from '../types';
import { NetworkManager } from '../networks/NetworkManager';

export class TransactionBuilder {
  private networkManager: NetworkManager;

  constructor(networkManager: NetworkManager) {
    this.networkManager = networkManager;
  }

  /**
   * Build a complete gasless transaction from partial data
   */
  public async buildTransaction(
    transaction: Partial<GaslessTransaction>,
    wallet: WalletInterface
  ): Promise<GaslessTransaction> {
    const network = this.networkManager.getCurrentNetwork();
    const provider = new JsonRpcProvider(network.rpcUrl);

    // Validate network connectivity
    await provider.getNetwork();

    const completeTransaction: GaslessTransaction = {
      to: transaction.to || '',
      data: transaction.data || '0x',
      value: transaction.value || 0,
      gasLimit: transaction.gasLimit || await this.estimateGas(transaction, wallet),
      deadline: transaction.deadline || Math.floor(Date.now() / 1000) + 3600, // 1 hour
      nonce: transaction.nonce || await this.getNonce(wallet),
    };

    if (!completeTransaction.to) {
      throw new GaslessSDKError('Transaction target address is required', ErrorCodes.INVALID_SIGNATURE);
    }

    return completeTransaction;
  }

  /**
   * Build a complete meta-transaction
   */
  public async buildMetaTransaction(
    transaction: Partial<MetaTransaction>,
    wallet: WalletInterface
  ): Promise<MetaTransaction> {
    const userAddress = await wallet.getAddress();

    const metaTransaction: MetaTransaction = {
      from: transaction.from || userAddress,
      to: transaction.to || '',
      value: transaction.value || 0,
      data: transaction.data || '0x',
      operation: transaction.operation || 0, // 0 = Call, 1 = DelegateCall
      gasToken: transaction.gasToken || ethers.ZeroAddress,
      gasPrice: transaction.gasPrice || await this.getGasPrice(),
      gasLimit: transaction.gasLimit || await this.estimateGas(transaction, wallet),
      deadline: transaction.deadline || Math.floor(Date.now() / 1000) + 3600,
      nonce: transaction.nonce || await this.getNonce(wallet),
    };

    if (!metaTransaction.to) {
      throw new GaslessSDKError('Transaction target address is required', ErrorCodes.INVALID_SIGNATURE);
    }

    return metaTransaction;
  }

  /**
   * Estimate gas for a transaction
   */
  public async estimateGas(
    transaction: Partial<GaslessTransaction | MetaTransaction>,
    wallet: WalletInterface
  ): Promise<BigNumber> {
    try {
      const network = this.networkManager.getCurrentNetwork();
      const provider = new JsonRpcProvider(network.rpcUrl);

      const estimateParams = {
        to: transaction.to,
        data: transaction.data || '0x',
        value: transaction.value || 0,
        from: await wallet.getAddress(),
      };

      const estimate = await provider.estimateGas(estimateParams);
      
      // Add 20% buffer for safety
      return (estimate * BigInt(120)) / BigInt(100);
    } catch (error) {
      throw new GaslessSDKError(
        'Failed to estimate gas',
        ErrorCodes.NETWORK_ERROR,
        error
      );
    }
  }

  /**
   * Get current gas price
   */
  public async getGasPrice(): Promise<BigNumber> {
    try {
      const network = this.networkManager.getCurrentNetwork();
      const provider = new JsonRpcProvider(network.rpcUrl);
      const feeData = await provider.getFeeData();
      return feeData.gasPrice || 0;
    } catch (error) {
      throw new GaslessSDKError(
        'Failed to get gas price',
        ErrorCodes.NETWORK_ERROR,
        error
      );
    }
  }

  /**
   * Get nonce for the wallet
   */
  public async getNonce(wallet: WalletInterface): Promise<BigNumber> {
    try {
      const network = this.networkManager.getCurrentNetwork();
      const provider = new JsonRpcProvider(network.rpcUrl);
      const address = await wallet.getAddress();
      const nonce = await provider.getTransactionCount(address, 'pending');
      return nonce;
    } catch (error) {
      throw new GaslessSDKError(
        'Failed to get nonce',
        ErrorCodes.NETWORK_ERROR,
        error
      );
    }
  }

  /**
   * Get transaction message for signing
   */
  public getTransactionMessage(transaction: GaslessTransaction): string {
    const message = [
      `To: ${transaction.to}`,
      `Data: ${transaction.data}`,
      `Value: ${transaction.value?.toString() || '0'}`,
      `Gas Limit: ${transaction.gasLimit?.toString() || '0'}`,
      `Deadline: ${transaction.deadline || 0}`,
      `Nonce: ${transaction.nonce?.toString() || '0'}`,
    ].join('\n');

    return message;
  }

  /**
   * Get EIP-712 typed data for meta-transaction signing
   */
  public getEIP712Data(metaTransaction: MetaTransaction): {
    domain: any;
    types: any;
    value: any;
  } {
    const network = this.networkManager.getCurrentNetwork();
    
    const domain = {
      name: 'GaslessSDK',
      version: '1',
      chainId: network.chainId,
      verifyingContract: network.forwarderAddress || ethers.ZeroAddress,
    };

    const types = {
      MetaTransaction: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'data', type: 'bytes' },
        { name: 'operation', type: 'uint8' },
        { name: 'gasToken', type: 'address' },
        { name: 'gasPrice', type: 'uint256' },
        { name: 'gasLimit', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ],
    };

    const value = {
      from: metaTransaction.from,
      to: metaTransaction.to,
      value: metaTransaction.value.toString(),
      data: metaTransaction.data,
      operation: metaTransaction.operation,
      gasToken: metaTransaction.gasToken,
      gasPrice: metaTransaction.gasPrice.toString(),
      gasLimit: metaTransaction.gasLimit.toString(),
      deadline: metaTransaction.deadline,
      nonce: metaTransaction.nonce.toString(),
    };

    return { domain, types, value };
  }
}
