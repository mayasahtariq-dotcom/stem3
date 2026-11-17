import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AnswerOption } from "./AnswerOption";

const meta: Meta<typeof AnswerOption> = {
  title: "Design system/AnswerOption",
  component: AnswerOption,
  args: { index: 1, text: { regional: "माइटोकॉन्ड्रिया", english: "Mitochondria" } },
  decorators: [(S) => <div style={{ width: 340 }}><S /></div>],
};
export default meta;
type Story = StoryObj<typeof AnswerOption>;

export const Idle: Story = {};
export const Selected: Story = { args: { state: "selected" } };
export const Correct: Story = { args: { state: "correct", stateLabel: "Correct" } };
export const NotQuite: Story = { args: { state: "incorrect", stateLabel: "Not quite" } };
