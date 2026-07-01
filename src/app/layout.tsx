import type { Metadata } from "next";
import { Inter, Newsreader, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { PrivacyProvider } from "@/components/privacy-provider";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

// UI UX Pro Max typography: Inter for the interface (neutral, premium),
// Newsreader for long-form legal reading ("designed for long-form reading"),
// JetBrains Mono for nomor putusan / dates / IDs / logs.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Newsreader({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Apof.ai — Personal legal research",
  description:
    "A fast, beautiful, local-first personal research interface for Indonesian court decisions. Not an official Mahkamah Agung product.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className={`${inter.variable} ${serif.variable} ${mono.variable}`}>
      <body className="font-sans">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <PrivacyProvider>
            <AppShell>{children}</AppShell>
            <Toaster
              position="bottom-right"
              toastOptions={{ className: "font-sans" }}
              closeButton
            />
          </PrivacyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
