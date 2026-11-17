import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { Schemas } from "@mooshala/api-client";
import { buildPath } from "@/mocks/learning/handlers";
import { termContent, TERMS } from "@/mocks/learning/course-data";
import { AskScreen } from "./AskScreen";
import { BendingPlant, FarmChest, HarvestBasket, SproutBloom } from "./feedback/FarmFeedback";
import { PathScreen } from "./PathScreen";
import { ProfileScreen } from "./ProfileScreen";
import { FillFormulaQuestion, MatchPairsQuestion, MultipleChoiceQuestion, TrueFalseQuestion } from "./questions";
import { TermsScreen } from "./TermsScreen";

const meta: Meta = { title: "Student/Learning" };
export default meta;
type Story = StoryObj;

const tri = (en: string, hi: string, kn: string) => ({ en, hi, kn });
const terms = Object.fromEntries(Object.keys(TERMS).map((k) => [k, termContent(k)]));
const base = { prompt: tri("Which part controls the cell?", "कौन सा भाग कोशिका को नियंत्रित करता है?", "ಯಾವ ಭಾಗ ಜೀವಕೋಶವನ್ನು ನಿಯಂತ್ರಿಸುತ್ತದೆ?"), explanation: tri("e", "e", "e") };
const noop = () => {};
const stats: Schemas["StatsOut"] = { xp_total: 120, xp_today: 10, daily_goal: 50, hearts: 4, max_hearts: 5, refill_at: "2026-11-17T12:00:00Z", streak: 3, longest_streak: 5 };

export const FarmFeedback: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 16, alignItems: "end" }}>
      <SproutBloom />
      <BendingPlant />
      <HarvestBasket items={7} />
      <FarmChest open />
    </div>
  ),
};
export const MultipleChoice: Story = {
  render: () => <MultipleChoiceQuestion id="q1" terms={terms} result={null} busy={false} onAnswer={noop} content={{ type: "multiple_choice", ...base, options: [{ term_key: "mitochondria" }, { term_key: "nucleus" }, { term_key: "ribosome" }] }} />,
};
export const MultipleChoiceGraded: Story = {
  render: () => <MultipleChoiceQuestion id="q1" terms={terms} result={{ correct: false, correctAnswer: { index: 1 }, explanation: {}, xpDelta: 0, heartLost: true }} busy={false} onAnswer={noop} content={{ type: "multiple_choice", ...base, options: [{ term_key: "mitochondria" }, { term_key: "nucleus" }, { term_key: "ribosome" }] }} />,
};
export const TrueFalse: Story = {
  render: () => <TrueFalseQuestion id="q2" terms={terms} result={null} busy={false} onAnswer={noop} content={{ type: "true_false", ...base, statement: tri("A vacuole stores water.", "रिक्तिका पानी जमा करती है।", "ರಸದಾನಿ ನೀರು ಸಂಗ್ರಹಿಸುತ್ತದೆ.") }} />,
};
export const FillFormula: Story = {
  render: () => <FillFormulaQuestion id="q3" terms={terms} result={null} busy={false} onAnswer={noop} content={{ type: "fill_formula", ...base, formula: "CO₂ + H₂O → __ + O₂", chips: ["Glucose", "Salt", "Iron"] }} />,
};
export const MatchPairs: Story = {
  render: () => (
    <MatchPairsQuestion id="q4" terms={terms} result={null} busy={false} onAnswer={noop} content={{ type: "match_pairs", ...base, pairs: [{ left: { term_key: "nucleus" }, right: { text: tri("Controls the cell", "कोशिका चलाता है", "ಜೀವಕೋಶ ನಡೆಸುತ್ತದೆ") } }, { left: { term_key: "ribosome" }, right: { text: tri("Makes proteins", "प्रोटीन बनाता है", "ಪ್ರೋಟೀನ್ ಮಾಡುತ್ತದೆ") } }] }} />
  ),
};
export const Path: Story = {
  render: () => (
    <PathScreen
      home={{ data: { name: "Asha", language_mode: "hindi", stats, continue_lesson: null, classes: [], courses: [{ id: "course-cell", title: tri("The Cell", "कोशिका", "ಜೀವಕೋಶ"), subject: "BI", is_personal: false, ai_made: false, percent_complete: 17, lesson_count: 6 }] }, error: null, isLoading: false }}
      path={{ data: buildPath("u-asha"), error: null, isLoading: false }}
      onRetry={noop}
    />
  ),
};
export const Terms: Story = {
  render: () => (
    <TermsScreen terms={Object.keys(TERMS).map((k) => ({ key: k, content: termContent(k), source_page: 2, saved: k === "nucleus", mastery: 0.6 }))} loading={false} error={null} query="" savedOnly={false} openKey="nucleus" onQuery={noop} onSavedOnly={noop} onOpen={noop} onToggleSave={noop} onAsk={noop} onSpeak={noop} onRetry={noop} noCourse={false} />
  ),
};
export const AskGolu: Story = {
  render: () => (
    <AskScreen
      messages={[
        { id: "1", from: "me", text: "What does the nucleus do?" },
        { id: "2", from: "golu", answer: { regional: "केंद्रक कोशिका को नियंत्रित करता है।", english: "The nucleus controls the cell." }, inNotes: true, pages: [2], question: "What does the nucleus do?" },
      ]}
      draft=""
      sending={false}
      left={19}
      about={null}
      noCourse={false}
      onDraft={noop}
      onSend={noop}
    />
  ),
};
export const Profile: Story = {
  render: () => <ProfileScreen name="Asha" stats={stats} statsError={null} game={undefined} savingGoal={null} onGoal={noop} onRetry={noop} formatTime={() => "5:30 PM"} />,
};
