import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Track your paper portfolio, investment performance, holdings, watchlist, and market news.",
};

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
