"use client";

import { Suspense, useState, type ReactNode } from "react";
import { ConfigProvider } from "antd";
import Navbar from "./navbar";
import Sidebar from "./sidebar";
import { NavigationVisibilityContext } from "../../Hooks/useNavigationVisibility";

export default function NavigationShell({ children }: { children: ReactNode }) {
  const [navigationVisible, setNavigationVisible] = useState(true);

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
          {navigationVisible && (
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
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            {navigationVisible && <Navbar />}
            {children}
          </div>
        </div>
      </NavigationVisibilityContext.Provider>
    </ConfigProvider>
  );
}
