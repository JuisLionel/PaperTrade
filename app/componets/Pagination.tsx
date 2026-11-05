import Link from "next/link";
import { HiArrowLeft, HiArrowRight } from "react-icons/hi";

type PaginationProps = {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
};

export default function Pagination({
  page,
  totalPages,
  hrefForPage,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const edge =
    "grid size-10 place-items-center rounded-full text-content-secondary transition hover:bg-elevated hover:text-content";
  const disabled = "pointer-events-none opacity-30";

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between border-t border-line pt-6"
    >
      <Link
        href={hrefForPage(page - 1)}
        aria-label="Previous page"
        aria-disabled={page === 1}
        className={`${edge} ${page === 1 ? disabled : ""}`}
      >
        <HiArrowLeft size={16} />
      </Link>

      <ul className="flex items-center gap-2">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <li key={p}>
            <Link
              href={hrefForPage(p)}
              aria-current={p === page ? "page" : undefined}
              className={`grid size-8 place-items-center rounded-full text-xs transition ${
                p === page
                  ? "bg-content font-semibold text-base"
                  : "text-content-secondary hover:bg-elevated hover:text-content"
              }`}
            >
              {p}
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href={hrefForPage(page + 1)}
        aria-label="Next page"
        aria-disabled={page === totalPages}
        className={`${edge} ${page === totalPages ? disabled : ""}`}
      >
        <HiArrowRight size={16} />
      </Link>
    </nav>
  );
}
