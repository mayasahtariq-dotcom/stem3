import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressBar } from "./ProgressBar";
import { GemCounter, HeartMeter, StreakFlame, TopStatsBar, XPRing } from "./GameStats";

const meta: Meta = { title: "Design system/Progress and stats" };
export default meta;
type Story = StoryObj;

export const Progress: Story = { render: () => <div style={{ width: 300 }}><ProgressBar value={0.6} label="Lesson progress" /></div> };
export const Stats: Story = {
  render: () => (
    <TopStatsBar streak={{ value: 5, label: "5 day streak" }} gems={{ value: 120, label: "120 gems" }} hearts={{ value: 4, label: "4 of 5 hearts" }} />
  ),
};
export const Pieces: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <StreakFlame value={0} active={false} label="No streak yet" />
      <GemCounter value={0} label="0 gems" />
      <HeartMeter value={0} label="0 of 5 hearts" />
      <XPRing value={30} goal={50} label="30 of 50 XP today" />
    </div>
  ),
};
