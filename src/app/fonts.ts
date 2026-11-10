import localFont from "next/font/local";

export const thmanyahSans = localFont({
  src: [
    { path: "../fonts/thmanyahsans-Light.woff2", weight: "300", style: "normal" },
    { path: "../fonts/thmanyahsans-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/thmanyahsans-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/thmanyahsans-Bold.woff2", weight: "700", style: "normal" },
    { path: "../fonts/thmanyahsans-Black.woff2", weight: "900", style: "normal" },
  ],
  declarations: [{ prop: "font-family", value: "Thmanyah Sans" }],
  display: "swap",
  fallback: ["Segoe UI", "Arial", "sans-serif"],
  preload: false,
  variable: "--font-thmanyah-sans",
});
