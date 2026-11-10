import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Orders",
  description: "Review your simulated stock orders and their status.",
};

export default function orders() {
  return (
    <main className="min-h-0 flex-1 bg-base p-6">
      <h1 className="text-2xl font-semibold text-content">Orders</h1>
    </main>
  );
}
