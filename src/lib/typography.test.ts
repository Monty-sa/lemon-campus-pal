import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const fontAssets = [
  ["thmanyahsans-Light.woff2", "300"],
  ["thmanyahsans-Regular.woff2", "400"],
  ["thmanyahsans-Medium.woff2", "500"],
  ["thmanyahsans-Bold.woff2", "700"],
  ["thmanyahsans-Black.woff2", "900"],
] as const;

describe("Arabic student typography", () => {
  it("registers all five local Thmanyah Sans weights", () => {
    const configPath = resolve(projectRoot, "src/app/fonts.ts");
    expect(existsSync(configPath)).toBe(true);
    const config = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
    expect(config).toContain('prop: "font-family", value: "Thmanyah Sans"');

    for (const [file, weight] of fontAssets) {
      expect(existsSync(resolve(projectRoot, "src/fonts", file))).toBe(true);
      expect(config).toContain(file);
      expect(config).toContain(`weight: "${weight}"`);
    }
  });

  it("applies the local font to Arabic student roots and preserves English typography", () => {
    const css = readFileSync(resolve(projectRoot, "src/app/globals.css"), "utf8");
    expect(css).toContain('main.student-planner[lang="ar"]');
    expect(css).toContain('main.gpa-page[lang="ar"]');
    expect(css).toContain('--font-sans: "Thmanyah Sans"');
    expect(css).toContain("font-synthesis: none");
    const baseFontStack = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(baseFontStack).toMatch(/--font-sans:\s*"Segoe UI"/);
    expect(baseFontStack).not.toMatch(/--font-sans:\s*"Thmanyah Sans"/);
  });
});
