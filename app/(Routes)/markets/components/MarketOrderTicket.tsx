"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, X } from "lucide-react";
import type { OrderSide, Order } from "@/types/trading";

type MarketOrderTicketProps = {
  side: OrderSide;
  symbol: string;
  name: string;
  price: number;
  changePct: number | null;
  buyingPower: number;
  cash: number;
  shares: number;
  fractional: boolean;
  onClose: () => void;
  onSubmit: (
    side: OrderSide,
    type: Order["type"],
    quantity: number,
    price: number,
  ) => void | Promise<void>;
};

const money = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: value > 0 && value < 1 ? 6 : 2,
  });

function formatQuantity(value: number, fractional: boolean) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: fractional ? 6 : 0,
  });
}

export default function MarketOrderTicket({
  side: initialSide,
  symbol,
  name,
  price,
  changePct,
  buyingPower,
  cash,
  shares,
  fractional,
  onClose,
  onSubmit,
}: MarketOrderTicketProps) {
  const [side, setSide] = useState<OrderSide>(initialSide);
  const [type, setType] = useState<Order["type"]>("market");
  const [quantity, setQuantity] = useState("1");
  const [limitPrice, setLimitPrice] = useState(String(price));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const unitPrice = type === "market" ? price : Number(limitPrice);
  const maxQuantity =
    side === "buy"
      ? buyingPower / (Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : price)
      : shares;
  const adjustedMax = fractional
    ? Math.floor(maxQuantity * 1_000_000) / 1_000_000
    : Math.floor(maxQuantity);
  const parsedQuantity = Number(quantity);
  const estimatedTotal =
    Number.isFinite(parsedQuantity) &&
    parsedQuantity > 0 &&
    Number.isFinite(unitPrice) &&
    unitPrice > 0
      ? parsedQuantity * unitPrice
      : 0;
  const overAvailable = parsedQuantity > adjustedMax + 1e-8;
  const invalidQuantity =
    !Number.isFinite(parsedQuantity) ||
    parsedQuantity <= 0 ||
    (!fractional && !Number.isInteger(parsedQuantity));
  const invalidLimit =
    type === "limit" && (!Number.isFinite(unitPrice) || unitPrice <= 0);
  const invalidOrder = invalidQuantity || invalidLimit || overAvailable;
  const quickQuantities = [1, 5, 10].filter(
    (value) => fractional || Number.isInteger(value),
  );
  const cashAfterOrder =
    type === "limit"
      ? cash
      : cash + (side === "buy" ? -estimatedTotal : estimatedTotal);

  function setOrderSide(nextSide: OrderSide) {
    setSide(nextSide);
    setError(null);
    setQuantity("1");
  }

  function setQuantityValue(value: number) {
    setQuantity(String(Math.max(0, Math.min(adjustedMax, value))));
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    if (invalidQuantity) {
      setError(fractional ? "Enter a valid quantity." : "Enter a whole number of shares.");
      return;
    }
    if (invalidLimit) {
      setError("Enter a valid limit price.");
      return;
    }
    if (overAvailable) {
      setError(
        side === "buy"
          ? `Not enough buying power. You can afford up to ${formatQuantity(adjustedMax, fractional)} ${fractional ? "units" : "shares"}.`
          : `Not enough available shares. You can sell up to ${formatQuantity(adjustedMax, fractional)}.`,
      );
      return;
    }
    let submitted = false;
    try {
      setSubmitting(true);
      await onSubmit(side, type, parsedQuantity, unitPrice);
      submitted = true;
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not submit this Alpaca paper order.",
      );
    } finally {
      if (!submitted) setSubmitting(false);
    }
  }

  const displayName = name.length > 28 ? `${name.slice(0, 27)}…` : name;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (!submitting && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="market-order-title"
        className="w-full max-w-[420px] rounded-2xl border border-border bg-surface p-5 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2
                id="market-order-title"
                className="truncate text-base font-semibold text-opposite"
              >
                {symbol}
              </h2>
              <span className="rounded bg-elevated px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-content-muted">
                PAPER
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-content-muted">
              {displayName}
            </p>
          </div>
          <div className="flex shrink-0 items-start gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums text-opposite">
                {money(price)}
              </p>
              <p
                className={`text-xs tabular-nums ${
                  (changePct ?? 0) >= 0 ? "text-success" : "text-danger"
                }`}
              >
                {changePct === null
                  ? "—"
                  : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close order ticket"
              onClick={onClose}
              disabled={submitting}
              className="grid size-7 place-items-center rounded text-content-muted hover:bg-elevated hover:text-content"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-2 rounded-lg bg-elevated p-1">
            {(["buy", "sell"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={side === value}
                onClick={() => setOrderSide(value)}
                className={`h-9 rounded-md text-sm font-medium capitalize transition-colors ${
                  side === value
                    ? value === "buy"
                      ? "bg-success text-base"
                      : "bg-danger text-base"
                    : "text-content-muted hover:text-content"
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          <fieldset>
            <legend className="mb-2 text-xs text-content-muted">Order type</legend>
            <div className="flex gap-2">
              {(["market", "limit"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={type === value}
                  onClick={() => {
                    setType(value);
                    setError(null);
                  }}
                  className={`h-9 rounded-lg border px-4 text-sm capitalize ${
                    type === value
                      ? "border-content text-opposite"
                      : "border-border text-content-secondary hover:border-content-muted"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </fieldset>

          {type === "limit" && (
            <label className="block text-xs text-content-muted">
              Limit price
              <input
                type="text"
                inputMode="decimal"
                value={limitPrice}
                onChange={(event) => {
                  setLimitPrice(event.target.value);
                  setError(null);
                }}
                className="input input-bordered mt-1 h-10 w-full bg-base text-right tabular-nums text-opposite"
              />
            </label>
          )}

          <div>
            <label
              htmlFor="order-quantity"
              className="mb-2 block text-xs text-content-muted"
            >
              {fractional ? "Quantity" : "Shares"}
            </label>
            <div
              className={`h-12 overflow-hidden rounded-lg border ${
                overAvailable || invalidLimit ? "border-danger" : "border-border"
              } bg-base`}
            >
              <input
                id="order-quantity"
                type="text"
                inputMode={fractional ? "decimal" : "numeric"}
                aria-label={fractional ? "Quantity" : "Number of shares"}
                value={quantity}
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setError(null);
                }}
                className="h-full w-full bg-transparent text-center text-lg font-semibold tabular-nums text-opposite outline-none"
              />
            </div>
            <div className="mt-2 flex gap-2">
              {quickQuantities.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setQuantityValue(value)}
                  className="h-8 rounded-md border border-border px-3 text-xs text-content-secondary hover:bg-elevated hover:text-content"
                >
                  {value}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setQuantityValue(adjustedMax)}
                className="h-8 rounded-md border border-border px-3 text-xs text-content-secondary hover:bg-elevated hover:text-content"
              >
                Max
              </button>
            </div>
          </div>

          {overAvailable && (
            <div
              role="alert"
              className="flex gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p>
                {side === "buy"
                  ? `Not enough buying power. You can afford up to ${formatQuantity(adjustedMax, fractional)} ${fractional ? "units" : "shares"}.`
                  : `Not enough available shares. You can sell up to ${formatQuantity(adjustedMax, fractional)} ${fractional ? "units" : "shares"}.`}
              </p>
            </div>
          )}

          <dl className="space-y-2 rounded-xl border border-border bg-base p-3 text-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-content-muted">Market price</dt>
              <dd className="tabular-nums text-opposite">{money(price)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-content-muted">
                {fractional ? "Quantity" : "Shares"}
              </dt>
              <dd className="tabular-nums text-opposite">
                {formatQuantity(
                  Number.isFinite(parsedQuantity) ? parsedQuantity : 0,
                  fractional,
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-2 text-sm font-medium">
              <dt className="text-opposite">
                {side === "buy" ? "Estimated cost" : "Estimated proceeds"}
              </dt>
              <dd className="tabular-nums text-opposite">
                {money(estimatedTotal)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-content-muted">
                {side === "buy" ? "Buying power" : "Available shares"}
              </dt>
              <dd className="tabular-nums text-content-secondary">
                {side === "buy"
                  ? money(buyingPower)
                  : formatQuantity(shares, fractional)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-content-muted">
                {type === "limit" ? "Cash before fill" : "Cash after order"}
              </dt>
              <dd className="tabular-nums text-content-secondary">
                {overAvailable ? "—" : money(cashAfterOrder)}
              </dd>
            </div>
          </dl>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={invalidOrder || submitting}
            className={`btn w-full border-0 ${
              invalidOrder || submitting
                ? "bg-elevated text-content-muted"
                : side === "buy"
                  ? "bg-success text-base hover:bg-success/90"
                  : "bg-danger text-base hover:bg-danger/90"
            }`}
          >
            {submitting
              ? "Submitting to Alpaca…"
              : invalidOrder
              ? overAvailable
                ? side === "buy"
                  ? "Insufficient buying power"
                  : "Insufficient shares"
                : invalidLimit
                  ? "Enter a valid limit price"
                  : "Enter a valid quantity"
              : `${type === "limit" ? "Place limit" : "Place market"} ${side} order`}
          </button>
          <p className="text-center text-[10px] text-content-muted">
            Simulated order. No real money is used.
          </p>
        </form>
      </section>
    </div>
  );
}
