"use client";

import type { RefObject } from "react";
import { FiSearch } from "react-icons/fi";

type MarketHeaderProps = {
  query: string;
  searchRef: RefObject<HTMLInputElement | null>;
  onQueryChange: (query: string) => void;
};

export default function MarketHeader({
  query,
  searchRef,
  onQueryChange,
}: MarketHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h1 className="font-display text-ui-xl font-bold text-opposite">
        Markets
      </h1>
      <label className="input input-sm h-9 w-full rounded-sm border-elevated bg-surface sm:w-72">
        <FiSearch className="text-content-muted" />
        <input
          ref={searchRef}
          type="search"
          placeholder="Search symbol or company"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <kbd className="kbd kbd-sm border-0 bg-elevated text-content-secondary">
          /
        </kbd>
      </label>
    </header>
  );
}
