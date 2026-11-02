import "./globals.css";
import NavigationShell from "./componets/navigation/navigation-shell";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-base">
        <NavigationShell>{children}</NavigationShell>
      </body>
    </html>
  );
}
