import { NextRequest, NextResponse } from 'next/server';
import { formatUnits, isAddress } from 'viem';

type HistoryItem = {
  hash: string;
  from: string;
  to: string;
  amount: string;
  tokenSymbol: string;
  networkName: string;
  chainId: number;
  timestamp: number;
};

type BlockscoutTransfer = {
  transaction_hash?: unknown;
  from?: { hash?: unknown };
  to?: { hash?: unknown };
  timestamp?: unknown;
  token?: { symbol?: unknown; decimals?: unknown };
  total?: { value?: unknown; decimals?: unknown };
};

type RouteScanTransfer = {
  txHash?: unknown;
  from?: unknown;
  to?: unknown;
  timestamp?: unknown;
  createdAt?: unknown;
  amount?: unknown;
  tokenSymbol?: unknown;
  tokenDecimals?: unknown;
};

const NETWORK_NAMES: Record<number, string> = {
  8453: 'Base',
  43114: 'Avalanche',
  91342: 'GIWA Sepolia',
};

const BLOCKSCOUT_API_BASES: Partial<Record<number, string>> = {
  8453: 'https://base.blockscout.com/api/v2',
  91342: 'https://sepolia-explorer.giwa.io/api/v2',
};

export const dynamic = 'force-dynamic';

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseTimestamp(value: unknown): number | null {
  const raw = stringValue(value);
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatAmount(value: unknown, decimals: unknown): string | null {
  const rawValue = stringValue(value);
  if (!rawValue || !/^\d+$/.test(rawValue)) return null;
  const rawDecimals =
    typeof decimals === 'number'
      ? decimals
      : typeof decimals === 'string'
        ? Number(decimals)
        : 0;
  const safeDecimals =
    Number.isInteger(rawDecimals) && rawDecimals >= 0 && rawDecimals <= 255
      ? rawDecimals
      : 0;
  try {
    return formatUnits(BigInt(rawValue), safeDecimals);
  } catch {
    return null;
  }
}

function normalizeBlockscoutItem(
  item: BlockscoutTransfer,
  chainId: number
): HistoryItem | null {
  const hash = stringValue(item.transaction_hash);
  const from = stringValue(item.from?.hash);
  const to = stringValue(item.to?.hash);
  const timestamp = parseTimestamp(item.timestamp);
  const tokenSymbol = stringValue(item.token?.symbol) ?? 'ERC-20';
  const amount = formatAmount(
    item.total?.value,
    item.total?.decimals ?? item.token?.decimals
  );
  if (!hash || !from || !to || timestamp == null || amount == null) return null;
  return {
    hash,
    from,
    to,
    amount,
    tokenSymbol,
    networkName: NETWORK_NAMES[chainId],
    chainId,
    timestamp,
  };
}

function normalizeRouteScanItem(
  item: RouteScanTransfer,
  chainId: number
): HistoryItem | null {
  const hash = stringValue(item.txHash);
  const from = stringValue(item.from);
  const to = stringValue(item.to);
  const timestamp = parseTimestamp(item.timestamp ?? item.createdAt);
  const tokenSymbol = stringValue(item.tokenSymbol) ?? 'ERC-20';
  const amount = formatAmount(item.amount, item.tokenDecimals);
  if (!hash || !from || !to || timestamp == null || amount == null) return null;
  return {
    hash,
    from,
    to,
    amount,
    tokenSymbol,
    networkName: NETWORK_NAMES[chainId],
    chainId,
    timestamp,
  };
}

async function fetchBlockscoutHistory(
  address: string,
  chainId: number
): Promise<HistoryItem[]> {
  const apiBase = BLOCKSCOUT_API_BASES[chainId];
  if (!apiBase) return [];
  const url = new URL(`${apiBase}/addresses/${address}/token-transfers`);
  url.searchParams.set('type', 'ERC-20');
  url.searchParams.set('filter', 'from');
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Block explorer returned ${response.status}`);
  const body = (await response.json()) as { items?: unknown };
  if (!Array.isArray(body.items)) return [];
  return body.items
    .map(item => normalizeBlockscoutItem(item as BlockscoutTransfer, chainId))
    .filter((item): item is HistoryItem => item !== null);
}

async function fetchAvalancheHistory(address: string): Promise<HistoryItem[]> {
  const url = new URL(
    `https://api.routescan.io/v2/network/mainnet/evm/43114/address/${address}/erc20-transfers`
  );
  url.searchParams.set('limit', '50');
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Block explorer returned ${response.status}`);
  const body = (await response.json()) as { items?: unknown };
  if (!Array.isArray(body.items)) return [];
  const normalizedAddress = address.toLowerCase();
  return body.items
    .map(item => normalizeRouteScanItem(item as RouteScanTransfer, 43114))
    .filter((item): item is HistoryItem => item !== null)
    .filter(item => item.from.toLowerCase() === normalizedAddress);
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')?.trim() ?? '';
  const chainId = Number(request.nextUrl.searchParams.get('chainId'));

  if (!isAddress(address)) {
    return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
  }
  if (!(chainId in NETWORK_NAMES)) {
    return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 });
  }

  try {
    const items =
      chainId === 43114
        ? await fetchAvalancheHistory(address)
        : await fetchBlockscoutHistory(address, chainId);
    const uniqueItems = Array.from(
      new Map(items.map(item => [`${item.chainId}:${item.hash}:${item.to}:${item.amount}`, item])).values()
    )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50);

    return NextResponse.json(
      { source: 'explorer', items: uniqueItems },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[history] Explorer lookup failed', {
      chainId,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Unable to load transaction history from the explorer' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
