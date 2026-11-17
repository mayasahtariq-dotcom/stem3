import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ApiError } from "@/lib/api/errors";
import { childDashboard } from "@/mocks/parent/state";
import { ChildScreen } from "./ChildScreen";
import { ParentHomeScreen } from "./ParentHomeScreen";
import { ParentLinkPanel } from "./ParentLinkCard";

const meta: Meta = { title: "Parent/Mode" };
export default meta;
type Story = StoryObj;

const noop = () => {};
const link = { parentId: "u-meena", studentId: "u-asha", linkedAt: 0, active: true, consentAt: null };
const dash = childDashboard("u-asha", link);
const home = { code: "", preview: undefined, previewLoading: false, previewError: null, linking: false, linkError: null, onCode: noop, onLink: noop, onCancelLink: noop, onRetry: noop };

export const HomeEmpty: Story = { render: () => <ParentHomeScreen {...home} kids={[]} loading={false} error={null} /> };
export const HomeWithChild: Story = { render: () => <ParentHomeScreen {...home} kids={[dash.child]} loading={false} error={null} /> };
export const LinkPreview: Story = {
  render: () => <ParentHomeScreen {...home} kids={[]} loading={false} error={null} code="K7M4PX" preview={{ id: "u-asha", name: "Asha", classes: dash.classes }} />,
};
export const HomeError: Story = { render: () => <ParentHomeScreen {...home} kids={undefined} loading={false} error={new ApiError("SERVER", 500)} /> };
const child = { loading: false, error: null, consentBusy: false, removing: false, deletion: null, speaking: false, onApprove: noop, onRevoke: noop, onUnlink: noop, onDelete: noop, onListen: noop, onRetry: noop, formatDate: (d: string) => d.slice(0, 10) };
export const ChildPending: Story = { render: () => <ChildScreen {...child} data={dash} /> };
export const ChildApproved: Story = { render: () => <ChildScreen {...child} data={{ ...dash, child: { ...dash.child, consent_status: "approved" } }} /> };
export const ChildLoading: Story = { render: () => <ChildScreen {...child} data={undefined} loading /> };
export const StudentLinkPanel: Story = {
  render: () => <ParentLinkPanel parents={[{ id: "p1", name: "Meena", phone_last4: "0002", linked_at: "2026-11-10T00:00:00Z", consented: true }]} parentsError={null} code={{ code: "K7M4PX", expires_at: "2026-11-18T10:00:00Z" }} creating={false} removingId={null} onCreate={noop} onRemove={noop} formatTime={(d) => d.slice(0, 16)} />,
};
