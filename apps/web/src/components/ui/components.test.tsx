import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnswerOption } from "./AnswerOption";
import { BilingualText } from "./BilingualText";
import { ChunkyButton } from "./ChunkyButton";
import { GemCounter, HeartMeter, XPRing } from "./GameStats";
import { GoluMascot } from "./GoluMascot";
import { ProgressBar } from "./ProgressBar";
import { STICKER_ICON_NAMES, StickerIcon } from "./StickerIcon";
import { TextField } from "./TextField";
import { renderWithProviders } from "@/test/render";
import { EmptyState, ErrorState, LoadingState } from "./ScreenStates";
import { ApiError } from "@/lib/api/errors";

const text = { regional: "उत्तर", english: "Answer" };

describe("BilingualText", () => {
  it("puts the bold regional line above the muted English line", () => {
    render(<BilingualText text={text} />);
    const [regional, english] = [screen.getByText("उत्तर"), screen.getByText("Answer")];
    expect(regional.compareDocumentPosition(english) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(regional.className).toMatch(/font-bold/);
    expect(english).toHaveAttribute("lang", "en");
  });
  it("shows one line when both are identical", () => {
    render(<BilingualText text={{ regional: "Mooshala", english: "Mooshala" }} />);
    expect(screen.getAllByText("Mooshala")).toHaveLength(1);
  });
});

describe("ChunkyButton", () => {
  it("clicks, and blocks clicks while loading", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<ChunkyButton onClick={onClick}>Go</ChunkyButton>);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<ChunkyButton onClick={onClick} loading>Go</ChunkyButton>);
    expect(screen.getByRole("button", { name: "Go" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("aria-busy", "true");
  });
  it("defaults to type=button so it never submits forms by accident", () => {
    render(<ChunkyButton>Go</ChunkyButton>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});

describe("TextField", () => {
  it("labels the input and wires the error for screen readers", () => {
    render(<TextField label={{ regional: "नाम", english: "Name" }} error={{ regional: "ग़लत", english: "Bad" }} />);
    const input = screen.getByLabelText(/Name/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(screen.getByText("Bad").parentElement!.id);
  });
});

describe("AnswerOption", () => {
  it("announces state in words, not colour alone", () => {
    render(<AnswerOption text={text} index={1} state="incorrect" stateLabel="Not quite" />);
    expect(screen.getByRole("button")).toHaveTextContent("Not quite");
  });
  it("reports selection with aria-pressed", () => {
    render(<AnswerOption text={text} index={2} state="selected" />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });
});

describe("progress and stats", () => {
  it("clamps progress and exposes ARIA values", () => {
    render(<ProgressBar value={1.7} label="Lesson progress" />);
    expect(screen.getByRole("progressbar", { name: "Lesson progress" })).toHaveAttribute("aria-valuenow", "100");
  });
  it("labels stat pills for screen readers", () => {
    render(
      <>
        <GemCounter value={42} label="42 gems" />
        <HeartMeter value={3} label="3 of 5 hearts" />
        <XPRing value={30} goal={50} label="30 of 50 XP today" />
      </>,
    );
    expect(screen.getByRole("img", { name: "42 gems" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "3 of 5 hearts" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "30 of 50 XP today" })).toBeInTheDocument();
  });
});

describe("illustrations", () => {
  it("renders every sticker icon as SVG art (no emoji)", () => {
    for (const name of STICKER_ICON_NAMES) {
      const { container, unmount } = render(<StickerIcon name={name} />);
      expect(container.querySelector("svg")!.innerHTML.length).toBeGreaterThan(20);
      expect(container.textContent).toBe("");
      unmount();
    }
  });
  it("gives each Golu instance unique gradient ids", () => {
    const { container } = render(
      <>
        <GoluMascot pose="wave" />
        <GoluMascot pose="sad" />
      </>,
    );
    const ids = [...container.querySelectorAll("[id]")].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("screen states", () => {
  it("loading, empty and error states always show a message", async () => {
    const retry = vi.fn();
    renderWithProviders(
      <>
        <LoadingState />
        <EmptyState message={{ regional: "खाली", english: "Empty" }} />
        <ErrorState error={new ApiError("NETWORK", 0)} onRetry={retry} />
      </>,
    );
    expect(screen.getByText("Getting things ready…")).toBeInTheDocument();
    expect(screen.getByText("Empty")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("No internet connection");
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(retry).toHaveBeenCalled();
  });
});
