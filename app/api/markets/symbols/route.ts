import { NextRequest, NextResponse } from "next/server";
import { FinnhubApiError, finnhub } from "../../../../lib/api";
import { CRYPTO_ASSETS } from "@/lib/crypto-categories";

const SP500_CSV_URL =
  "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv";
const SYMBOLS_REVALIDATE = 86400;
const SEARCH_REVALIDATE = 3600;
const ALL_TTL_MS = 6 * 60 * 60 * 1000;

type WatchlistAsset = {
  symbol: string;
  name: string;
  kind: string;
};

type FinnhubSearchResult = {
  symbol?: unknown;
  displaySymbol?: unknown;
  description?: unknown;
  type?: unknown;
};

type FinnhubSearchResponse = {
  result?: FinnhubSearchResult[];
};

type FinnhubSymbol = {
  symbol?: unknown;
  displaySymbol?: unknown;
  description?: unknown;
  type?: unknown;
};

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseConstituents(csv: string): WatchlistAsset[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase());
  const symbolIndex = header.indexOf("symbol");
  const nameIndex = header.findIndex(
    (cell) => cell === "security" || cell === "name",
  );

  if (symbolIndex === -1 || nameIndex === -1) {
    throw new Error("Unexpected S&P 500 CSV format.");
  }

  return lines
    .slice(1)
    .map((line): WatchlistAsset | null => {
      const cells = parseCsvLine(line);
      const symbol = cells[symbolIndex];
      if (!symbol) return null;

      return {
        symbol,
        name: cells[nameIndex] || symbol,
        kind: "Stock",
      };
    })
    .filter((asset): asset is WatchlistAsset => asset !== null);
}

function parseSearchResults(results: FinnhubSearchResult[]): WatchlistAsset[] {
  const uniqueAssets = new Map<string, WatchlistAsset>();

  for (const result of results) {
    if (typeof result.symbol !== "string") continue;
    const symbol = result.symbol.trim().toUpperCase();
    if (!symbol || uniqueAssets.has(symbol)) continue;
    // Crypto quotes come from Binance USDT pairs only
    if (symbol.includes(":") && !symbol.endsWith("USDT")) continue;

    const displaySymbol =
      typeof result.displaySymbol === "string"
        ? result.displaySymbol.trim()
        : symbol;
    const name =
      typeof result.description === "string"
        ? result.description.trim()
        : displaySymbol;

    uniqueAssets.set(symbol, {
      symbol,
      name: name || displaySymbol || symbol,
      kind: typeof result.type === "string" ? result.type : "Stock",
    });
  }

  return [...uniqueAssets.values()];
}

async function loadSp500(): Promise<WatchlistAsset[]> {
  const response = await fetch(SP500_CSV_URL, {
    next: { revalidate: SYMBOLS_REVALIDATE },
  });
  if (!response.ok) {
    throw new Error(`S&P 500 source error ${response.status}`);
  }
  return parseConstituents(await response.text());
}

function parseUsSymbols(list: FinnhubSymbol[]): WatchlistAsset[] {
  const assets: WatchlistAsset[] = [];

  for (const item of list) {
    if (typeof item.symbol !== "string") continue;
    const symbol = item.symbol.trim().toUpperCase();
    if (!symbol) continue;

    const description =
      typeof item.description === "string" ? item.description.trim() : "";
    assets.push({
      symbol,
      name: description || symbol,
      kind:
        typeof item.type === "string" && item.type.trim()
          ? item.type.trim()
          : "Stock",
    });
  }

  return assets;
}

// The full US list is several MB, which is over Next's 2 MB fetch-cache limit,
// so it is cached in memory instead.
let allCache: { at: number; assets: WatchlistAsset[] } | null = null;
let allInflight: Promise<WatchlistAsset[]> | null = null;

async function loadAllUsAssets(): Promise<WatchlistAsset[]> {
  if (allCache && Date.now() - allCache.at < ALL_TTL_MS) {
    return allCache.assets;
  }
  if (allInflight) return allInflight;

  allInflight = (async () => {
    const [sp500, us] = await Promise.all([
      loadSp500().catch((error) => {
        console.error("Failed to load S&P 500 symbols:", error);
        return [] as WatchlistAsset[];
      }),
      finnhub<FinnhubSymbol[]>("/stock/symbol", { exchange: "US" }, 0),
    ]);
    if (!Array.isArray(us)) {
      throw new Error("Unexpected Finnhub symbol list response.");
    }

    // S&P 500 first, then every other US symbol Finnhub has, sorted by ticker
    const merged = new Map<string, WatchlistAsset>();
    sp500.forEach((asset) => merged.set(asset.symbol, asset));
    parseUsSymbols(us)
      .sort((a, b) => a.symbol.localeCompare(b.symbol))
      .forEach((asset) => {
        if (!merged.has(asset.symbol)) merged.set(asset.symbol, asset);
      });

    const assets = [...merged.values()];
    allCache = { at: Date.now(), assets };
    return assets;
  })().finally(() => {
    allInflight = null;
  });

  return allInflight;
}

const LIST_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = params.get("q")?.trim();
  const kind = params.get("kind");

  if (query) {
    try {
      const response = await finnhub<FinnhubSearchResponse>(
        "/search",
        { q: query },
        SEARCH_REVALIDATE,
      );
      if (!Array.isArray(response.result)) {
        throw new Error("Unexpected Finnhub symbol search response.");
      }

      return NextResponse.json(parseSearchResults(response.result), {
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        },
      });
    } catch (error) {
      if (error instanceof FinnhubApiError && error.status === 429) {
        return NextResponse.json(
          { error: "Symbol search is temporarily rate limited." },
          {
            status: 429,
            headers: { "Retry-After": error.retryAfter ?? "60" },
          },
        );
      }
      console.error("Failed to search US market symbols:", error);
      return NextResponse.json(
        { error: "Could not search US market symbols." },
        { status: 502 },
      );
    }
  }

  if (kind === "crypto") {
    const cryptoAssets: WatchlistAsset[] = CRYPTO_ASSETS.map((coin) => ({
      symbol: `BINANCE:${coin.base}USDT`,
      name: coin.name,
      kind: "Crypto",
    }));
    return NextResponse.json(cryptoAssets, { headers: LIST_HEADERS });
  }

  if (kind === "sp500") {
    try {
      return NextResponse.json(await loadSp500(), { headers: LIST_HEADERS });
    } catch (error) {
      console.error("Failed to load S&P 500 symbols:", error);
      return NextResponse.json(
        { error: "Could not load S&P 500 symbols." },
        { status: 502 },
      );
    }
  }

  // Default: everything Finnhub has for the US market
  try {
    return NextResponse.json(await loadAllUsAssets(), {
      headers: LIST_HEADERS,
    });
  } catch (error) {
    if (error instanceof FinnhubApiError && error.status === 429) {
      return NextResponse.json(
        { error: "Symbol list is temporarily rate limited." },
        {
          status: 429,
          headers: { "Retry-After": error.retryAfter ?? "60" },
        },
      );
    }
    console.error("Failed to load US market symbols:", error);
    return NextResponse.json(
      { error: "Could not load US market symbols." },
      { status: 502 },
    );
  }
}