import type { CallEngine } from "./engine";

/*
 * Simulated keypad input: maps a key (on-screen button or physical keyboard) to an engine control.
 * A real telephony webhook would map DTMF digits through this same function, so the lesson engine
 * never knows where a key came from.
 *
 * During a question: 1-5 choose, 6 repeat, 7 read my choice, 8 clear, 9 confirm, 0 key help.
 * While typing the ID or PIN: digits type, # submits, * deletes.
 */
export const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"] as const;
export type Key = (typeof KEYS)[number];

export function pressKey(engine: CallEngine, key: Key): void {
  const { phase } = engine.state;
  if (!engine.live || phase === "connecting") return;
  if (phase === "enter_id" || phase === "enter_pin") {
    if (key === "#") void engine.submitEntry();
    else if (key === "*") engine.backspace();
    else engine.digit(key);
    return;
  }
  if (phase === "authenticating" || phase === "loading" || phase === "submitting") return; // wait for the server
  engine.echo(key);
  const n = Number(key);
  switch (phase) {
    case "menu":
      if (key === "1") void engine.continueLesson();
      else if (key === "2") engine.chooseCourseMenu();
      else engine.help();
      return;
    case "choose_course":
    case "choose_lesson":
      if (n >= 1 && n <= 5) void engine.choose(n);
      else engine.help();
      return;
    case "answering":
      if (n >= 1 && n <= 5) engine.selectOption(n);
      else if (key === "6") engine.repeatQuestion();
      else if (key === "7") engine.readSelection();
      else if (key === "8") engine.clearSelection();
      else if (key === "9") void engine.confirm();
      else engine.help();
      return;
    case "feedback":
      if (key === "9" || key === "#") void engine.advance();
      else if (key === "6") engine.repeatQuestion();
      else engine.help();
      return;
    case "completed":
      if (key === "1") engine.chooseCourseMenu();
      else if (key === "#") engine.hangUp();
      else engine.help();
      return;
  }
}

/** Physical keyboard: digits, * and # as on a phone; Enter is #, Backspace is *. */
export function keyFromKeyboard(e: Pick<KeyboardEvent, "key">): Key | null {
  if (e.key === "Enter") return "#";
  if (e.key === "Backspace") return "*";
  return (KEYS as readonly string[]).includes(e.key) ? (e.key as Key) : null;
}
