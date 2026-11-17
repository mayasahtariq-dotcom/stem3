import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BadgeTile, LeagueRow, QuestCard, SourceChip } from "./GameCards";

const meta: Meta = { title: "Design system/Game cards", decorators: [(S) => <div style={{ width: 340 }}><S /></div>] };
export default meta;
type Story = StoryObj;

export const League: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 6 }}>
      <LeagueRow rank={1} name="Asha" xp={320} xpLabel="XP" zone="promote" />
      <LeagueRow rank={4} name="You" xp={210} xpLabel="XP" isSelf />
      <LeagueRow rank={9} name="Ravi" xp={40} xpLabel="XP" zone="demote" callOnly callOnlyLabel="Learns by phone call" />
    </div>
  ),
};
export const Quest: Story = { render: () => <QuestCard title={{ regional: "10 सवालों के जवाब दो", english: "Answer 10 questions" }} progress={6} goal={10} progressLabel="6 of 10" /> };
export const QuestDone: Story = { render: () => <QuestCard title={{ regional: "3 का कॉम्बो पाओ", english: "Get a 3 combo" }} progress={3} goal={3} progressLabel="3 of 3" done /> };
export const Badges: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8 }}>
      <BadgeTile name={{ regional: "पहला पाठ", english: "First lesson" }} icon="star" earned />
      <BadgeTile name={{ regional: "7 दिन", english: "7-day streak" }} icon="flame" earned={false} lockedLabel="Locked" />
    </div>
  ),
};
export const Source: Story = { render: () => <SourceChip label="Notes p. 3" /> };
