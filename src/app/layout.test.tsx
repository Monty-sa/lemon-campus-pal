import { describe, expect, it } from "vitest";
import RootLayout, { metadata } from "./layout";

describe("RootLayout (LEMON-035 Phase 1)", () => {
  it("defines standard application metadata", () => {
    expect(metadata.title).toContain("LEMON");
    expect(metadata.applicationName).toBe("LEMON");
  });

  it("returns html element with suppressHydrationWarning and Script elements", () => {
    const element = RootLayout({ children: <div data-testid="test-child">Hello LEMON</div> });
    expect(element.type).toBe("html");
    expect(element.props.suppressHydrationWarning).toBe(true);
    expect(element.props.dir).toBe("ltr");
    expect(element.props.lang).toBe("en");
  });
});
