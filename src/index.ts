// Main SDK export
export { GaslessSDK } from './core/GaslessSDK';

// Core components
export { TransactionBuilder } from './core/TransactionBuilder';
export { AccountAbstraction } from './core/AccountAbstraction';
export { RelayerService } from './relayer/RelayerService';
export { PaymasterService } from './paymaster/PaymasterService';
export { TokenPaymaster } from './paymaster/TokenPaymaster';
export { PaymasterFactory } from './paymaster/PaymasterFactory';
export { PaymasterManager } from './paymaster/PaymasterManager';
export { NetworkManager } from './networks/NetworkManager';

// Utilities
export { Logger } from './utils/Logger';
export { SignatureValidator } from './utils/SignatureValidator';
export { SmartAccountFactory, type SmartAccountConfig } from './utils/SmartAccountFactory';

// React hooks (optional peer dependency)
export * from './react/hooks';

// Vue plugin (optional peer dependency)
export * from './vue';

// Types and interfaces
export * from './types';

// Default export
import { GaslessSDK } from './core/GaslessSDK';
export default GaslessSDK;
