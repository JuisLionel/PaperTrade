import type { ReactNode } from "react";
import { Button } from "antd";
import { LuCircleAlert, LuRefreshCw } from "react-icons/lu";
import Link from "next/link";

const dashboardButtonClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-full !border !border-elevated !bg-transparent px-4 text-[17px] font-medium !text-opposite transition-colors duration-150 hover:!border-content hover:!bg-transparent hover:!text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-content";

export function DashboardButton({
  href,
  onClick,
  children,
  className = "",
  primary = false,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  primary?: boolean;
}) {
  const classes = `${dashboardButtonClass} ${
    primary
      ? "!border-content !bg-content !text-base hover:!border-content hover:!bg-transparent hover:!text-content"
      : ""
  } ${className}`;

  return href ? (
    <Link href={href} className={classes} onClick={onClick}>
      {children}
    </Link>
  ) : (
    <Button onClick={onClick} className={classes}>
      {children}
    </Button>
  );
}

export function Card({ title, action, className = "", children }: {
  title: string; action?: ReactNode; className?: string; children: ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-surface ${className}`}>
      <header className="flex items-center justify-between px-5 pb-3 pt-5 min-[761px]:px-6 min-[761px]:pb-4 min-[761px]:pt-6">
        <h2 className="font-display text-[22px] font-medium text-opposite min-[761px]:text-[26px]">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function IconButton({ children, label, onClick }: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Button
      type="text"
      aria-label={label}
      icon={children}
      onClick={onClick}
      className="!inline-flex !size-9 min-[761px]:!size-11 !items-center !justify-center !rounded-full !border !border-elevated !bg-transparent !p-0 !text-content-secondary !shadow-none hover:!border-content hover:!bg-transparent hover:!text-content focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-content"
    />
  );
}

export function CardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-10 text-center" role="alert">
      <LuCircleAlert className="size-6 text-danger" aria-hidden />
      <p className="text-[17px] text-content-secondary">{message}</p>
      <DashboardButton onClick={onRetry}>
        <LuRefreshCw aria-hidden /> Try again
      </DashboardButton>
    </div>
  );
}

export function CardEmpty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-10 text-center min-[761px]:gap-3 min-[761px]:py-12">
      <p className="font-medium text-opposite">{title}</p>
      <p className="max-w-xs text-[17px] text-content-muted">{text}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 5, height = "h-10" }: { rows?: number; height?: string }) {
  return (
    <div className="space-y-2 px-5 pb-5" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`animate-pulse rounded-lg bg-elevated ${height}`} />
      ))}
    </div>
  );
}