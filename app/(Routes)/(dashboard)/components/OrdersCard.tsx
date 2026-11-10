import Link from "next/link";
import { LuEllipsis, LuSearch } from "react-icons/lu";
import { dec2, orderTime } from "@/lib/format";
import type { Order, OrderStatus } from "@/types/trading";
import { Card, CardEmpty, IconButton } from "./Card";

const DOT: Record<OrderStatus, string> = { filled: "bg-success", pending: "bg-warning", cancelled: "bg-content-muted" };
const LABEL: Record<OrderStatus, string> = { filled: "Filled", pending: "Pending", cancelled: "Cancelled" };

export function OrdersCard({ orders, className }: { orders: Order[]; className?: string }) {
  const recent = [...orders].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5);
  return (
    <Card title="Recent orders" className={className}
      action={<Link href="/orders"><IconButton label="View all orders"><LuSearch /></IconButton></Link>}>
      {!recent.length ? (
        <CardEmpty title="No orders yet" text="Orders you place will show up here." />
      ) : (
        <div>
          {recent.map((o) => (
            <div key={o.id} className="grid h-14 grid-cols-[84px_auto_1fr_16px] items-center gap-3 border-t border-elevated px-5 text-[17px] transition-colors hover:bg-elevated min-[761px]:h-[68px] min-[761px]:grid-cols-[100px_auto_1fr_20px] min-[761px]:gap-4 min-[761px]:px-6">
              <span className="font-semibold capitalize text-opposite">{o.side} {o.symbol}</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-elevated px-2.5 py-0.5 text-[16px] text-opposite min-[761px]:text-[18px]">
                <i className={`size-1.5 rounded-full ${DOT[o.status]}`} />{LABEL[o.status]}
              </span>
              <span className="text-right text-[16px] leading-tight text-content-muted tabular-nums min-[761px]:text-[18px]">
                {o.qty} × {dec2(o.price)}{o.type === "limit" ? " limit" : ""}
                <span className="block">{orderTime(o.createdAt)}</span>
              </span>
              <LuEllipsis className="text-content-muted" aria-hidden />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}