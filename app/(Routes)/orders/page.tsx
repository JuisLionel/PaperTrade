import { Metadata } from "next";
import OrdersClient from "./OrdersClient";

export const metadata: Metadata = {
  title: "Orders",
  description: "Review your simulated stock orders and their status.",
};

export default function orders() {
  return (
    <main className="min-h-0 min-w-0 flex-1 bg-base p-3 sm:p-6">
      <h1 className="text-xl font-semibold text-content sm:text-2xl">Orders</h1>
      <OrdersClient />
    </main>
  );
}
