import { Metadata } from "next";

export const metadata: Metadata = {
  title: "News",
  description: "",
};

export default function News() {
  return (
    <main className="min-h-0 flex-1 bg-base p-6">
      <h1 className="text-2xl font-semibold text-content">News</h1>
    </main>
  );
}
