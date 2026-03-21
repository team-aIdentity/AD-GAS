"use client";

import { ConnectWallet } from "@coinbase/onchainkit/wallet";
import { useIsInMiniApp } from "@coinbase/onchainkit/minikit";
import { useAccount } from "wagmi";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { isInMiniApp, isPending: miniAppCheckPending } = useIsInMiniApp();

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium text-zinc-400">AD-GAS</p>
        <h1 className="text-2xl font-semibold tracking-tight">Base Mini App</h1>
        <p className="text-sm text-zinc-500">
          Farcaster / Base 미니앱 컨텍스트:{" "}
          <span className="font-mono text-zinc-300">
            {miniAppCheckPending ? "확인 중…" : isInMiniApp ? "예" : "아니오 (브라우저)"}
          </span>
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <ConnectWallet />
        {isConnected && address ? (
          <p className="mt-4 break-all text-xs text-zinc-400">
            연결됨: <span className="font-mono text-zinc-200">{address}</span>
          </p>
        ) : null}
      </section>

      <p className="text-xs text-zinc-600">
        배포 후 <code className="rounded bg-zinc-800 px-1">public/.well-known/farcaster.json</code>의{" "}
        <code className="rounded bg-zinc-800 px-1">homeUrl</code>, <code className="rounded bg-zinc-800 px-1">iconUrl</code>을
        실제 HTTPS URL로 바꾸세요.
      </p>
    </main>
  );
}
