import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { DEMO } from "@/mocks/fake-db";
import { learner } from "@/mocks/learning/state";
import { server } from "@/mocks/node";
import { FAKE_API_BASE_URL } from "@/lib/env";
import { makeTestServices, renderWithProviders, resetAuthStore, signInAs } from "@/test/render";
import { LessonRoute } from "./LessonRoute";
import { useLessonSessions } from "./session-store";
import { seededOrder } from "./content";
import { QuestionStage } from "./minigames";
import { FillFormulaQuestion, MatchPairsQuestion, MultipleChoiceQuestion, TrueFalseQuestion } from "./questions";

beforeEach(() => {
  resetAuthStore();
  useLessonSessions.setState({ sessions: {} });
  localStorage.removeItem("aaroh.plainQuestions");
});

async function startLesson2() {
  const services = makeTestServices();
  await signInAs(services, DEMO.studentPhone);
  const r = renderWithProviders(<LessonRoute lessonId="lesson-2" />, { services });
  await screen.findByText("Which part controls the cell?");
  return r;
}
const pick = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const check = () => fireEvent.click(screen.getByTestId("check-answer"));

describe("lesson player", () => {
  it("shows farm feedback for a right answer, with the XP the server gave", async () => {
    await startLesson2();
    pick(/Nucleus/);
    check();
    const sheet = await screen.findByTestId("feedback-sheet");
    expect(sheet).toHaveAttribute("data-correct", "true");
    expect(within(sheet).getByTestId("sprout-bloom")).toBeInTheDocument();
    expect(within(sheet).getByText("+10 XP", { selector: "span:not([aria-hidden])" })).toBeInTheDocument();
    expect(learner("u-asha").xpTotal).toBe(130);
  });

  it("says 'Not quite' (never 'Wrong'), bends the plant, uses a heart and explains", async () => {
    await startLesson2();
    pick(/Mitochondria/);
    check();
    const sheet = await screen.findByTestId("feedback-sheet");
    expect(sheet).toHaveAttribute("data-correct", "false");
    expect(within(sheet).getByTestId("bending-plant")).toBeInTheDocument();
    expect(within(sheet).getByText("Not quite")).toBeInTheDocument();
    expect(within(sheet).getByText("One heart used")).toBeInTheDocument();
    expect(within(sheet).getByText("The nucleus holds DNA and controls the cell.")).toBeInTheDocument();
    expect(within(sheet).getByText(/come back to this one/)).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: /Ask Golu why/ })).toHaveAttribute("href", expect.stringContaining("question=q-2-1"));
    expect(screen.queryByText(/wrong/i)).not.toBeInTheDocument();
    expect(learner("u-asha").hearts).toBe(3);
  });

  it("saves progress and resumes at the same question without restarting the lesson", async () => {
    const r = await startLesson2();
    pick(/Nucleus/);
    check();
    fireEvent.click(await screen.findByTestId("feedback-continue"));
    await screen.findByText("Match each part to its job.");
    r.unmount();
    let restarted = false;
    server.use(http.post(`${FAKE_API_BASE_URL}/lessons/:id/start`, () => ((restarted = true), HttpResponse.json({}, { status: 500 }))));
    renderWithProviders(<LessonRoute lessonId="lesson-2" />, { services: r.services });
    expect(await screen.findByText("Match each part to its job.")).toBeInTheDocument();
    expect(restarted).toBe(false);
  });

  it("keeps the answer when the network drops and sends it again", async () => {
    await startLesson2();
    server.use(http.post(`${FAKE_API_BASE_URL}/attempts`, () => HttpResponse.error(), { once: true }));
    pick(/Nucleus/);
    check();
    fireEvent.click(await screen.findByTestId("resend-answer"));
    expect(await screen.findByTestId("feedback-sheet")).toHaveAttribute("data-correct", "true");
  });

  it("pauses kindly when hearts run out, with the refill time", async () => {
    learner("u-asha").hearts = 0;
    await startLesson2();
    pick(/Mitochondria/);
    check();
    const box = await screen.findByTestId("hearts-empty");
    expect(within(box).getByText(/out of hearts/)).toBeInTheDocument();
    expect(within(box).getByText(/Next heart at/)).toBeInTheDocument();
  });

  it("finishes a lesson: basket, XP, accuracy and streak from POST /complete", async () => {
    localStorage.setItem("aaroh.plainQuestions", "1"); // the walk-through below answers the plain questions
    await startLesson2();
    const answers: Record<string, RegExp> = {
      "Which part controls the cell?": /Nucleus/,
      "The cell membrane lets some things in and out.": /^1/,
      "Which part makes proteins?": /Ribosome/,
      "Which part is found only in plant cells?": /Cell wall/,
    };
    for (let i = 0; i < 12 && !screen.queryByTestId("lesson-finish"); i++) {
      const cont = screen.queryByTestId("feedback-continue");
      if (cont) {
        fireEvent.click(cont);
        continue;
      }
      if (screen.queryByTestId("match-right-0")) {
        const lefts = within(screen.getByRole("list", { name: "Parts" })).getAllByRole("button");
        lefts.forEach((b, k) => {
          fireEvent.click(b);
          fireEvent.click(screen.getByTestId(`match-right-${k}`));
        });
      } else {
        const q = Object.keys(answers).find((k) => screen.queryByText(k));
        const opts = within(screen.getByRole("radiogroup")).getAllByRole("button");
        fireEvent.click(q ? (opts.find((o) => answers[q]!.test(o.textContent ?? "")) ?? opts[0]!) : opts[0]!);
        check();
      }
      await waitFor(() => expect(screen.queryByTestId("feedback-continue") ?? screen.queryByTestId("lesson-finish") ?? screen.queryByTestId("hearts-empty")).toBeTruthy(), { timeout: 3000 });
    }
    expect(await screen.findByTestId("lesson-finish")).toBeInTheDocument();
    expect(screen.getByTestId("harvest-basket")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("Your streak grew today!")).toBeInTheDocument();
    expect(learner("u-asha").streak).toBe(4);
    expect(useLessonSessions.getState().sessions["lesson-2"]).toBeUndefined();
  });

  it("shows the server's reason when a lesson isn't ready", async () => {
    const services = makeTestServices();
    await signInAs(services, DEMO.studentPhone);
    renderWithProviders(<LessonRoute lessonId="lesson-6" />, { services });
    expect(await screen.findByText(/still preparing this lesson/)).toBeInTheDocument();
  });
});

describe("question types", () => {
  const terms = { nucleus: { forms: { en: "Nucleus", hi: "केंद्रक", kn: "ಕೋಶಕೇಂದ್ರ" } }, ribosome: { forms: { en: "Ribosome", hi: "राइबोसोम", kn: "ರೈಬೋಸೋಮ್" } } };
  const tri = (en: string) => ({ en, hi: en, kn: en });
  const base = { prompt: tri("p"), explanation: tri("e") };

  it("multiple choice sends {index} and supports number keys", () => {
    const onAnswer = vi.fn();
    renderWithProviders(<MultipleChoiceQuestion id="q" terms={terms} result={null} busy={false} onAnswer={onAnswer} content={{ type: "multiple_choice", ...base, options: [{ term_key: "nucleus" }, { term_key: "ribosome" }, { text: tri("Sand") }] }} />);
    fireEvent.keyDown(window, { key: "2" });
    check();
    expect(onAnswer).toHaveBeenCalledWith({ type: "multiple_choice", index: 1 });
  });

  it("true/false sends {value}", () => {
    const onAnswer = vi.fn();
    renderWithProviders(<TrueFalseQuestion id="q" terms={{}} result={null} busy={false} onAnswer={onAnswer} content={{ type: "true_false", ...base, statement: tri("Cells are alive") }} />);
    pick(/False/);
    check();
    expect(onAnswer).toHaveBeenCalledWith({ type: "true_false", value: false });
  });

  it("fill the formula puts the chip in the blank and sends {chip}", () => {
    const onAnswer = vi.fn();
    renderWithProviders(<FillFormulaQuestion id="q" terms={{}} result={null} busy={false} onAnswer={onAnswer} content={{ type: "fill_formula", ...base, formula: "F = m × __", chips: ["a", "v"] }} />);
    expect(screen.getByTestId("check-answer")).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "a" }));
    expect(screen.getByTestId("formula-blank")).toHaveTextContent("a");
    check();
    expect(onAnswer).toHaveBeenCalledWith({ type: "fill_formula", chip: "a" });
  });

  it("match pairs counts mistakes (no heart) and sends once all are matched", () => {
    const onAnswer = vi.fn();
    renderWithProviders(
      <MatchPairsQuestion id="q-x" terms={terms} result={null} busy={false} onAnswer={onAnswer} content={{ type: "match_pairs", ...base, pairs: [{ left: { term_key: "nucleus" }, right: { text: tri("Controls") } }, { left: { term_key: "ribosome" }, right: { text: tri("Proteins") } }] }} />,
    );
    const lefts = within(screen.getByRole("list", { name: "Parts" })).getAllByRole("button");
    fireEvent.click(lefts[0]!);
    fireEvent.click(screen.getByTestId("match-right-1"));
    expect(screen.getByText(/don't cost a heart/)).toBeInTheDocument();
    fireEvent.click(lefts[0]!);
    fireEvent.click(screen.getByTestId("match-right-0"));
    fireEvent.click(lefts[1]!);
    fireEvent.click(screen.getByTestId("match-right-1"));
    expect(onAnswer).toHaveBeenCalledWith({ type: "match_pairs", pairs: [[0, 0], [1, 1]], mistakes: 1 });
  });
});

describe("mini-games", () => {
  const terms = { nucleus: { forms: { en: "Nucleus", hi: "केंद्रक", kn: "ಕೋಶಕೇಂದ್ರ" } } };
  const tri = (en: string) => ({ en, hi: en, kn: en });
  const base = { prompt: tri("p"), explanation: tri("e") };
  const props = { terms, result: null, busy: false };

  it("Feed Golu: multiple choice is played as a game and sends the same {index}", () => {
    const onAnswer = vi.fn();
    renderWithProviders(<QuestionStage id="q" {...props} onAnswer={onAnswer} content={{ type: "multiple_choice", ...base, options: [{ term_key: "nucleus" }, { text: tri("Sand") }] }} />);
    expect(screen.getByTestId("game-feed")).toBeInTheDocument();
    expect(screen.getByTestId("check-answer")).toBeDisabled();
    pick(/Sand/);
    check();
    expect(onAnswer).toHaveBeenCalledWith({ type: "multiple_choice", index: 1 });
  });

  it("Barn sort: true/false with arrow keys sends {value}", () => {
    const onAnswer = vi.fn();
    renderWithProviders(<QuestionStage id="q" {...props} onAnswer={onAnswer} content={{ type: "true_false", ...base, statement: tri("Cells are alive") }} />);
    expect(screen.getByTestId("game-sort")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    check();
    expect(onAnswer).toHaveBeenCalledWith({ type: "true_false", value: false });
  });

  it("Memory patch: flipping a part and its match pairs them; a miss flips back and is counted", () => {
    vi.useFakeTimers();
    try {
      const onAnswer = vi.fn();
      const pairs = [{ left: { text: tri("Nucleus") }, right: { text: tri("Controls") } }, { left: { text: tri("Ribosome") }, right: { text: tri("Proteins") } }];
      renderWithProviders(<QuestionStage id="q-m" {...props} onAnswer={onAnswer} content={{ type: "match_pairs", ...base, pairs }} />);
      // the board is shuffled with the same seeded order the game uses: card i holds order[i]
      const order = seededOrder(4, "q-m");
      const at = (pair: number, side: "left" | "right") => screen.getByTestId(`memory-card-${order.indexOf(side === "left" ? pair : pair + 2)}`);
      expect(screen.getAllByText(/^\d$/)).toHaveLength(4); // all face down
      fireEvent.click(at(0, "left"));
      fireEvent.click(at(1, "right")); // a miss: costs no heart, flips back
      expect(screen.getByText(/don't cost a heart/)).toBeInTheDocument();
      act(() => void vi.advanceTimersByTime(1000));
      expect(screen.getAllByText(/^\d$/)).toHaveLength(4);
      fireEvent.click(at(0, "left"));
      fireEvent.click(at(0, "right"));
      fireEvent.click(at(1, "right"));
      fireEvent.click(at(1, "left"));
      expect(onAnswer).toHaveBeenCalledWith({ type: "match_pairs", pairs: [[0, 0], [1, 1]], mistakes: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("Plain view switch shows the ordinary question and is remembered", () => {
    renderWithProviders(<QuestionStage id="q" {...props} onAnswer={vi.fn()} content={{ type: "true_false", ...base, statement: tri("Cells are alive") }} />);
    fireEvent.click(screen.getByTestId("game-toggle"));
    expect(screen.queryByTestId("game-sort")).not.toBeInTheDocument();
    expect(localStorage.getItem("aaroh.plainQuestions")).toBe("1");
  });
});
