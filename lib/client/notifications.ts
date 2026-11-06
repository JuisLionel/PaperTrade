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
};

const NOTIFICATION_EVENT = "papertrade:notification";
let notificationSequence = 0;

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
}: PurchaseCompletedDetails) {
  const action = side === "buy" ? "purchased" : "sold";
  publishNotification({
    type: "purchase",
    title: side === "buy" ? "Purchase completed" : "Sale completed",
    message: `${quantity.toLocaleString()} shares of ${symbol} ${action}.`,
    symbol,
  });
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
