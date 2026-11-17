import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { lessonOut } from "@/mocks/learning/handlers";
import { courseById, courseOut, courseSummary, dashboard, studentDetail, teacherState } from "@/mocks/teacher/state";
import { ApiError } from "@/lib/api/errors";
import { CourseDetailScreen } from "./CourseDetailScreen";
import { CoursesScreen } from "./CoursesScreen";
import { LessonReviewScreen } from "./LessonReviewScreen";
import { OverviewScreen } from "./OverviewScreen";
import { optionLabels, publishBlock, reviewItems } from "./review";
import { StudentDetailScreen } from "./StudentDetailScreen";
import { StudentsScreen } from "./StudentsScreen";
import { initialRun } from "./upload";
import { UploadScreen } from "./UploadScreen";

const meta: Meta = { title: "Teacher/Portal" };
export default meta;
type Story = StoryObj;

const noop = () => {};
const dash = dashboard("c-bio9a");
const classes = [{ id: "c-bio9a", name: "Class 9-A Science", subject: "BI" as const, grade: 9, join_key: "BI09-K4X2", expires_at: null, allowed_language_modes: ["hindi" as const, "kannada" as const], student_count: 8, created_at: "2026-11-01T09:00:00Z" }];
const review = lessonOut("tis-l1");
const items = reviewItems(review);

export const Overview: Story = {
  render: () => <OverviewScreen data={dash} loading={false} error={null} noClasses={false} consentSaving={false} onToggleConsent={noop} onOpenStudent={noop} onRetry={noop} />,
};
export const OverviewNoClass: Story = {
  render: () => <OverviewScreen data={undefined} loading={false} error={null} noClasses consentSaving={false} onToggleConsent={noop} onOpenStudent={noop} onRetry={noop} />,
};
export const OverviewError: Story = {
  render: () => <OverviewScreen data={undefined} loading={false} error={new ApiError("NETWORK", 0)} noClasses={false} consentSaving={false} onToggleConsent={noop} onOpenStudent={noop} onRetry={noop} />,
};
export const Students: Story = {
  render: () => <StudentsScreen rows={dash.students} loading={false} error={null} noClasses={false} filter="all" sort="name" query="" onFilter={noop} onSort={noop} onQuery={noop} onOpen={noop} onRetry={noop} />,
};
export const StudentsLoading: Story = {
  render: () => <StudentsScreen rows={undefined} loading error={null} noClasses={false} filter="all" sort="name" query="" onFilter={noop} onSort={noop} onQuery={noop} onOpen={noop} onRetry={noop} />,
};
export const StudentDetail: Story = {
  render: () => <StudentDetailScreen data={studentDetail("c-bio9a", "s-dev")!} loading={false} error={null} onBack={noop} onRetry={noop} formatDate={(d) => d.slice(0, 10)} />,
};
export const Courses: Story = {
  render: () => <CoursesScreen courses={teacherState().courses.map(courseSummary)} loading={false} error={null} onRetry={noop} />,
};
export const CoursesEmpty: Story = {
  render: () => <CoursesScreen courses={[]} loading={false} error={null} onRetry={noop} />,
};
export const CourseDetail: Story = {
  render: () => <CourseDetailScreen course={courseOut(courseById("course-tissues")!)} loading={false} error={null} classes={classes} publishingId={null} assigning={false} renaming={false} onPublish={noop} onAssign={noop} onRename={noop} onRetry={noop} />,
};
export const LessonReview: Story = {
  render: () => (
    <LessonReviewScreen
      courseId="course-tissues"
      title={review.title as never}
      items={items}
      optionLabels={(i) => optionLabels(i, review.terms as never)}
      published={false}
      block={publishBlock(review)}
      loading={false}
      error={null}
      busyId={null}
      publishing={false}
      onSave={async () => true}
      onApprove={noop}
      onReject={noop}
      onRegenerate={noop}
      onPublish={noop}
      onRetry={noop}
    />
  ),
};
const uploadProps = { classes, typed: "", pollError: null, onTyped: noop, onAddTyped: noop, onFiles: noop, onRemove: noop, onMeta: noop, onSubmit: noop, onRetryPage: noop, onRetryStart: noop, onReset: noop, meta: { subject: "BI" as const, grade: 9, classroomId: "c-bio9a" } };
export const UploadPick: Story = {
  render: () => (
    <UploadScreen
      {...uploadProps}
      pages={[
        { key: "a", kind: "photo", name: "page1.jpg", size: 2_400_000 },
        { key: "b", kind: "pdf", name: "chapter.pdf", size: 14_000_000 },
      ]}
      run={initialRun}
    />
  ),
};
export const UploadProgress: Story = {
  render: () => <UploadScreen {...uploadProps} pages={[]} run={{ ...initialRun, phase: "uploading", uploadId: "u1", pages: [{ state: "done", progress: 1 }, { state: "uploading", progress: 0.4 }, { state: "error", progress: 0 }] }} />,
};
export const UploadSteps: Story = {
  render: () => <UploadScreen {...uploadProps} pages={[]} run={{ ...initialRun, phase: "processing", uploadId: "u1", steps: ["queued", "reading", "chunking"] }} />,
};
