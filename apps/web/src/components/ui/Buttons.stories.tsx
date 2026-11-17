import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BilingualText } from "./BilingualText";
import { ChunkyButton } from "./ChunkyButton";
import { StickerIcon } from "./StickerIcon";

const label = { regional: "आगे बढ़ें", english: "Continue" };

const meta: Meta<typeof ChunkyButton> = {
  title: "Design system/ChunkyButton",
  component: ChunkyButton,
  args: { children: <BilingualText as="span" text={label} align="center" tone="inverse" /> },
};
export default meta;
type Story = StoryObj<typeof ChunkyButton>;

export const Primary: Story = {};
export const White: Story = { args: { variant: "white", children: <BilingualText as="span" text={label} align="center" /> } };
export const Ghost: Story = { args: { variant: "ghost", children: "आगे बढ़ें · Continue" } };
export const Sky: Story = { args: { variant: "sky" } };
export const Wood: Story = { args: { variant: "wood" } };
export const Loading: Story = { args: { loading: true } };
export const Disabled: Story = { args: { disabled: true, children: <BilingualText as="span" text={label} align="center" /> } };
export const Icon: Story = { args: { variant: "white", size: "icon", "aria-label": "Sound on", children: <StickerIcon name="speaker" /> } };
