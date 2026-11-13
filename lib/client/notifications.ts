import type { Order } from "@/types/trading";

export type AppNotification = {
  id: string;
  type: "purchase" | "finnhub";
  title: string;
  message: string;
  symbol?: string;
  createdAt: number;
};

export type PurchaseCompletedDetails = {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  crypto?: boolean;
};

const NOTIFICATION_EVENT = "papertrade:notification";
let notificationSequence = 0;
let observedOrderStatuses: Map<string, Order["status"]> | null = null;
let lastOrderSnapshotAt = 0;

function publishNotification(
  notification: Omit<AppNotification, "id" | "createdAt">,
) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<AppNotification>(NOTIFICATION_EVENT, {
      detail: {
        ...notification,
        id: `notification-${++notificationSequence}`,
        createdAt: Date.now(),
      },
    }),
  );
}

export function publishPurchaseCompletedNotification({
  symbol,
  side,
  quantity,
  crypto = false,
}: PurchaseCompletedDetails) {
  const action = side === "buy" ? "purchased" : "sold";
  const unit = crypto ? "unit" : "share";
  publishNotification({
    type: "purchase",
    title: side === "buy" ? "Purchase completed" : "Sale completed",
    message: `${quantity.toLocaleString()} ${unit}${quantity === 1 ? "" : "s"} of ${symbol} ${action}.`,
    symbol,
  });
}

export function observeAlpacaOrders(orders: Order[]) {
  if (typeof window === "undefined") return;

  const observedAt = Date.now();
  if (!observedOrderStatuses) {
    observedOrderStatuses = new Map(
      orders.map((order) => [order.id, order.status]),
    );
    lastOrderSnapshotAt = observedAt;
    return;
  }

  const nextStatuses = new Map<string, Order["status"]>();
  for (const order of orders) {
    const previousStatus = observedOrderStatuses.get(order.id);
    const createdAt = Date.parse(order.createdAt);
    const firstSeenSinceLastSnapshot =
      previousStatus === undefined &&
      Number.isFinite(createdAt) &&
      createdAt >= lastOrderSnapshotAt - 5_000;

    if (
      order.status === "filled" &&
      previousStatus !== "filled" &&
      (previousStatus !== undefined || firstSeenSinceLastSnapshot)
    ) {
      publishPurchaseCompletedNotification({
        symbol: order.symbol,
        side: order.side,
        quantity: order.filledQty ?? order.qty,
        crypto: order.crypto,
      });
    }

    nextStatuses.set(order.id, order.status);
  }
  observedOrderStatuses = nextStatuses;
  lastOrderSnapshotAt = observedAt;
}

export function publishFinnhub423Notification(symbol: string) {
  publishNotification({
    type: "finnhub",
    title: "Finnhub error 423",
    message: `Finnhub returned 423 (Locked) while loading ${symbol}.`,
    symbol,
  });
}

export function subscribeToNotifications(
  listener: (notification: AppNotification) => void,
) {
  const handleNotification = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    listener(event.detail as AppNotification);
  };

  window.addEventListener(NOTIFICATION_EVENT, handleNotification);
  return () => window.removeEventListener(NOTIFICATION_EVENT, handleNotification);
}
