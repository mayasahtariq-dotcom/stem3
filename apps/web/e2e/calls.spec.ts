import { expect, type Page, test } from "@playwright/test";
import { chooseLanguageAndRole } from "./helpers";

/** Phone emulation lets neighbouring labels steal clicks; press buttons by keyboard. */
async function press(page: Page, testId: string) {
  await page.getByTestId(testId).focus();
  await page.keyboard.press("Enter");
}

test("call mode: add a student without the app, then place a call that connects only when the server says so", async ({ page }) => {
  await chooseLanguageAndRole(page, /हिन्दी/, /Teacher/);
  await page.waitForURL("**/teacher");

  await page.goto("/teacher/calls/new");
  await press(page, "cs-next");
  await expect(page.getByText("Please write the student's name.")).toBeVisible();
  await page.getByTestId("cs-name").fill("Kiran");
  await page.getByTestId("cs-phone").fill("9845011111");
  await press(page, "cs-next");
  await press(page, "cs-confirm-save");
  await expect(page.getByText("A student with this phone number is already in this class.")).toBeVisible();
  await page.getByTestId("cs-phone").fill("9845055555");
  await press(page, "cs-next");
  await expect(page.getByTestId("cs-confirm")).toContainText("+919845055555");
  await press(page, "cs-confirm-save");
  await page.waitForURL("**/teacher/calls");
  await expect(page.getByTestId("call-student-cs-1")).toContainText("Kiran");
  await expect(page.getByTestId("call-student-cs-1")).toContainText("सहमति का इंतज़ार");

  // Move the demo clock into the calling window, then call Lakshmi.
  const moved = page.waitForResponse((r) => r.url().includes("/__demo/clock"));
  await press(page, "demo-evening");
  await moved;
  await press(page, "call-student-cs-lakshmi");
  await expect(page.getByTestId("call-now")).toBeEnabled();
  const started = page.waitForResponse((r) => r.url().includes("/call-now"));
  await press(page, "call-now");
  expect((await started).status()).toBe(202);
  const panel = page.getByTestId("call-panel");
  await expect(panel).toHaveAttribute("data-state", /dialing|ringing/);
  await expect(page.getByTestId("call-now")).toBeDisabled();
  await expect(panel).toHaveAttribute("data-state", "connected", { timeout: 15_000 });
  await expect(panel).toHaveAttribute("data-state", "completed", { timeout: 25_000 });
  await expect(page.getByTestId("call-student-cs-lakshmi")).toContainText("6 of 15 minutes this week");
});
