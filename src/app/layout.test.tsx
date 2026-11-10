import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/local", () => ({
  default: () => ({ variable: "thmanyah-font-variable" }),
}));
import RootLayout, { metadata } from "./layout";

describe("RootLayout (LEMON-035 Phase 1)", () => {
  it("defines standard application metadata", () => {
    expect(metadata.title).toContain("LEMON");
    expect(metadata.applicationName).toBe("LEMON");
    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({
        url: "https://lemoncampus.org/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "LEMON | Your Campus Pal.",
      }),
    ]);
    expect(metadata.twitter?.images).toEqual(["https://lemoncampus.org/opengraph-image.png"]);
  });

  it("returns html element with suppressHydrationWarning and Script elements", () => {
    const element = RootLayout({ children: <div data-testid="test-child">Hello LEMON</div> });
    expect(element.type).toBe("html");
    expect(element.props.suppressHydrationWarning).toBe(true);
    expect(element.props.dir).toBe("ltr");
    expect(element.props.lang).toBe("en");
    expect(element.props.className).toBe("thmanyah-font-variable");
  });
});
