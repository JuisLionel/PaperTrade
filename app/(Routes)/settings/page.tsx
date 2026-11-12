import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your PaperTrade account and application preferences.",
};

export default function Settings() {
  return (
    <main className="min-h-0 min-w-0 flex-1 bg-base p-3 sm:p-6">
      <h1 className="text-xl font-semibold text-content sm:text-2xl">Settings</h1>
    </main>
  );
}
