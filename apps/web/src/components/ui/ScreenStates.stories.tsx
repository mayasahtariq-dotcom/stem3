import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ApiError } from "@/lib/api/errors";
import { EmptyState, ErrorState, LoadingState } from "./ScreenStates";

const meta: Meta = { title: "Design system/Screen states" };
export default meta;
type Story = StoryObj;

export const Loading: Story = { render: () => <LoadingState /> };
export const Empty: Story = { render: () => <EmptyState message={{ regional: "अभी कोई कक्षा नहीं", english: "No classes yet" }} /> };
export const Error: Story = { render: () => <ErrorState error={new ApiError("NETWORK", 0)} onRetry={() => {}} /> };
