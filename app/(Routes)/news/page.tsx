import { Metadata } from "next";
import NewsContent from "./NewsContent";

export const metadata: Metadata = {
  title: "News",
  description: "Stay informed with the latest financial news and market insights.",
};


export default function News() {
  return <NewsContent />;
}