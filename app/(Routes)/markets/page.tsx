"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "@/app/Hooks/useAccount";
import MarketBrowser from "./components/MarketBrowser";
import MarketErrors from "./components/MarketErrors";
import MarketHeader from "./components/MarketHeader";
import MarketHoldings from "./components/MarketHoldings";
import MarketOverview from "./components/MarketOverview";
import { useMarketData } from "../../Hooks/useMarketData";
import type { Filter, Range } from "./market-types";

const EMPTY_POSITIONS: NonNullable<ReturnType<typeof useAccount>>["positions"] =
  [];

export default function Market() {
  const account = useAccount();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [cryptoSub, setCryptoSub] = useState("All crypto");
  const [range, setRange] = useState<Range>("1D");
  const [page, setPage] = useState(1);
  const browseRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const market = useMarketData({
    query,
    filter,
    cryptoSub,
    range,
    page,
    positions: account?.positions ?? EMPTY_POSITIONS,
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName;
      if (event.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openBrowse = (next: Filter) => {
    setPage(1);
    setFilter(next);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    browseRef.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  };

  const changeFilter = (next: Filter) => {
    setPage(1);
    setFilter(next);
  };

  return (
    <main className="min-h-screen min-w-0 bg-base px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <MarketHeader
        query={query}
        searchRef={searchRef}
        onQueryChange={(value) => {
          setPage(1);
          setQuery(value);
        }}
      />

      <MarketOverview
        history={market.history}
        historyError={market.historyError}
        historyKey={market.historyKey}
        historyLoadedKey={market.historyLoadedKey}
        indexQuotes={market.indexQuotes}
        range={range}
        onRangeChange={setRange}
      />

      <MarketErrors
        errors={[
          market.symbolsError,
          market.quotesError,
          market.indexError,
          market.pinError,
        ]}
        onRetry={market.retry}
      />

      {account && account.positions.length > 0 && (
        <MarketHoldings
          account={account}
          holdings={market.holdings}
          pinnedCount={market.pinnedSymbols.size}
          quotes={market.quotes}
          onBrowse={openBrowse}
        />
      )}

      <section ref={browseRef}>
        <MarketBrowser
          data={market.data}
          filter={filter}
          page={page}
          pinnedSymbols={market.pinnedSymbols}
          query={query}
          quotesError={market.quotesError}
          symbolsError={market.symbolsError}
          symbolsLoading={market.symbolsLoading}
          cryptoSub={cryptoSub}
          onCryptoSubChange={(value) => {
            setPage(1);
            setCryptoSub(value);
          }}
          onFilterChange={changeFilter}
          onPageChange={setPage}
          onTogglePin={market.togglePin}
        />
      </section>
    </main>
  );
}
