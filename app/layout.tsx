import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GitHub Checker",
  description: "AI-powered triage dashboard on local Supabase Postgres + pgvector",
};

// Runs before paint (inline, blocking) so the page never flashes the wrong
// theme on load — reading localStorage inside a React effect would be too late.
const themeScript = `
(function () {
  try {
    var theme = localStorage.getItem("theme");
    if (theme !== "light" && theme !== "dark") {
      theme = "dark";
    }
    document.documentElement.setAttribute("data-theme", theme);
  } catch (error) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-inkLine bg-card">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
            <Link href="/" className="text-lg font-bold text-glow no-underline">
              GitHub Checker
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="no-underline">
                Dashboard
              </Link>
              {/* COMMENTED 2026-08-06: Issues and Proposed links removed from top
                  nav per user request — both are now nav buttons on the dashboard
                  itself, beside Analyze, so they were redundant here.
              <Link href="/issues" className="no-underline">
                Issues
              </Link>
              <Link href="/proposed" className="no-underline">
                Proposed
              </Link>
              */}
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8 flex-1 w-full">{children}</main>
        <footer className="max-w-6xl mx-auto px-6 py-6 text-xs text-inkDim">
          Built on local Supabase Postgres + pgvector. Sync from GitHub via gh CLI.
        </footer>
      </body>
    </html>
  );
}
