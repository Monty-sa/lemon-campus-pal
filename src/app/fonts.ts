import localFont from "next/font/local";

export const ninerFont = localFont({
  src: [
    { path: "../fonts/niner-font-light.woff2", weight: "300", style: "normal" },
    { path: "../fonts/niner-font-regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/niner-font-medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/niner-font-bold.woff2", weight: "700", style: "normal" },
    { path: "../fonts/niner-font-black.woff2", weight: "900", style: "normal" },
  ],
  declarations: [{ prop: "font-family", value: "Niner Font" }],
  display: "swap",
  fallback: ["Segoe UI", "Arial", "sans-serif"],
  preload: false,
  variable: "--font-niner-font",
});
