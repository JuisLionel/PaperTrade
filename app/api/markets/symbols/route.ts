import { NextRequest, NextResponse } from "next/server";
import { FinnhubApiError, finnhub } from "../../../../lib/api";

const SP500_CSV_URL =
  "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv";
const SYMBOLS_REVALIDATE = 86400;
const SEARCH_REVALIDATE = 3600;

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
    .filter((asset): asset is WatchlistAsset => asset !== null)
    .slice(0, 500);
}

function parseSearchResults(results: FinnhubSearchResult[]): WatchlistAsset[] {
  const uniqueAssets = new Map<string, WatchlistAsset>();

  for (const result of results) {
    if (typeof result.symbol !== "string") continue;
    const symbol = result.symbol.trim().toUpperCase();
    if (!symbol || uniqueAssets.has(symbol)) continue;

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

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

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

  try {
    const response = await fetch(SP500_CSV_URL, {
      next: { revalidate: SYMBOLS_REVALIDATE },
    });
    if (!response.ok) {
      throw new Error(`S&P 500 source error ${response.status}`);
    }

    return NextResponse.json(parseConstituents(await response.text()), {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Failed to load S&P 500 symbols:", error);
    return NextResponse.json(
      { error: "Could not load S&P 500 symbols." },
      { status: 502 },
    );
  }
}
