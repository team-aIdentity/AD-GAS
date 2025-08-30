// Vue plugin will be available when Vue is installed as a peer dependency
// This is a placeholder to avoid compilation errors when Vue is not available

import { GaslessSDK } from '../core/GaslessSDK';
import { GaslessSDKConfig } from '../types';

// Vue plugin interface (works when Vue is available)
export interface GaslessSDKVuePlugin {
  install(app: any, options: GaslessSDKConfig): void;
}

// Create the plugin (works when Vue is available)
export const GaslessSDKVuePlugin: GaslessSDKVuePlugin = {
  install(app: any, options: GaslessSDKConfig) {
    // Create SDK instance
    const sdk = new GaslessSDK(options);

    // Provide SDK instance globally (Vue 3 style)
    if (app.provide && app.config) {
      app.provide('gaslessSDK', sdk);
      app.config.globalProperties.$gaslessSDK = sdk;
    }
  },
};

// Composable for using Gasless SDK in Vue 3 Composition API
export function useGaslessSDKVue() {
  try {
    // Dynamic import to avoid compilation errors when Vue is not available
    const { inject } = require('vue');
    const sdk = inject('gaslessSDK');
    
    if (!sdk) {
      throw new Error('GaslessSDK not found. Make sure to install the plugin.');
    }

    return sdk as GaslessSDK;
  } catch (error) {
    throw new Error('Vue is not available. Install Vue as a peer dependency to use this feature.');
  }
}

// Export for convenience
export default GaslessSDKVuePlugin;
