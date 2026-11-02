import { NextResponse } from "next/server";

const SP500_CSV_URL =
  "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv";

type WatchlistAsset = {
  symbol: string;
  name: string;
  sector?: string;
  kind: "Stock";
};

// Small CSV parser that handles quoted fields like "Tapestry, Inc."
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
  return cells.map((c) => c.trim());
}

function parseConstituents(csv: string): WatchlistAsset[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());

  const symbolIdx = header.indexOf("symbol");
  const nameIdx = header.findIndex((h) => h === "security" || h === "name");
  const sectorIdx = header.findIndex((h) => h === "gics sector" || h === "sector");

  if (symbolIdx === -1 || nameIdx === -1) {
    throw new Error("Unexpected S&P 500 CSV format.");
  }

  return lines
    .slice(1)
    .map((line): WatchlistAsset | null => {
      const cells = parseCsvLine(line);
      const symbol = cells[symbolIdx];
      if (!symbol) return null;

      return {
        symbol,
        name: cells[nameIdx] || symbol,
        sector: sectorIdx >= 0 ? cells[sectorIdx] : undefined,
        kind: "Stock",
      };
    })
    .filter((asset): asset is WatchlistAsset => asset !== null);
}

export async function GET() {
  try {
    const res = await fetch(SP500_CSV_URL, {
      next: { revalidate: 86400 }, // cache for 24h, the list rarely changes
    });

    if (!res.ok) {
      throw new Error(`S&P 500 source error ${res.status}`);
    }

    const assets = parseConstituents(await res.text()).slice(0, 500);

    return NextResponse.json(assets, {
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