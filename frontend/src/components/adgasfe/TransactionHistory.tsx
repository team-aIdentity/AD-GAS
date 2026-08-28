'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useLocale } from '@/contexts/LocaleContext';
import { getRelayerApiBase } from '@/lib/relayerApiBase';

export type TransactionHistoryItem = {
  hash: string;
  from: string;
  to: string;
  amount: string;
  tokenSymbol: string;
  networkName: string;
  chainId: number;
  timestamp: number;
};

interface TransactionHistoryProps {
  address: string;
  chainId: number;
  networkName: string;
  recentTransaction?: TransactionHistoryItem | null;
}

function explorerTxUrl(chainId: number, hash: string): string | null {
  if (chainId === 43114) return `https://snowtrace.io/tx/${hash}`;
  if (chainId === 8453) return `https://basescan.org/tx/${hash}`;
  if (chainId === 56) return `https://bscscan.com/tx/${hash}`;
  if (chainId === 91342) return `https://sepolia-explorer.giwa.io/tx/${hash}`;
  return null;
}

function explorerAddressUrl(chainId: number, address: string): string | null {
  if (chainId === 43114) return `https://snowtrace.io/address/${address}`;
  if (chainId === 8453) return `https://basescan.org/address/${address}`;
  if (chainId === 56) return `https://bscscan.com/address/${address}`;
  if (chainId === 91342) return `https://sepolia-explorer.giwa.io/address/${address}`;
  return null;
}

function shorten(value: string, leading = 8, trailing = 6): string {
  if (value.length <= leading + trailing + 3) return value;
  return `${value.slice(0, leading)}...${value.slice(-trailing)}`;
}

function isHistoryItem(value: unknown): value is TransactionHistoryItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<TransactionHistoryItem>;
  return (
    typeof item.hash === 'string' &&
    /^0x[0-9a-fA-F]{64}$/.test(item.hash) &&
    typeof item.from === 'string' &&
    typeof item.to === 'string' &&
    typeof item.amount === 'string' &&
    typeof item.tokenSymbol === 'string' &&
    typeof item.networkName === 'string' &&
    typeof item.chainId === 'number' &&
    typeof item.timestamp === 'number'
  );
}

function mergeHistoryItems(
  explorerItems: TransactionHistoryItem[],
  recentTransaction?: TransactionHistoryItem | null
): TransactionHistoryItem[] {
  const items = recentTransaction
    ? [recentTransaction, ...explorerItems]
    : explorerItems;
  return Array.from(
    new Map(items.map(item => [`${item.chainId}:${item.hash.toLowerCase()}`, item])).values()
  )
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 50);
}

export function TransactionHistory({
  address,
  chainId,
  networkName,
  recentTransaction,
}: TransactionHistoryProps) {
  const { locale, t } = useLocale();
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>(
    recentTransaction ? [recentTransaction] : []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setTransactions(recentTransaction ? [recentTransaction] : []);
    try {
      const query = new URLSearchParams({ address, chainId: String(chainId) });
      const response = await fetch(`${getRelayerApiBase()}/history?${query.toString()}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`History request failed (${response.status})`);
      const body = (await response.json()) as { items?: unknown };
      const explorerItems = Array.isArray(body.items)
        ? body.items.filter(isHistoryItem)
        : [];
      setTransactions(mergeHistoryItems(explorerItems, recentTransaction));
    } catch (historyError) {
      console.error('[TransactionHistory] Explorer lookup failed', historyError);
      if (recentTransaction) {
        setTransactions([recentTransaction]);
      } else {
        setTransactions([]);
        setError(t('transactionHistoryLoadError'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId, recentTransaction, t]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const addressExplorerUrl = explorerAddressUrl(chainId, address);

  return (
    <section className="rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-5 sm:p-7">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[20px] font-extrabold leading-6 text-white">
              {t('transactionHistory')}
            </h2>
            <p className="mt-1.5 text-[13px] font-medium leading-5 text-[#94a3b8] sm:text-[14px]">
              {t('transactionHistoryDesc', { network: networkName })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadHistory()}
            disabled={isLoading}
            aria-label={t('transactionHistoryRefresh')}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-[rgba(99,102,241,0.38)] bg-[rgba(99,102,241,0.19)] px-3 text-xs font-bold text-[#c7d2fe] disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {t('transactionHistoryRefresh')}
          </button>
        </div>

        <p className="rounded-xl bg-[rgba(15,23,42,0.55)] px-3 py-2 text-[11px] leading-4 text-[#64748b]">
          {t('transactionHistoryExplorerNotice')}
        </p>

        {isLoading && transactions.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#94a3b8]">
            <Loader2 className="size-5 animate-spin" />
            {t('transactionHistoryLoading')}
          </div>
        ) : error ? (
          <div className="space-y-3 py-8 text-center">
            <p className="text-sm text-red-200">{error}</p>
            {addressExplorerUrl && (
              <a
                href={addressExplorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(96,165,250,0.28)] bg-[rgba(59,130,246,0.1)] px-3 text-xs font-bold text-[#93c5fd]"
              >
                {t('transactionHistoryOpenExplorer')}
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#94a3b8]">
            {t('noTransactionsYet')}
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx, index) => {
              const explorerUrl = explorerTxUrl(tx.chainId, tx.hash);
              const date = new Date(tx.timestamp);
              return (
                <article
                  key={`${tx.chainId}:${tx.hash}:${tx.to}:${index}`}
                  className="rounded-2xl border border-[rgba(148,163,184,0.22)] bg-[rgba(15,23,42,0.8)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#10b981]" />
                      <div className="min-w-0">
                        <p className="font-bold text-white">
                          {tx.amount} {tx.tokenSymbol}
                        </p>
                        <p className="mt-1 text-xs text-[#94a3b8]">
                          {tx.networkName} ·{' '}
                          {date.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-[rgba(16,185,129,0.12)] px-2.5 py-1 text-[11px] font-bold text-[#34d399]">
                      {t('transactionHistorySuccess')}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 rounded-xl bg-[rgba(255,255,255,0.025)] p-3 text-xs sm:grid-cols-2">
                    <div className="min-w-0">
                      <span className="text-[#64748b]">{t('transactionHistoryRecipient')}</span>
                      <p className="mt-1 font-mono text-[#cbd5e1]" title={tx.to}>
                        {shorten(tx.to)}
                      </p>
                    </div>
                    <div className="min-w-0 sm:text-right">
                      <span className="text-[#64748b]">{t('completeModal.txHash')}</span>
                      <p className="mt-1 font-mono text-[#cbd5e1]" title={tx.hash}>
                        {shorten(tx.hash)}
                      </p>
                    </div>
                  </div>

                  {explorerUrl && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[rgba(96,165,250,0.28)] bg-[rgba(59,130,246,0.1)] px-3 text-xs font-bold text-[#93c5fd] transition-colors hover:bg-[rgba(59,130,246,0.16)] sm:w-auto"
                    >
                      {t('completeModal.viewExplorer')}
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
