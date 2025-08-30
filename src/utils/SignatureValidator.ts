import { ethers, TypedDataEncoder, verifyMessage, isAddress } from 'ethers';
import { GaslessTransaction, MetaTransaction } from '../types';

export class SignatureValidator {
  /**
   * Validate signature for a gasless transaction
   */
  public validateSignature(transaction: GaslessTransaction, signature: string): boolean {
    try {
      if (!signature || !transaction.signature) {
        return false;
      }

      // For now, basic validation - in production, implement proper signature recovery
      return signature.length === 132 && signature.startsWith('0x');
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate EIP-712 signature for meta-transaction
   */
  public validateMetaTransactionSignature(
    metaTransaction: MetaTransaction,
    signature: string,
    expectedSigner: string
  ): boolean {
    try {
      const domain = {
        name: 'GaslessSDK',
        version: '1',
        chainId: 1, // Will be dynamic
        verifyingContract: ethers.ZeroAddress,
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

      const digest = TypedDataEncoder.hash(domain, types, value);
      const recoveredAddress = ethers.recoverAddress(digest, signature);

      return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
    } catch (error) {
      return false;
    }
  }

  /**
   * Recover address from signature
   */
  public recoverAddress(message: string, signature: string): string {
    try {
      return verifyMessage(message, signature);
    } catch (error) {
      throw new Error(`Failed to recover address: ${error}`);
    }
  }

  /**
   * Validate Ethereum address format
   */
  public isValidAddress(address: string): boolean {
    return isAddress(address);
  }

  /**
   * Validate signature format
   */
  public isValidSignature(signature: string): boolean {
    return /^0x[0-9a-fA-F]{130}$/.test(signature);
  }
}
