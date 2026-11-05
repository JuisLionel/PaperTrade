"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  FiBarChart2,
  FiBriefcase,
  FiChevronRight,
  FiClock,
  FiFileText,
  FiGrid,
  FiSettings,
  FiStar,
} from "react-icons/fi";
import type { IconType } from "react-icons";

import WatchlistPanel from "../watchlist-panel";

const navigationSections: {
  title: string;
  links: { name: string; href: string; icon: IconType }[];
}[] = [
    {
      title: "Workspace",
      links: [
        { name: "Dashboard", href: "/", icon: FiGrid },
        { name: "Markets", href: "/markets", icon: FiBarChart2 },
        { name: "News", href: "/news", icon: FiFileText },
      ],
    },
    {
      title: "Your account",
      links: [
        { name: "Portfolio", href: "/portfolio", icon: FiBriefcase },
        { name: "Watchlist", href: "/watchlist", icon: FiStar },
        { name: "Orders & activity", href: "/orders", icon: FiClock },
      ],
    },
  ];

export default function Sidebar() {
  const pathname = usePathname();
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);

  return (
    <div className="sticky top-0 z-30 flex h-screen shrink-0">
      <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-base px-2 py-6">
        <nav aria-label="Main navigation" className="flex-1 space-y-7">
          {navigationSections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">
                {section.title}
              </h2>
              <ul className="menu menu-md w-full gap-2 p-0">
                {section.links.map((link) => {
                  const isWatchlistLink = link.name === "Watchlist";
                  const active = isWatchlistLink
                    ? isWatchlistOpen
                    : link.href === "/"
                      ? pathname === "/"
                      : pathname === link.href ||
                      pathname.startsWith(`${link.href}/`);
                  const Icon = link.icon;

                  return (
                    <li key={link.href}>
                      {isWatchlistLink ? (
                        <button
                          type="button"
                          aria-expanded={isWatchlistOpen}
                          onClick={() =>
                            setIsWatchlistOpen((isOpen) => !isOpen)
                          }
                          className={`w-full justify-start gap-3 text-left text-base ${active
                              ? "bg-elevated font-medium text-content"
                              : "text-content-muted hover:bg-elevated/70 hover:text-content"
                            }`}
                        >
                          <Icon
                            className={
                              active ? "text-content" : "text-content-muted hover:text-content"
                            }
                            size={20}
                          />
                          <span>{link.name}</span>

                          <FiChevronRight className={`ml-auto ${isWatchlistOpen ? "rotate-180" : ""} transition-transform duration-200`} size={16} />

                        </button>
                      ) : (
                        <Link
                          href={link.href}
                          aria-current={active ? "page" : undefined}
                          className={`w-full justify-start gap-3 text-left text-base ${active
                              ? "bg-elevated font-medium text-content"
                              : "text-content-muted hover:bg-elevated/70 hover:text-content"
                            }`}
                        >
                          <Icon
                            className={
                              active ? "text-content" : "text-content-muted hover:text-content"
                            }
                            size={20}
                          />
                          <span>{link.name}</span>
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>

        <div className="space-y-1 border-t border-border pt-4">
          <Link
            href="/settings"
            className="btn btn-ghost h-auto min-h-0 w-full justify-start gap-3 bg-transparent px-3 py-3 text-left text-base text-content-secondary transition-colors hover:bg-elevated hover:text-content"
          >
            <FiSettings size={20} className="text-content-muted" />
            Settings
          </Link>
        </div>
      </aside>

      <WatchlistPanel
        isOpen={isWatchlistOpen}
        onClose={() => setIsWatchlistOpen(false)}
      />
    </div>
  );
}
