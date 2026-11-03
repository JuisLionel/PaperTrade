"use client";

import { createContext, useContext, type Dispatch, type SetStateAction } from "react";

type NavigationVisibilitySetter = Dispatch<SetStateAction<boolean>>;

export const NavigationVisibilityContext =
  createContext<NavigationVisibilitySetter | null>(null);

NavigationVisibilityContext.displayName = "NavigationVisibilityContext";

export default function useNavigationVisibility(): NavigationVisibilitySetter {
  const setNavigationVisible = useContext(NavigationVisibilityContext);

  if (setNavigationVisible === null) {
    throw new Error("useNavigationVisibility must be used within NavigationShell");
  }

  return setNavigationVisible;
}