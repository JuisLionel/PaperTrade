"use client";
import { useEffect, useState } from "react";
import { loadAccount, STORAGE_KEY } from "@/lib/storage";
import type { Account } from "@/types/trading";

/** null until localStorage has been read (avoids a hydration mismatch). */
export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    setAccount(loadAccount());
    const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && setAccount(loadAccount());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return account;
}