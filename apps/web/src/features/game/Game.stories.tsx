import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ApiError } from "@/lib/api/errors";
import { badges, league, quests } from "@/mocks/game/progress";
import { gameStats } from "@/mocks/game/state";
import { GrowthAndBadges } from "./GrowthAndBadges";
import { LeagueScreen } from "./LeagueScreen";
import { PotPanel } from "./PotPanel";
import { QuestsScreen } from "./QuestsScreen";

const meta: Meta = { title: "Student/Game" };
export default meta;
type Story = StoryObj;
const noop = () => {};
const now = Date.now();

export const Quests: Story = { render: () => <QuestsScreen quests={quests("u-asha")} loading={false} error={null} claimingId={null} now={now} onClaim={noop} onRetry={noop} /> };
export const QuestsError: Story = { render: () => <QuestsScreen quests={undefined} loading={false} error={new ApiError("NOT_FOUND", 404)} claimingId={null} now={now} onClaim={noop} onRetry={noop} /> };
export const League: Story = { render: () => <LeagueScreen league={league("u-asha")} loading={false} error={null} now={now} onRetry={noop} /> };
export const LeagueOff: Story = { render: () => <LeagueScreen league={{ ...league("u-asha"), enabled: false }} loading={false} error={null} now={now} onRetry={noop} /> };
export const GrowthBadges: Story = { render: () => <GrowthAndBadges game={gameStats("u-asha")} badges={badges("u-asha")} badgesError={null} /> };
export const PotWaiting: Story = { render: () => <PotPanel potsWaiting={1} opening={false} opened={null} error={null} onOpen={noop} onClose={noop} /> };
export const PotOpened: Story = {
  render: () => <PotPanel potsWaiting={0} opening={false} opened={{ pot_id: "p", reward: { kind: "gems", amount: 10, item: null }, stats: gameStats("u-asha") }} error={null} onOpen={noop} onClose={noop} />,
};
