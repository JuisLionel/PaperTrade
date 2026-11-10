import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your PaperTrade account and application preferences.",
};

export default function Settings() {
  return (
    <main className="min-h-0 flex-1 bg-base p-6">
      <h1 className="text-2xl font-semibold text-content">Settings</h1>
    </main>
  );
}
