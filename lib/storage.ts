import type { Account } from "@/types/trading";

export const STORAGE_KEY = "papertradeaccount";
const LEGACY_STORAGE_KEY = "papertrade:account";

export const SEED_ACCOUNT: Account = {
  startingBalance: 100,
  cash: 100,
  positions: [],
  orders: [],
  watchlist: [],
};

const DEMO_POSITION_SHARES: Record<string, number> = {
  AAPL: 120,
  MSFT: 46,
  AMZN: 92,
  AMD: 110,
  NVDA: 84,
  TSLA: 65,
  META: 18,
};

function isSeededDemoAccount(account: Account) {
  return (
    account.positions.length === Object.keys(DEMO_POSITION_SHARES).length &&
    account.positions.every(
      (position) => DEMO_POSITION_SHARES[position.symbol] === position.shares,
    ) &&
    account.orders.some((order) => /^o-[1-5]$/.test(order.id))
  );
}

function isPreviouslyCleanedDemoAccount(account: Account) {
  const seededWatchlist = ["PLTR", "COIN", "SHOP", "NFLX", "INTC"];
  return (
    account.startingBalance === 118500 &&
    account.cash === 118500 &&
    account.positions.length === 0 &&
    account.orders.length === 0 &&
    account.watchlist.length === seededWatchlist.length &&
    account.watchlist.every((item, index) => item.symbol === seededWatchlist[index])
  );
}

export function saveAccount(account: Account) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
  } catch {}
}

export function loadAccount(): Account {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const account = JSON.parse(raw) as Account;
      if (
        typeof account.startingBalance === "number" &&
        typeof account.cash === "number" &&
        Array.isArray(account.positions) &&
        Array.isArray(account.orders) &&
        Array.isArray(account.watchlist)
      ) {
        const cleanedAccount =
          isSeededDemoAccount(account) || isPreviouslyCleanedDemoAccount(account)
          ? {
              ...account,
              startingBalance: SEED_ACCOUNT.startingBalance,
              cash: SEED_ACCOUNT.cash,
              positions: [],
              orders: [],
            }
          : account;

        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanedAccount));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return cleanedAccount;
      }
    }
  } catch {}
  saveAccount(SEED_ACCOUNT);
  return SEED_ACCOUNT;
}