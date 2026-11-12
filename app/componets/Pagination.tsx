import Link from "next/link";
import type { ReactNode } from "react";
import { HiArrowLeft, HiArrowRight } from "react-icons/hi";

type PaginationBaseProps = {
  page: number;
  totalPages: number;
};

type PaginationProps = PaginationBaseProps &
  (
    | { hrefForPage: (page: number) => string; onPageChange?: never }
    | { hrefForPage?: never; onPageChange: (page: number) => void }
  );

export default function Pagination(props: PaginationProps) {
  const { page, totalPages } = props;
  if (totalPages <= 1) return null;

  const edge =
    "grid size-10 place-items-center rounded-full text-content-secondary transition hover:bg-elevated hover:text-content";
  const disabled = "pointer-events-none opacity-30";
  const pageLink = (target: number, content: ReactNode, label?: string) => {
    const className = `${edge} ${target < 1 || target > totalPages ? disabled : ""}`;
    if (props.hrefForPage) {
      return (
        <Link
          href={props.hrefForPage(target)}
          aria-label={label}
          aria-disabled={target < 1 || target > totalPages}
          className={className}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        type="button"
        onClick={() => props.onPageChange(Math.min(totalPages, Math.max(1, target)))}
        disabled={target < 1 || target > totalPages}
        aria-label={label}
        className={className}
      >
        {content}
      </button>
    );
  };

  return (
    <nav
      aria-label="Pagination"
      className="flex min-w-0 items-center justify-between gap-2 border-t border-line pt-6"
    >
      {pageLink(page - 1, <HiArrowLeft size={16} />, "Previous page")}

      <span className="flex items-center gap-2 text-xs text-content-secondary sm:hidden" aria-current="page">
        <span className="grid size-8 place-items-center rounded-full bg-content font-semibold text-base">
          {page}
        </span>
        <span>of {totalPages}</span>
      </span>

      <ul className="hidden items-center gap-2 sm:flex">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <li key={p}>
            {props.hrefForPage ? (
              <Link
                href={props.hrefForPage(p)}
                aria-current={p === page ? "page" : undefined}
                className={`grid size-8 place-items-center rounded-full text-xs transition ${
                  p === page
                    ? "bg-content font-semibold text-base"
                    : "text-content-secondary hover:bg-elevated hover:text-content"
                }`}
              >
                {p}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => props.onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                className={`grid size-8 place-items-center rounded-full text-xs transition ${
                  p === page
                    ? "bg-content font-semibold text-base"
                    : "text-content-secondary hover:bg-elevated hover:text-content"
                }`}
              >
                {p}
              </button>
            )}
          </li>
        ))}
      </ul>

      {pageLink(page + 1, <HiArrowRight size={16} />, "Next page")}
    </nav>
  );
}
