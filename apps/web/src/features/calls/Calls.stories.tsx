import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ApiError } from "@/lib/api/errors";
import { callsState, studentOut, twinOut } from "@/mocks/calls/state";
import { AddCallStudentScreen } from "./AddCallStudentScreen";
import { CallsScreen, type CallsScreenProps } from "./CallsScreen";
import { draftProblems } from "./rules";
import { emptyDraft } from "./routes";

const meta: Meta = { title: "Teacher/Calls" };
export default meta;
type Story = StoryObj;

const noop = () => {};
const students = callsState().students.map(studentOut);
const lakshmi = callsState().students[0]!;
const base: CallsScreenProps = {
  students,
  loading: false,
  error: null,
  noClasses: false,
  selectedId: lakshmi.id,
  call: null,
  starting: false,
  callError: null,
  twin: twinOut(lakshmi),
  twinLoading: false,
  twinError: null,
  pausingId: null,
  demo: null,
  onSelect: noop,
  onCallNow: noop,
  onTogglePause: noop,
  onRetry: noop,
  formatDateTime: (iso) => iso.slice(0, 16),
};
const session = { id: "c9", call_student_id: lakshmi.id, attempt: 1, started_at: "2026-11-18T12:30:00Z", connected_at: null, ended_at: null, minutes: 0, retry_at: null };

export const Console: Story = { render: () => <CallsScreen {...base} /> };
export const Ringing: Story = { render: () => <CallsScreen {...base} call={{ ...session, state: "ringing" }} /> };
export const Connected: Story = { render: () => <CallsScreen {...base} call={{ ...session, state: "connected", connected_at: "2026-11-18T12:30:05Z" }} /> };
export const OutsideHours: Story = { render: () => <CallsScreen {...base} callError={new ApiError("OUTSIDE_CALL_HOURS", 409)} demo={{ now: "2026-11-18T16:00:00Z", busy: false, onEvening: noop, onReal: noop }} /> };
export const Empty: Story = { render: () => <CallsScreen {...base} students={[]} selectedId={null} /> };
export const Loading: Story = { render: () => <CallsScreen {...base} students={undefined} loading /> };
export const Failed: Story = { render: () => <CallsScreen {...base} students={undefined} error={new ApiError("NETWORK", 0)} /> };

const draft = { ...emptyDraft(), name: "K", phone: "123", window: { start: "20:30", end: "21:30" } };
const addBase = { classroomName: "Class 9-A Science", saving: false, saveError: null, onDraft: noop, onNext: noop, onBack: noop, onConfirm: noop };
export const AddForm: Story = { render: () => <AddCallStudentScreen {...addBase} draft={emptyDraft()} step="form" problems={{}} showProblems={false} /> };
export const AddFormProblems: Story = { render: () => <AddCallStudentScreen {...addBase} draft={draft} step="form" problems={draftProblems(draft)} showProblems /> };
export const AddDuplicate: Story = {
  render: () => <AddCallStudentScreen {...addBase} draft={{ ...emptyDraft(), name: "Kiran", phone: "9845011111" }} step="form" problems={{}} showProblems saveError={new ApiError("DUPLICATE_PHONE", 409)} />,
};
export const AddConfirm: Story = { render: () => <AddCallStudentScreen {...addBase} draft={{ ...emptyDraft("kannada"), name: "Kiran", phone: "9845055555" }} step="confirm" problems={{}} showProblems={false} /> };
