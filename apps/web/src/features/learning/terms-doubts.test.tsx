import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { Schemas } from "@mooshala/api-client";
import { DEMO } from "@/mocks/fake-db";
import { learner } from "@/mocks/learning/state";
import { termContent, TERMS } from "@/mocks/learning/course-data";
import { nav } from "@/test/navigation";
import { makeTestServices, renderWithProviders, resetAuthStore, signInAs } from "@/test/render";
import { AskRoute } from "./AskRoute";
import { ProfileRoute } from "./ProfileRoute";
import { filterTerms } from "./TermsScreen";
import { TermsRoute } from "./TermsRoute";

beforeEach(resetAuthStore);
async function asAsha() {
  const services = makeTestServices();
  await signInAs(services, DEMO.studentPhone);
  return services;
}

describe("terms", () => {
  const all: Schemas["TermOut"][] = Object.keys(TERMS).map((k) => ({ key: k, content: termContent(k), source_page: 1, saved: k === "nucleus", mastery: null }));
  it("searches in English, Hindi and Kannada, and filters saved words", () => {
    expect(filterTerms(all, "nucl", false).map((t) => t.key)).toEqual(["nucleus"]);
    expect(filterTerms(all, "केंद्रक", false).map((t) => t.key)).toEqual(["nucleus"]);
    expect(filterTerms(all, "ಕೋಶ ಭಿತ್ತಿ", false).map((t) => t.key)).toEqual(["cell_wall"]);
    expect(filterTerms(all, "", true).map((t) => t.key)).toEqual(["nucleus"]);
  });

  it("opens a term, shows its meaning and farm analogy, and saves it on the server", async () => {
    const services = await asAsha();
    renderWithProviders(<TermsRoute />, { services });
    fireEvent.click(await screen.findByRole("button", { name: /Mitochondria/ }));
    const detail = screen.getByTestId("term-detail");
    expect(within(detail).getByText("Makes energy from food.")).toBeInTheDocument();
    expect(within(detail).getByText("Like the stove in the kitchen.")).toBeInTheDocument();
    fireEvent.click(within(detail).getByTestId("toggle-save"));
    await waitFor(() => expect(learner("u-asha").savedTerms.has("mitochondria")).toBe(true));
    expect(within(detail).getByTestId("toggle-save")).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the empty state when nothing matches", async () => {
    const services = await asAsha();
    renderWithProviders(<TermsRoute />, { services });
    fireEvent.change(await screen.findByLabelText(/Search words/), { target: { value: "zzz" } });
    expect(screen.getByText("No word matches that search.")).toBeInTheDocument();
  });
});

describe("doubts", () => {
  it("answers from the notes, with the page, and offers simpler and example", async () => {
    const services = await asAsha();
    renderWithProviders(<AskRoute />, { services });
    fireEvent.change(await screen.findByLabelText(/Your doubt/), { target: { value: "What does the nucleus do?" } });
    fireEvent.click(screen.getByTestId("send-doubt"));
    const answer = await screen.findByTestId("golu-answer");
    expect(within(answer).getByText(/Controls the cell and holds its DNA/)).toBeInTheDocument();
    expect(within(answer).getByText("From your notes, page 2")).toBeInTheDocument();
    expect(screen.getByText("19 doubts left today", { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Give an example/ }));
    await waitFor(() => expect(screen.getAllByTestId("golu-answer")).toHaveLength(2));
  });

  it("keeps the question when Golu is unavailable, and explains the daily limit", async () => {
    const services = await asAsha();
    renderWithProviders(<AskRoute />, { services });
    const box = await screen.findByLabelText(/Your doubt/);
    fireEvent.change(box, { target: { value: "please fail now" } });
    fireEvent.click(screen.getByTestId("send-doubt"));
    expect(await screen.findByText(/can't answer right now/)).toBeInTheDocument();
    expect(box).toHaveValue("please fail now");

    learner("u-asha").doubts = Array(20).fill(Date.now());
    fireEvent.change(box, { target: { value: "nucleus?" } });
    fireEvent.click(screen.getByTestId("send-doubt"));
    expect(await screen.findByText(/all the doubts for today/)).toBeInTheDocument();
    expect(screen.getByTestId("send-doubt")).toBeDisabled();
  });

  it("knows which question the doubt is about", async () => {
    nav.search = new URLSearchParams("course=course-cell&question=q-2-1");
    const services = await asAsha();
    renderWithProviders(<AskRoute />, { services });
    expect(await screen.findByText("About the question you just answered")).toBeInTheDocument();
  });
});

describe("profile", () => {
  it("shows server stats and changes the daily goal", async () => {
    const services = await asAsha();
    renderWithProviders(<ProfileRoute />, { services });
    expect(await screen.findByText("120")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /100 XP/ }));
    await waitFor(() => expect(screen.getByRole("radio", { name: /100 XP/ })).toHaveAttribute("aria-checked", "true"));
    expect(learner("u-asha").dailyGoal).toBe(100);
  });
});
