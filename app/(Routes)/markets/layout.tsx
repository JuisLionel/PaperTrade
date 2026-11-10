import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Markets",
  description:
    "Explore stock and cryptocurrency prices, market indexes, and your portfolio holdings.",
};

export default function MarketsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
