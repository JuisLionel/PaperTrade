import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "",
};

export default function Home() {
  return (
    <main className="h-1000 flex-1 bg-base p-6">
      <h1>HELLO, WORLD!</h1>
    </main>
  );
}
