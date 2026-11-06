const SYMBOL = /^[A-Z][A-Z0-9.\-]{0,9}$/;

export function parseSymbols(raw: string | null, max = 25): string[] {
  if (!raw) return [];
  const list = raw.split(",").map((s) => s.trim().toUpperCase()).filter((s) => SYMBOL.test(s));
  return [...new Set(list)].slice(0, max);
}