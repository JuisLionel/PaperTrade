import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "",
};

export default function MarketDetail() {
  return (
    <main className="min-h-0 flex-1 bg-base p-6">
      <h1 className="text-2xl font-semibold text-content">Market Detail</h1>
    </main>
  );
}
