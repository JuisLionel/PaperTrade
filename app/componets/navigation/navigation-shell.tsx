"use client";

import { Suspense, useState, type ReactNode } from "react";
import Navbar from "./navbar";
import Sidebar from "./sidebar";
import { NavigationVisibilityContext } from "../../Hooks/useNavigationVisibility";

export default function NavigationShell({ children }: { children: ReactNode }) {
  const [navigationVisible, setNavigationVisible] = useState(true);

  return (
    <NavigationVisibilityContext.Provider value={setNavigationVisible}>
      <div className="flex min-h-screen">
        {navigationVisible && (
          <Suspense
            fallback={<aside aria-hidden="true" className="min-h-screen w-54 shrink-0 border-r border-line bg-base" />}
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
  );
}
