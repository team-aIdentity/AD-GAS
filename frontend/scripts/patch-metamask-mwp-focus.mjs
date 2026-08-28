import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const FOREGROUND_PATCH_MARKER = 'AD_GAS_CAPACITOR_FOREGROUND_RECONNECT';
const RESPONSE_PATCH_MARKER = 'AD_GAS_MWP_RECONNECT_RESPONSE_RECOVERY';
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

const multichainRuntimeFiles = [
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
        // ${FOREGROUND_PATCH_MARKER}: BaseClient.state may remain CONNECTED while Android
        // suspends the relay socket. BaseClient.reconnect() is idempotent while
        // CONNECTING and is the SDK's documented foreground refresh path.
        void this.dappClient.reconnect().catch(() => {});
      }`;

let foregroundPatchedCount = 0;
let foregroundExistingCount = 0;

for (const relativeFile of multichainRuntimeFiles) {
  const absoluteFile = path.join(multichainPackageRoot, relativeFile);
  if (!fs.existsSync(absoluteFile)) continue;

  const source = fs.readFileSync(absoluteFile, 'utf8');
  if (source.includes(FOREGROUND_PATCH_MARKER)) {
    foregroundExistingCount += 1;
    continue;
  }
  if (!guardedForegroundReconnect.test(source)) continue;

  fs.writeFileSync(
    absoluteFile,
    source.replace(guardedForegroundReconnect, replacement),
    'utf8'
  );
  foregroundPatchedCount += 1;
}

if (foregroundPatchedCount === 0 && foregroundExistingCount === 0) {
  throw new Error(
    `Unsupported @metamask/connect-multichain ${packageJson.version}: foreground reconnect guard not found`
  );
}

// BaseClient.reconnect() marks the client CONNECTING until the relay refresh is
// complete. A recoverable subscription can replay the wallet response before
// that state flips back to CONNECTED. DappClient 0.3.0 drops ordinary messages
// received in that window, leaving the original eth_signTypedData Promise pending.
const multichainRequire = createRequire(
  path.join(multichainPackageRoot, 'package.json')
);
const dappClientEntryPath = multichainRequire.resolve(
  '@metamask/mobile-wallet-protocol-dapp-client'
);
const dappClientPackageRoot = path.dirname(path.dirname(dappClientEntryPath));
const responseRuntimeFiles = [
  path.join(dappClientPackageRoot, 'dist/index.mjs'),
  path.join(dappClientPackageRoot, 'dist/index.js'),
  path.join(
    multichainPackageRoot,
    'dist/browser/iife/connect-multichain.js'
  ),
];
const connectedOnlyMessage =
  /this\.state === ([\w$.]+)\.CONNECTED && message\.type === (["'])message\2/;

let responsePatchedCount = 0;
let responseExistingCount = 0;

for (const absoluteFile of responseRuntimeFiles) {
  if (!fs.existsSync(absoluteFile)) continue;

  const source = fs.readFileSync(absoluteFile, 'utf8');
  if (source.includes(RESPONSE_PATCH_MARKER)) {
    responseExistingCount += 1;
    continue;
  }

  const match = source.match(connectedOnlyMessage);
  if (!match) continue;
  const clientStateReference = match[1];
  const quote = match[2];
  const responseReplacement = `/* ${RESPONSE_PATCH_MARKER} */ (this.state === ${clientStateReference}.CONNECTED || (this.state === ${clientStateReference}.CONNECTING && this.session)) && message.type === ${quote}message${quote}`;

  fs.writeFileSync(
    absoluteFile,
    source.replace(connectedOnlyMessage, responseReplacement),
    'utf8'
  );
  responsePatchedCount += 1;
}

if (responsePatchedCount === 0 && responseExistingCount === 0) {
  throw new Error(
    'Unsupported @metamask/mobile-wallet-protocol-dapp-client: reconnect response guard not found'
  );
}

console.log(
  `MetaMask MWP foreground recovery ready (${packageJson.version}; ` +
    `focus patched=${foregroundPatchedCount}, existing=${foregroundExistingCount}; ` +
    `response patched=${responsePatchedCount}, existing=${responseExistingCount})`
);
