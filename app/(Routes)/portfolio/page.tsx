import type { Metadata } from "next";
import { PortfolioView } from "./PortfolioView";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Manage your simulated investment portfolio.",
};

export default function Portfolio() {
  return <PortfolioView />;
}
