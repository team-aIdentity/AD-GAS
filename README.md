# Gasless SDK

A comprehensive TypeScript SDK for gasless transactions and meta-transactions on EVM-compatible blockchains.

## 🚀 Features

- **Gasless Transactions**: Send transactions without holding ETH for gas fees
- **Meta-Transactions**: EIP-2771 compliant meta-transaction support
- **Multi-Chain Support**: Ethereum, Polygon, Arbitrum, BSC, and more
- **ERC-4337 Integration**: Account Abstraction and Paymaster support
- **Developer Friendly**: TypeScript-first with comprehensive type definitions
- **Flexible Architecture**: Modular design for easy customization

## 📦 Installation

```bash
npm install gasless-sdk
```

## 🔧 Quick Start

```typescript
import { GaslessSDK } from 'gasless-sdk';

// Initialize the SDK
const sdk = new GaslessSDK({
  networks: [
    {
      chainId: 137,
      name: 'Polygon Mainnet',
      rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/your-api-key',
      gasTokens: ['0x0000000000000000000000000000000000000000'],
    }
  ],
  defaultNetwork: 137,
  relayerEndpoint: 'https://relayer.example.com',
  paymasterEndpoint: 'https://paymaster.example.com',
  debug: true,
});

// Connect wallet
await sdk.connectWallet(wallet);

// Send a gasless transaction
const response = await sdk.sendGaslessTransaction({
  to: '0x...',
  data: '0x...',
  value: 0,
}, (event) => {
  console.log('Transaction event:', event);
});

console.log('Transaction hash:', response.transactionHash);
```

## 🏗️ Architecture

The SDK consists of several core components:

- **GaslessSDK**: Main SDK class and entry point
- **TransactionBuilder**: Builds and formats transactions
- **RelayerService**: Communicates with relayer infrastructure
- **PaymasterService**: Handles ERC-4337 paymaster integration
- **NetworkManager**: Manages multi-chain configurations
- **SignatureValidator**: Validates transaction signatures

## 🌐 Supported Networks

- Ethereum Mainnet (Chain ID: 1)
- Ethereum Goerli (Chain ID: 5)
- Polygon Mainnet (Chain ID: 137)
- Polygon Mumbai (Chain ID: 80001)
- Arbitrum One (Chain ID: 42161)
- BSC Mainnet (Chain ID: 56)

## 📚 API Reference

### GaslessSDK

#### Methods

- `connectWallet(wallet: WalletInterface): Promise<void>`
- `sendGaslessTransaction(transaction: Partial<GaslessTransaction>, onProgress?: TransactionCallback): Promise<RelayerResponse>`
- `sendMetaTransaction(transaction: Partial<MetaTransaction>, onProgress?: TransactionCallback): Promise<RelayerResponse>`
- `estimateGas(transaction: Partial<GaslessTransaction>): Promise<BigNumber>`
- `switchNetwork(chainId: number): Promise<void>`
- `getCurrentNetwork(): NetworkConfig`
- `getAvailableNetworks(): NetworkConfig[]`

### Transaction Types

#### GaslessTransaction
```typescript
interface GaslessTransaction {
  to: string;
  data: string;
  value?: BigNumber;
  gasLimit?: BigNumber;
  deadline?: number;
  nonce?: BigNumber;
  signature?: string;
}
```

#### MetaTransaction
```typescript
interface MetaTransaction {
  from: string;
  to: string;
  value: BigNumber;
  data: string;
  operation: number;
  gasToken: string;
  gasPrice: BigNumber;
  gasLimit: BigNumber;
  deadline: number;
  nonce: BigNumber;
}
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🆘 Support

- 📖 [Documentation](https://gasless-sdk.docs.com)
- 💬 [Discord Community](https://discord.gg/gasless-sdk)
- 🐛 [Issue Tracker](https://github.com/your-org/gasless-sdk/issues)

## 🔗 Related Projects

- [EIP-2771](https://eips.ethereum.org/EIPS/eip-2771) - Secure Protocol for Native Meta Transactions
- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) - Account Abstraction Using Alt Mempool