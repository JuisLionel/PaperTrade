import {
  CRYPTO_CATEGORIES,
  getCryptoCategory,
} from "@/lib/crypto-categories";
import { getMarketSector } from "@/lib/market-sectors";
import { fmt } from "@/lib/format";
import type { Asset, Quote } from "@/lib/client/markets";
import type { Position, Series } from "@/types/trading";

export const categories = [
  "Tech",
  "Comm",
  "Finance",
  "Health",
  "Energy",
  "Consumer",
  "Industrials",
  "Other",
  "Crypto",
] as const;

export type Category = (typeof categories)[number];
export type Filter = "All" | "Pinned" | "S&P 500" | Category;
export type Range = "1D" | "5D" | "1M";
export type IndexKey = "sp500" | "nasdaq" | "dow" | "russell";
export type MarketRow = {
  symbol: string;
  name: string;
  category: Category;
  sp500: boolean;
  kind: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  logo: string | null;
  spark: number[];
};

export const cryptoSubs = [
  "All crypto",
  ...CRYPTO_CATEGORIES.map((category) => category.label),
];
export const filters: Filter[] = [
  "All",
  "Pinned",
  "S&P 500",
  ...categories,
];
export const ranges: Range[] = ["1D", "5D", "1M"];
export const indexList: { key: IndexKey; name: string; proxy: string }[] = [
  { key: "sp500", name: "S&P 500", proxy: "SPY" },
  { key: "nasdaq", name: "Nasdaq", proxy: "QQQ" },
  { key: "dow", name: "Dow Jones", proxy: "DIA" },
  { key: "russell", name: "Russell 2000", proxy: "IWM" },
];
export const PAGE_SIZE = 10;

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "An unexpected error occurred.";

export const isCrypto = (asset: Asset) =>
  asset.kind.toLowerCase().includes("crypto") || asset.symbol.includes(":");

export function filterAssets(
  assets: Asset[],
  cryptoAssets: Asset[],
  sp500Assets: Asset[],
  pinnedAssets: Asset[],
  filter: Filter,
  cryptoSub: string,
  query: string,
) {
  const search = query.trim().toLowerCase();
  const allAssets = [
    ...new Map(
      [...assets, ...cryptoAssets].map((asset) => [asset.symbol, asset]),
    ).values(),
  ];
  let rows: Asset[];

  switch (filter) {
    case "All":
      rows = allAssets.filter((asset) => !isCrypto(asset));
      break;
    case "Pinned":
      rows = pinnedAssets;
      break;
    case "S&P 500":
      rows = sp500Assets;
      break;
    case "Crypto":
      rows = allAssets.filter(isCrypto);
      if (cryptoSub !== "All crypto") {
        rows = rows.filter(
          (asset) =>
            CRYPTO_CATEGORIES.find(
              (category) => category.id === getCryptoCategory(asset.symbol),
            )?.label === cryptoSub,
        );
      }
      break;
    default:
      rows = allAssets.filter(
        (asset) =>
          !isCrypto(asset) && getMarketSector(asset.symbol) === filter,
      );
  }

  return rows.filter(
    (asset) =>
      !search ||
      asset.symbol.toLowerCase().includes(search) ||
      asset.name.toLowerCase().includes(search),
  );
}

export function rowFromAsset(
  asset: Asset,
  sp500Symbols: Set<string>,
  quotes: Map<string, Quote>,
  history: Record<string, Series>,
): MarketRow {
  const quote = quotes.get(asset.symbol);
  const category: Category = isCrypto(asset)
    ? "Crypto"
    : getMarketSector(asset.symbol);

  return {
    symbol: asset.symbol,
    name: asset.name,
    category,
    sp500: sp500Symbols.has(asset.symbol),
    kind: asset.kind,
    price: quote?.c ?? null,
    change: quote?.d ?? null,
    changePct: quote?.dp ?? null,
    logo: quote?.logo ?? null,
    spark: history[asset.symbol]?.c ?? [],
  };
}

export function getRangeSeries(series: Series | undefined, range: Range) {
  if (!series || series.c.length < 2) return [];
  if (range === "1D") return series.c;
  return series.c.slice(range === "5D" ? -6 : -22);
}

export function seriesChange(series: number[]) {
  const first = series[0];
  const last = series[series.length - 1];
  return first && last ? ((last - first) / first) * 100 : null;
}

export const money = (n: number) => `${n >= 0 ? "+" : "-"}$${fmt(Math.abs(n))}`;

export function calculateHoldings(
  positions: Position[],
  quotes: Map<string, Quote>,
) {
  let value = 0;
  let cost = 0;
  let day = 0;
  let ret = 0;
  let priced = 0;

  const rows = positions.map((position) => {
    const quote = quotes.get(position.symbol);
    const price = position.currentPrice ?? quote?.c ?? null;
    const rowValue =
      position.marketValue ?? (price === null ? null : position.shares * price);
    cost += position.shares * position.avgCost;
    if (rowValue !== null) {
      value += rowValue;
      day += position.intradayPnl ?? position.shares * (quote?.d ?? 0);
      ret += position.unrealizedPnl ?? rowValue - position.shares * position.avgCost;
      priced += 1;
    }
    return { position, value: rowValue };
  });

  rows.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

  return {
    rows,
    value,
    day,
    cost,
    ret,
    complete: positions.length > 0 && priced === positions.length,
  };
}
