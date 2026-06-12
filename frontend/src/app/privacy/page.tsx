import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Privacy Policy | AD GAS',
  description: 'Privacy Policy for the AD GAS mobile and web application.',
};

const lastUpdated = 'June 12, 2026';

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#0f172a] px-5 py-10 text-[#e2e8f0] sm:px-8">
      <article className="mx-auto max-w-3xl rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)] sm:p-10">
        <a href="/" className="text-sm font-semibold text-[#93c5fd] hover:underline">
          ← Back to AD GAS
        </a>

        <header className="mt-8 space-y-3">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#818cf8]">
            AD GAS
          </p>
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="text-sm text-[#94a3b8]">Last updated: {lastUpdated}</p>
        </header>

        <section className="mt-8 space-y-4">
          <p>
            This Privacy Policy explains how AD GAS (“we”, “us”, or “our”) handles
            information when you use the AD GAS web and mobile application. AD GAS
            lets users watch ads and request gas-sponsored blockchain transfers.
          </p>
          <p>
            We do not ask you to create an account, and we do not collect passwords,
            private keys, seed phrases, or wallet recovery information. You should
            never share your private key or recovery phrase with AD GAS or anyone else.
          </p>
        </section>

        <PolicySection title="Information We Process">
          <ul>
            <li>
              <strong>Wallet information:</strong> wallet address, connected network,
              selected token, recipient address, transfer amount, signatures, nonce,
              and transaction hash needed to prepare and relay blockchain transactions.
            </li>
            <li>
              <strong>Advertising information:</strong> rewarded ad completion status
              and ad SDK events used to determine whether a sponsored transaction can
              proceed.
            </li>
            <li>
              <strong>Device and technical information:</strong> app environment,
              network status, logs, and diagnostic information used to keep the service
              secure and reliable.
            </li>
            <li>
              <strong>Local usage information:</strong> daily free transaction count
              may be stored locally on your device or browser to enforce usage limits.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="How We Use Information">
          <ul>
            <li>To connect your wallet and show supported tokens and balances.</li>
            <li>To prepare Permit and transfer signatures requested by you.</li>
            <li>To relay sponsored transactions and display transaction status.</li>
            <li>To prevent abuse, enforce free transaction limits, and debug errors.</li>
            <li>To show rewarded advertisements that support gas sponsorship.</li>
          </ul>
        </PolicySection>

        <PolicySection title="Third-Party Services">
          <p>
            AD GAS may use third-party services including wallet providers, blockchain
            RPC providers, WalletConnect, MetaMask, Google AdMob / Google advertising
            services, analytics or hosting providers, and blockchain explorers. These
            services may process information under their own privacy policies.
          </p>
        </PolicySection>

        <PolicySection title="Blockchain Data">
          <p>
            Blockchain transactions are public by design. Wallet addresses, token
            transfers, transaction hashes, and related on-chain data may be permanently
            visible on public blockchains and blockchain explorers. We cannot delete or
            modify public blockchain records.
          </p>
        </PolicySection>

        <PolicySection title="Data Sharing">
          <p>
            We do not sell personal information. We may share information only when
            needed to provide the service, comply with law, protect users and the
            service, or work with third-party service providers described above.
          </p>
        </PolicySection>

        <PolicySection title="Data Retention">
          <p>
            We keep service logs and transaction-related records only as long as needed
            for operation, security, abuse prevention, legal compliance, and debugging.
            Local app or browser data can be cleared by deleting app data or browser
            storage. Public blockchain data may remain available indefinitely.
          </p>
        </PolicySection>

        <PolicySection title="Children’s Privacy">
          <p>
            AD GAS is not intended for children under the age required by applicable
            law. We do not knowingly collect personal information from children.
          </p>
        </PolicySection>

        <PolicySection title="Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. The latest version
            will always be available at this URL.
          </p>
        </PolicySection>

        <PolicySection title="Contact">
          <p>
            If you have questions about this Privacy Policy, contact us through the
            official AD GAS project repository or support channel.
          </p>
        </PolicySection>
      </article>
    </main>
  );
}

function PolicySection({
  title,
  children,
}: Readonly<{
  title: string;
  children: ReactNode;
}>) {
  return (
    <section className="mt-8 space-y-3">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-[#cbd5e1] [&_li]:mb-2 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
