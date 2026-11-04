import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wallet",
  description: "",
};

export default function Wallet() {
  return (
    <main className="min-h-0 flex-1 bg-base p-6">
      <h1 className="text-2xl font-semibold text-content">Wallet</h1>
    </main>
  );
}
