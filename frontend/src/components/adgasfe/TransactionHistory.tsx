'use client';

import { CheckCircle2, ExternalLink } from 'lucide-react';
import { useLocale } from '@/contexts/LocaleContext';

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
  transactions: TransactionHistoryItem[];
}

function explorerTxUrl(chainId: number, hash: string): string | null {
  if (chainId === 43114) return `https://snowtrace.io/tx/${hash}`;
  if (chainId === 8453) return `https://basescan.org/tx/${hash}`;
  if (chainId === 56) return `https://bscscan.com/tx/${hash}`;
  if (chainId === 91342) return `https://sepolia-explorer.giwa.io/tx/${hash}`;
  return null;
}

function shorten(value: string, leading = 8, trailing = 6): string {
  if (value.length <= leading + trailing + 3) return value;
  return `${value.slice(0, leading)}...${value.slice(-trailing)}`;
}

export function TransactionHistory({ transactions }: TransactionHistoryProps) {
  const { locale, t } = useLocale();

  return (
    <section className="rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-5 sm:p-7">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[20px] font-extrabold leading-6 text-white">
              {t('transactionHistory')}
            </h2>
            <p className="mt-1.5 text-[13px] font-medium leading-5 text-[#94a3b8] sm:text-[14px]">
              {t('transactionHistoryDesc')}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-[rgba(99,102,241,0.38)] bg-[rgba(99,102,241,0.19)] px-3 py-1 text-xs font-bold text-[#c7d2fe]">
            {transactions.length}
          </span>
        </div>

        <p className="rounded-xl bg-[rgba(15,23,42,0.55)] px-3 py-2 text-[11px] leading-4 text-[#64748b]">
          {t('transactionHistoryLocalNotice')}
        </p>

        {transactions.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#94a3b8]">
            {t('noTransactionsYet')}
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map(tx => {
              const explorerUrl = explorerTxUrl(tx.chainId, tx.hash);
              const date = new Date(tx.timestamp);
              return (
                <article
                  key={`${tx.chainId}:${tx.hash}`}
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
