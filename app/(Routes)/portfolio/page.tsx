import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "",
};

export default function Portfolio() {
  return (
    <main className="min-h-0 flex-1 bg-base p-6">
      <h1 className="text-2xl font-semibold text-content">Portfolio</h1>
    </main>
  );
}
