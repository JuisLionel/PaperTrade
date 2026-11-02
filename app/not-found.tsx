"use client";

import Link from "next/link";
import useNavigationVisibility from "./Hooks/useNavigationVisibility";
import { useEffect } from "react";


export default function NotFound() {
  const setNavigationVisible = useNavigationVisibility();

  useEffect(() => {
    setNavigationVisible(false);
    return () => setNavigationVisible(true);
  }, [setNavigationVisible]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <h1>Page Not Found</h1>
      <Link href="/" className="ml-4 text-blue-500 hover:underline">
        Go to Home
      </Link>
    </div>
  );
}
