"use client";

import { useRef } from "react";
import Link from "next/link";
import { LuSearch, LuWallet, LuArrowDownToLine, LuSettings, LuUser, LuSun, LuMoon } from "react-icons/lu";

import useEscapeFocus from "../../Hooks/useEscapeFocus";

const accountLinks = [
  { name: "My Wallet", href: "/wallet", icon: LuWallet },
  { name: "Deposit", href: "/deposit", icon: LuArrowDownToLine },
  { name: "Settings", href: "/settings", icon: LuSettings },
];

export default function Navbar() {
  const searchRef = useRef<HTMLInputElement>(null);
  useEscapeFocus(searchRef);

  const closeDropdown = () => (document.activeElement as HTMLElement | null)?.blur();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-end gap-3 border-b border-white/10 bg-base/80 px-6 backdrop-blur">
      {/* Search */}
      <label className="group/input flex h-10 w-64 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 transition-all duration-200 focus-within:w-80 focus-within:border-white/30 focus-within:bg-white/10 hover:border-white/20">
        <LuSearch className="shrink-0 text-gray-400 transition-colors group-focus-within/input:text-gray-200" size={18} />
        <input
          ref={searchRef}
          type="search"
          placeholder="Search"
          aria-label="Search"
          className="grow bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
        />
        <kbd className="hidden rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 transition-colors group-focus-within/input:border-white/20 group-focus-within/input:bg-white/15 group-focus-within/input:text-white sm:inline-block">
          ESC
        </kbd>
      </label>

      <label className="swap swap-rotate grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-elevated text-content transition-colors hover:bg-white/10 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white/50">
        <input type="checkbox"
          className="theme-controller"
          value="synthwave"
          aria-label="Toggle color theme"
        />

        <LuSun className="swap-off h-5 w-5" />

        <LuMoon className="swap-on h-5 w-5" />
      </label>

      {/* Account */}
      <div className="dropdown dropdown-end">
        <button
          type="button"
          aria-label="Account menu"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-content transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
        >
          <LuUser size={20} />
        </button>

        <ul
          tabIndex={-1}
          className="dropdown-content menu z-30 mt-5 w-56 rounded-xl border border-white/10 bg-[#161922] p-2 shadow-2xl"
        >
          {accountLinks.map(({ name, href, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={closeDropdown}
                className="flex items-center gap-3 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white"
              >
                <Icon size={16} className="text-gray-400" />
                {name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}