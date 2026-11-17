import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BilingualText } from "./BilingualText";
import { SpeechBubble } from "./SpeechBubble";

const meta: Meta<typeof BilingualText> = {
  title: "Design system/BilingualText",
  component: BilingualText,
  args: { text: { regional: "कोशिका जीवन की इकाई है", english: "The cell is the unit of life" } },
};
export default meta;
type Story = StoryObj<typeof BilingualText>;

export const Hindi: Story = {};
export const Kannada: Story = { args: { text: { regional: "ಜೀವಕೋಶ ಜೀವದ ಘಟಕ", english: "The cell is the unit of life" } } };
export const Large: Story = { args: { size: "2xl" } };
export const InBubble: Story = {
  render: (args) => (
    <SpeechBubble>
      <BilingualText {...args} />
    </SpeechBubble>
  ),
};
