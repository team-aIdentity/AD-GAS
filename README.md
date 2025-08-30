# Gasless SDK

A comprehensive TypeScript SDK for gasless transactions using Biconomy's Account Abstraction (EIP-4337). This SDK allows users to execute blockchain transactions without paying for gas fees directly, with the cost sponsored by a dApp.

## 🚀 Features

- **Gas Sponsorship**: Send transactions where the dApp sponsors the gas fees.
- **Account Abstraction**: Utilizes EIP-4337 to provide smart contract wallets for users.
- **Powered by Biconomy**: Built on top of Biconomy's robust AbstractJS and MEE Client for reliable transaction execution.
- **Multi-Chain Support**: Works with major EVM chains like Polygon, Ethereum, Base, and more.
- **Flexible Gas Payment**: Pay gas with native tokens or ERC-20 tokens, in addition to sponsorship.
- **Developer Friendly**: Simple, asynchronous API designed for ease of integration, especially with `viem` and `wagmi`.

## 📦 Installation

```bash
npm install gasless-sdk @biconomy/abstractjs viem
```

## 🔧 Quick Start

This guide shows how to integrate the Gasless SDK into a React application using `wagmi`.

### 1. Prerequisites

Your application must be set up with `wagmi` to provide a `publicClient` and `walletClient`.

### 2. Initialization

Initialize the SDK within your React component once the wallet is connected.

```typescript
import { useState, useEffect } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { GaslessSDK } from 'gasless-sdk';
import { parseEther } from 'viem';

function MyDApp() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [sdk, setSdk] = useState<GaslessSDK | null>(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string>('');

  useEffect(() => {
    const initSDK = async () => {
      if (publicClient && walletClient) {
        try {
          const gaslessSDK = await GaslessSDK.initialize({
            publicClient,
            walletClient,
            apiKey: 'YOUR_BICONOMY_API_KEY', // Get from Biconomy Dashboard
          });
          setSdk(gaslessSDK);
          const address = gaslessSDK.getSmartAccountAddress();
          setSmartAccountAddress(address || '');
        } catch (error) {
          console.error("SDK Initialization failed:", error);
        }
      }
    };

    initSDK();
  }, [publicClient, walletClient]);

  const handleTransaction = async () => {
    if (!sdk) {
      alert("SDK not initialized!");
      return;
    }
    try {
      // This will trigger an ad view before proceeding
      const txHash = await sdk.sendGaslessTransaction({
        to: '0xRecipientAddress', // Replace with the recipient's address
        value: parseEther('0.0001'),
      });
      console.log('Transaction Hash:', txHash);
      alert(`Transaction successful! Hash: ${txHash}`);
    } catch (error) {
      console.error('Transaction failed:', error);
      alert(`Transaction failed: ${error.message}`);
    }
  };

  return (
    <div>
      <h2>Gasless SDK Demo</h2>
      <p>Smart Account: {smartAccountAddress}</p>
      <button onClick={handleTransaction} disabled={!sdk}>
        Send Sponsored Transaction
      </button>
    </div>
  );
}
```

## 🏗️ Architecture

The SDK is a wrapper around **Biconomy's AbstractJS SDK**, specifically utilizing the **MEE (Managed Execution Environment) Client**. It simplifies the process of creating a `MultichainNexusAccount` (a smart contract wallet) and submitting user operations to be executed through Biconomy's infrastructure. The core logic handles account creation, quote generation for gas fees, and transaction execution.

## 🌐 Supported Networks

The SDK supports any chain compatible with Biconomy MEE. As of the latest version, this includes:
- **Mainnets**: Ethereum, Polygon, Base, Optimism, Arbitrum.
- **Testnets**: Sepolia, Base Sepolia, OP Sepolia, Arbitrum Sepolia, Polygon Amoy.

## 📚 API Reference

### `GaslessSDK`

#### `static async initialize(config: SdkConfig): Promise<GaslessSDK>`
Initializes the SDK asynchronously. This is the entry point for using the SDK.
- `config`: An object containing `publicClient`, `walletClient`, and an optional `apiKey`.

#### `async sendGaslessTransaction(tx: TransactionRequest): Promise<string>`
Sends a transaction where the gas fees are sponsored by the dApp. This requires your Biconomy Paymaster to be configured for sponsorship. Before sending the transaction, it will wait for a function `showMyGoogleAd()` to resolve.
- `tx`: A transaction object with `to`, `value`, and optional `data`.
- **Returns**: The transaction hash as a string.

#### `async sendTransactionWithNativeGas(tx: TransactionRequest): Promise<string>`
Sends a transaction where the gas fees are paid using the native token (e.g., MATIC on Polygon) from the user's smart account.
- **Returns**: The transaction hash.

#### `async sendTransactionWithTokenGas(tx: TransactionRequest, gasToken: { address: string, chainId: number }): Promise<string>`
Sends a transaction where gas fees are paid using a specified ERC-20 token.
- `gasToken`: An object specifying the ERC-20 token address and its chain ID.
- **Returns**: The transaction hash.

#### `getSmartAccountAddress(chainId?: number): string | undefined`
Retrieves the address of the user's smart contract wallet for the specified or current chain.
- **Returns**: The smart account address as a string, or `undefined` if not available.

#### `static isChainSupported(chainId: number): boolean`
A static method to check if a given `chainId` is supported by the SDK.
- **Returns**: `true` if supported, `false` otherwise.

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

## 📄 License

MIT License - see LICENSE file for details.
