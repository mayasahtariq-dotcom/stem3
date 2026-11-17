import en from "../../../messages/en.json";
import hi from "../../../messages/hi.json";
import kn from "../../../messages/kn.json";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const keys = (o: object, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
const leaves = (o: object): string[] => Object.values(o).flatMap((v) => (v && typeof v === "object" ? leaves(v) : [String(v)]));

describe("messages", () => {
  it("every string exists in en, hi and kn", () => {
    expect(keys(hi).sort()).toEqual(keys(en).sort());
    expect(keys(kn).sort()).toEqual(keys(en).sort());
  });
  it("never says 'Wrong'", () => {
    for (const s of leaves(en)) expect(s).not.toMatch(/\bwrong answer\b|^wrong\b/i);
  });
  it("uses no emoji (illustrated stickers only)", () => {
    for (const s of [...leaves(en), ...leaves(hi), ...leaves(kn)]) expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it("logs every Hindi and Kannada string for review", () => {
    const log = readFileSync(resolve(process.cwd(), "../../docs/translations-to-review.md"), "utf8");
    for (const s of [...leaves(hi), ...leaves(kn)]) {
      if (/[ऀ-ॿಀ-೿]/.test(s)) expect(log, s).toContain(s);
    }
  });
});
