import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { GoluMascot } from "./GoluMascot";
import { MeadowScene } from "./MeadowScene";
import { STICKER_ICON_NAMES, StickerIcon } from "./StickerIcon";
import { COW_POSES } from "./art.generated";

const meta: Meta = { title: "Design system/Art" };
export default meta;
type Story = StoryObj;

export const Stickers: Story = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(11, 40px)", gap: 8 }}>
      {STICKER_ICON_NAMES.map((n) => (
        <StickerIcon key={n} name={n} size={32} label={n} />
      ))}
    </div>
  ),
};
export const Golu: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12 }}>
      {(Object.keys(COW_POSES) as (keyof typeof COW_POSES)[]).map((p) => (
        <GoluMascot key={p} pose={p} size={90} label={`Golu ${p}`} />
      ))}
    </div>
  ),
};
export const Meadow: Story = { parameters: { layout: "fullscreen" }, render: () => <MeadowScene /> };
