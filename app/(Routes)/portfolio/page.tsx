import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Manage your simulated investment portfolio.",
};

export default function Portfolio() {
  const startingBalance = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(100);

  return (
    <main className="min-w-0 flex-1 bg-base p-4 sm:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-base-content">Portfolio</h1>
        <p className="mt-1 text-sm text-content-muted">
          Your simulated account and investments
        </p>
      </header>

      <section
        aria-label="Portfolio summary"
        className="grid gap-3 sm:grid-cols-2"
      >
        <article className="rounded-xl border border-elevated bg-surface p-5">
          <p className="text-sm text-content-muted">Portfolio value</p>
          <p className="mt-2 text-3xl font-semibold text-base-content">
            {startingBalance}
          </p>
          <p className="mt-2 text-sm text-success">+$0.00 · 0.00% return</p>
        </article>
        <article className="rounded-xl border border-elevated bg-surface p-5">
          <p className="text-sm text-content-muted">Available to invest</p>
          <p className="mt-2 text-3xl font-semibold text-base-content">
            {startingBalance}
          </p>
          <p className="mt-2 text-sm text-content-muted">
            Your virtual funds are held as cash
          </p>
        </article>
      </section>

      <section
        aria-labelledby="portfolio-holdings-heading"
        className="mt-3 rounded-xl border border-elevated bg-surface p-5"
      >
        <h2
          id="portfolio-holdings-heading"
          className="font-semibold text-base-content"
        >
          Your holdings
        </h2>
        <div className="mt-4 rounded-lg border border-dashed border-elevated px-4 py-10 text-center">
          <p className="font-medium text-base-content">No investments yet</p>
          <p className="mt-1 text-sm text-content-muted">
            Your {startingBalance} paper balance is ready when you are.
          </p>
          <Link
            href="/markets"
            className="mt-4 inline-flex rounded-lg bg-content px-4 py-2 text-sm font-semibold text-base hover:opacity-90"
          >
            Explore markets
          </Link>
        </div>
      </section>
    </main>
  );
}
