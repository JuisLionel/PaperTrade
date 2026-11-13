"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACCOUNT_UPDATED_EVENT,
  loadAccount,
  STORAGE_KEY,
} from "@/lib/storage";
import { fetchAlpacaAccount } from "@/lib/api/alpaca";
import { syncPinnedAssets } from "@/lib/client/watchlist-storage";
import type { Account } from "@/types/trading";

export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const refresh = useCallback(async () => {
    if (!hasLoaded.current) setLoading(true);
    try {
      const brokerAccount = await fetchAlpacaAccount();
      const watchlist = loadAccount().watchlist;
      setAccount({ ...brokerAccount, watchlist });
      setError(null);
      void syncPinnedAssets()
        .then((assets) => {
          setAccount((current) =>
            current
              ? {
                  ...current,
                  watchlist: assets.map(({ symbol, name }) => ({
                    symbol,
                    name,
                  })),
                }
              : current,
          );
        })
        .catch((syncError: unknown) => {
          console.error("Failed to sync Alpaca account watchlist:", syncError);
        });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the Alpaca paper account.",
      );
    } finally {
      hasLoaded.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialization = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30_000);
    const onFocus = () => void refresh();
    const onAccountUpdated = () => void refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) void refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener(ACCOUNT_UPDATED_EVENT, onAccountUpdated);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearTimeout(initialization);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(ACCOUNT_UPDATED_EVENT, onAccountUpdated);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  return { account, loading, error, refresh };
}
