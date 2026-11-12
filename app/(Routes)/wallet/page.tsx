import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wallet",
  description: "Review your simulated cash balance and available funds.",
};

export default function Wallet() {
  return (
    <main className="min-h-0 min-w-0 flex-1 bg-base p-3 sm:p-6">
      <h1 className="text-xl font-semibold text-content sm:text-2xl">Wallet</h1>
    </main>
  );
}
