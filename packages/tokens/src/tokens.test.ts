import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderTokensCss } from "./css.ts";
import { color } from "./index.ts";

test("tokens.css is in sync with src/index.ts", () => {
  const onDisk = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");
  assert.equal(onDisk, renderTokensCss(), "run `pnpm --filter @mooshala/tokens generate`");
});

const lum = (hex: string) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

test("text pairs meet WCAG AA 4.5:1", () => {
  const pairs: [string, string, string][] = [
    ["ink on cream", color.ink, color.cream],
    ["stone (muted) on cream", color.stone, color.cream],
    ["white on primary button", color.white, color.grassStrong],
    ["white on sky button", color.white, color.skyStrong],
    ["white on wood", color.white, color.wood],
    ["error text on white", color.coralStrong, color.white],
    ["ink on sun", color.ink, color.sun],
    ["ink on parchment", color.ink, color.parchment],
  ];
  for (const [name, fg, bg] of pairs) {
    assert.ok(contrast(fg, bg) >= 4.5, `${name}: ${contrast(fg, bg).toFixed(2)}`);
  }
});
