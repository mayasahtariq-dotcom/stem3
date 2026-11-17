// Synthesises the placeholder UI sounds (tap, pop) as tiny mono WAV files so
// the sound manager has real assets without third-party licences.
// Run: node scripts/build-sounds.mjs
import { writeFileSync } from "node:fs";

const RATE = 22050;
function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32767, i * 2));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
const tone = (ms, f0, f1, decay) =>
  Array.from({ length: Math.round((RATE * ms) / 1000) }, (_, i) => {
    const t = i / RATE, p = i / ((RATE * ms) / 1000);
    return Math.sin(2 * Math.PI * (f0 + (f1 - f0) * p) * t) * Math.exp(-decay * p) * 0.5;
  });
writeFileSync(new URL("../public/sounds/tap.wav", import.meta.url), wav(tone(60, 660, 520, 6)));
writeFileSync(new URL("../public/sounds/pop.wav", import.meta.url), wav(tone(160, 520, 1040, 4)));
console.log("wrote public/sounds/tap.wav, pop.wav");
