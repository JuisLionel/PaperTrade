import { useEffect, type RefObject } from "react";

export default function useEscapeFocus(searchRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (document.activeElement === searchRef.current) {
        searchRef.current?.blur();
      } else {
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [searchRef]);
}