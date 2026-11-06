const LOCALE = "en-US";
const usdFmt = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "USD" });
const dec2Fmt = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactFmt = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 0 });

export const usd = (n: number) => usdFmt.format(n);
export const dec2 = (n: number) => dec2Fmt.format(n);
export const num = (n: number) => new Intl.NumberFormat(LOCALE).format(n);
export const compactUsd = (n: number) => `$${compactFmt.format(n).toLowerCase()}`;
export const signedUsd = (n: number) => `${n >= 0 ? "+" : "-"}${usdFmt.format(Math.abs(n))}`;
export const signedPct = (n: number) => `${n >= 0 ? "+" : "-"}${Math.abs(n).toFixed(2)}%`;
export const toneText = (n: number) => (n >= 0 ? "text-success" : "text-danger");

export function timeAgo(unix: number) {
  const s = Math.max(0, Date.now() / 1000 - unix);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function orderTime(iso: string) {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString())
    return `Today ${d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  return d.toLocaleDateString(LOCALE, { month: "short", day: "2-digit" });
}