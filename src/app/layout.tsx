import type { Metadata } from "next";
import Script from "next/script";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { LANGUAGE_INIT_SCRIPT } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "LEMON · Your Campus Pal.",
  description: "Plan your semester. Your way. An independent schedule planner for King Faisal University students.",
  applicationName: "LEMON",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body suppressHydrationWarning>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <Script
          id="language-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: LANGUAGE_INIT_SCRIPT }}
        />
        {children}
      </body>
    </html>
  );
}
