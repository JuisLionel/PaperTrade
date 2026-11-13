"use client";

import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { ConfigProvider, Drawer } from "antd";
import Navbar from "./navbar";
import Sidebar from "./sidebar";
import { NavigationVisibilityContext } from "../../Hooks/useNavigationVisibility";
import { OPEN_WATCHLIST_EVENT } from "@/lib/client/watchlist-storage";

export default function NavigationShell({ children }: { children: ReactNode }) {
  const [navigationVisible, setNavigationVisible] = useState(true);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [mobileWatchlistRequest, setMobileWatchlistRequest] = useState(0);
  const showNavigation = navigationVisible;

  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const savedTheme = window.localStorage.getItem("papertrade-theme");
    const hasSavedTheme = savedTheme === "light" || savedTheme === "dark";
    const applyTheme = (theme: "light" | "dark") => {
      document.documentElement.dataset.theme = theme;
    };

    applyTheme(
      hasSavedTheme ? savedTheme : mediaQuery.matches ? "light" : "dark",
    );
    if (hasSavedTheme) return;

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      applyTheme(event.matches ? "light" : "dark");
    };
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, []);

  useEffect(() => {
    const openMobileWatchlist = () => {
      if (!window.matchMedia("(max-width: 760px)").matches) return;
      setMobileNavigationOpen(true);
      setMobileWatchlistRequest((request) => request + 1);
    };
    window.addEventListener(OPEN_WATCHLIST_EVENT, openMobileWatchlist);
    return () => window.removeEventListener(OPEN_WATCHLIST_EVENT, openMobileWatchlist);
  }, []);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "var(--color-content)",
          colorBgBase: "var(--color-base)",
          colorBgContainer: "var(--color-surface)",
          colorBgElevated: "var(--color-surface)",
          colorText: "var(--color-content-secondary)",
          colorTextSecondary: "var(--color-content-muted)",
          colorTextPlaceholder: "var(--color-content-muted)",
          colorBorder: "var(--color-border)",
          colorBorderSecondary: "var(--color-border)",
          borderRadius: 6,
          fontSize: 14,
          fontFamily: "inherit",
          controlHeight: 36,
          boxShadow: "none",
          boxShadowSecondary: "none",
        },
        components: {
          Dropdown: { borderRadiusLG: 6 },
          Input: {
            activeShadow: "none",
            hoverBorderColor: "var(--color-content-secondary)",
            activeBorderColor: "var(--color-content)",
          },
          Modal: { borderRadiusLG: 8 },
        },
      }}
    >
      <NavigationVisibilityContext.Provider value={setNavigationVisible}>
        <div className="flex min-h-screen">
          {showNavigation && (
            <div className="max-[760px]:hidden">
              <Suspense
                fallback={
                  <aside
                    aria-hidden="true"
                    className="h-screen w-60 shrink-0 border-r border-neutral-800 bg-base"
                  />
                }
              >
                <Sidebar />
              </Suspense>
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            {showNavigation && (
              <Navbar onOpenNavigation={() => setMobileNavigationOpen(true)} />
            )}
            {children}
          </div>
          {showNavigation && (
            <Drawer
              placement="left"
              size="100%"
              mask={false}
              open={mobileNavigationOpen}
              onClose={() => setMobileNavigationOpen(false)}
              closable={false}
              className="min-[761px]:!hidden [&_.ant-drawer-content-wrapper]:!w-full [&_.ant-drawer-content-wrapper]:!max-w-full [&_.ant-drawer-content]:!h-[100dvh] [&_.ant-drawer-content]:!bg-surface [&_.ant-drawer-body]:!h-full [&_.ant-drawer-body]:!overflow-hidden [&_.ant-drawer-body]:!bg-surface [&_.ant-drawer-body]:!p-0 [&_.ant-drawer-header]:!hidden"
            >
              <Suspense fallback={<div className="h-full bg-base" />}>
                <Sidebar
                  mobile
                  onNavigate={() => setMobileNavigationOpen(false)}
                  watchlistRequest={mobileWatchlistRequest}
                />
              </Suspense>
            </Drawer>
          )}
        </div>
      </NavigationVisibilityContext.Provider>
    </ConfigProvider>
  );
}
