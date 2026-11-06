import "./globals.css";
import { Space_Grotesk } from "next/font/google";
import { Suspense } from "react";
import NavigationShell from "./componets/navigation/navigation-shell";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import AntdProvider from "./componets/providers/AntdProvider";


const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-space-grotesk",
});

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-base">
        <Suspense fallback={<div className="min-h-screen bg-base" />}>
          <AntdRegistry>
            <AntdProvider>
              <NavigationShell>{children}</NavigationShell>
            </AntdProvider>
          </AntdRegistry>
        </Suspense>
      </body>
    </html>
  );
}
