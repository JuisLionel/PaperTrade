"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LuWallet, LuArrowDownToLine, LuSettings, LuUser, LuSun, LuMoon } from "react-icons/lu";

type Theme = "dark" | "light";
const THEME_STORAGE_KEY = "papertrade-theme";

const accountLinks = [
  { name: "My Wallet", href: "/wallet", icon: LuWallet },
  { name: "Deposit", href: "/deposit", icon: LuArrowDownToLine },
  { name: "Settings", href: "/settings", icon: LuSettings },
];

export default function Navbar() {
  const [theme, setTheme] = useState<Theme>("dark");
  const hasManualTheme = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const hasSavedTheme = savedTheme === "light" || savedTheme === "dark";
    hasManualTheme.current = hasSavedTheme;
    const initialTheme: Theme =
      hasSavedTheme
        ? savedTheme
        : mediaQuery.matches
          ? "light"
          : "dark";

    const applyTheme = (nextTheme: Theme) => {
      document.documentElement.dataset.theme = nextTheme;
      setTheme(nextTheme);
    };

    applyTheme(initialTheme);

    if (hasManualTheme.current) return;

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      if (!hasManualTheme.current) {
        applyTheme(event.matches ? "light" : "dark");
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    hasManualTheme.current = true;
    setTheme(nextTheme);
  };

  const closeDropdown = () => (document.activeElement as HTMLElement | null)?.blur();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-end gap-3 border-b border-border bg-base/80 px-6 backdrop-blur">

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        className="btn btn-ghost btn-circle size-10 min-h-10 bg-elevated text-content hover:bg-surface"
      >
        {theme === "dark" ? <LuSun className="h-5 w-5" /> : <LuMoon className="h-5 w-5" />}
      </button>

      {/* Account */}
      <div className="dropdown dropdown-end">
        <button
          type="button"
          aria-label="Account menu"
          className="btn btn-ghost btn-circle size-10 min-h-10 bg-elevated text-content hover:bg-surface"
        >
          <LuUser size={20} />
        </button>

        <ul
          tabIndex={-1}
          className="dropdown-content menu menu-sm z-30 mt-5 w-56 border border-border rounded-[10px] bg-base p-2 shadow-2xl"
        >
          {accountLinks.map(({ name, href, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={closeDropdown}
                className="gap-3 text-content-secondary hover:bg-elevated hover:text-content"
              >
                <Icon size={16} className="text-content-muted" />
                {name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}