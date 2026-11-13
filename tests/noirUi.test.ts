import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../src/web/${p}`, import.meta.url), "utf8");

const PALETTE = [
  "#14161B", "#1D2027", "#262A33", "#2C313A", "#ECE8E1", "#A3A9B3",
  "#E8A33D", "#B3261E", "#F3EEE4", "#2A2620", "#2E7D32", "#6FA8DC",
];

describe("noir UI", () => {
  it("AC1: index.html links styles.css", () => {
    expect(read("index.html")).toMatch(/<link[^>]+href=["'][^"']*styles\.css["']/i);
  });

  it("AC1: styles.css :root block defines all 12 palette colours", () => {
    const css = read("styles.css");
    const root = css.match(/:root\s*\{([^}]*)\}/i);
    expect(root).not.toBeNull();
    const block = root![1].toLowerCase();
    for (const hex of PALETTE) expect(block, hex).toContain(hex.toLowerCase());
  });

  it("AC2: index.html loads IBM Plex Mono and Inter from Google Fonts; css has fallbacks", () => {
    const html = read("index.html");
    expect(html).toContain("fonts.googleapis.com");
    expect(html).toMatch(/IBM\+Plex\+Mono|IBM%20Plex%20Mono|IBM Plex Mono/);
    expect(html).toMatch(/family=Inter/);
    const css = read("styles.css");
    expect(css).toContain("monospace");
    expect(css).toContain("system-ui");
  });

  it("AC3: initials ignores titles and handles single names", async () => {
    const { initials } = await import("../src/web/format");
    expect(initials("Dr. Oskar Lind")).toBe("OL");
    expect(initials("Mara Quill")).toBe("MQ");
    expect(initials("Edwin")).toBe("E");
  });

  it("AC3: percent rounds, clamps to 0..100 and handles total 0", async () => {
    const { percent } = await import("../src/web/format");
    expect(percent(38000, 100000)).toBe(38);
    expect(percent(33333, 100000)).toBe(33);
    expect(percent(-5, 100)).toBe(0);
    expect(percent(150000, 100000)).toBe(100);
    expect(percent(5, 0)).toBe(0);
  });
});
