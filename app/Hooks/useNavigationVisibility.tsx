"use client";

import { createContext, useContext, type Dispatch, type SetStateAction } from "react";

export const NavigationVisibilityContext = createContext<
  Dispatch<SetStateAction<boolean>> | null
>(null);

export default function useNavigationVisibility() {
  const setNavigationVisible = useContext(NavigationVisibilityContext);

  if (!setNavigationVisible) {
    throw new Error("useNavigationVisibility must be used within NavigationShell");
  }

  return setNavigationVisible;
}