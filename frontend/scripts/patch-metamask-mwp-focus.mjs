import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const PATCH_MARKER = 'AD_GAS_CAPACITOR_FOREGROUND_RECONNECT';
const evmPackagePath = require.resolve('@metamask/connect-evm/package.json');
const evmPackageRoot = path.dirname(evmPackagePath);
const multichainPackageRoot = path.join(
  evmPackageRoot,
  'node_modules',
  '@metamask',
  'connect-multichain'
);

if (!fs.existsSync(multichainPackageRoot)) {
  throw new Error(`MetaMask Connect multichain package not found: ${multichainPackageRoot}`);
}

const packageJson = JSON.parse(
  fs.readFileSync(path.join(multichainPackageRoot, 'package.json'), 'utf8')
);

const runtimeFiles = [
  'dist/browser/es/connect-multichain.mjs',
  'dist/browser/umd/connect-multichain.js',
  'dist/browser/iife/connect-multichain.js',
  'dist/node/es/connect-multichain.mjs',
  'dist/node/cjs/connect-multichain.js',
  'dist/react-native/es/connect-multichain.mjs',
  'dist/src/multichain/transports/mwp/index.js',
];

const guardedForegroundReconnect = /onWindowFocus\(\) \{\s*if \(!this\.isConnected\(\)\) \{\s*this\.dappClient\.reconnect\(\);\s*\}\s*\}/;
const replacement = `onWindowFocus() {
        // ${PATCH_MARKER}: BaseClient.state may remain CONNECTED while Android
        // suspends the relay socket. BaseClient.reconnect() is idempotent while
        // CONNECTING and is the SDK's documented foreground refresh path.
        void this.dappClient.reconnect().catch(() => {});
      }`;

let patchedCount = 0;
let alreadyPatchedCount = 0;

for (const relativeFile of runtimeFiles) {
  const absoluteFile = path.join(multichainPackageRoot, relativeFile);
  if (!fs.existsSync(absoluteFile)) continue;

  const source = fs.readFileSync(absoluteFile, 'utf8');
  if (source.includes(PATCH_MARKER)) {
    alreadyPatchedCount += 1;
    continue;
  }
  if (!guardedForegroundReconnect.test(source)) continue;

  fs.writeFileSync(
    absoluteFile,
    source.replace(guardedForegroundReconnect, replacement),
    'utf8'
  );
  patchedCount += 1;
}

if (patchedCount === 0 && alreadyPatchedCount === 0) {
  throw new Error(
    `Unsupported @metamask/connect-multichain ${packageJson.version}: foreground reconnect guard not found`
  );
}

console.log(
  `MetaMask MWP foreground reconnect ready (${packageJson.version}; patched=${patchedCount}, existing=${alreadyPatchedCount})`
);
