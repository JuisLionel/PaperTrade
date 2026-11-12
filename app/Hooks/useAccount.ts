"use client";
import { useEffect, useState } from "react";
import { ACCOUNT_UPDATED_EVENT, loadAccount, STORAGE_KEY } from "@/lib/storage";
import type { Account } from "@/types/trading";

/** null until localStorage has been read (avoids a hydration mismatch). */
export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    const initialization = window.setTimeout(() => setAccount(loadAccount()), 0);
    const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && setAccount(loadAccount());
    const onAccountUpdated = () => setAccount(loadAccount());
    window.addEventListener("storage", onStorage);
    window.addEventListener(ACCOUNT_UPDATED_EVENT, onAccountUpdated);
    return () => {
      window.clearTimeout(initialization);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ACCOUNT_UPDATED_EVENT, onAccountUpdated);
    };
  }, []);
  return account;
}