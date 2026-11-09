import type { Metadata } from "next";
import Script from "next/script";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { LANGUAGE_INIT_SCRIPT } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://lemoncampus.org"),
  title: "LEMON | Your Campus Pal",
  description: "Plan your KFU semester in Arabic or English. Explore courses, compare sections, and build a timetable.",
  applicationName: "LEMON",
  openGraph: { type: "website", url: "https://lemoncampus.org", siteName: "LEMON", title: "LEMON | Your Campus Pal", description: "Plan your KFU semester in Arabic or English.", images: [{ url: "https://lemoncampus.org/opengraph-image.png", width: 1200, height: 630, alt: "LEMON | Your Campus Pal." }] },
  twitter: { card: "summary_large_image", title: "LEMON | Your Campus Pal", description: "Plan your KFU semester in Arabic or English.", images: ["https://lemoncampus.org/opengraph-image.png"] },
  icons: { icon: "/favicon.svg", apple: "/apple-icon.png" },
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
