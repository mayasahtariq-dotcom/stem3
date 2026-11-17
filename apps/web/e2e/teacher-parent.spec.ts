import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { chooseLanguageAndRole, DEMO } from "./helpers";

async function expectNoSeriousAxe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test("teacher: dashboard → review flagged questions → publish → upload notes", async ({ page }) => {
  await chooseLanguageAndRole(page, /हिन्दी/, /Teacher/);
  await page.waitForURL("**/teacher");
  await expect(page.getByText("Active this week")).toBeVisible();
  await expect(page.getByTestId("join-key")).toHaveText(DEMO.key);
  await expectNoSeriousAxe(page);

  await page.getByRole("link", { name: /Students/ }).click();
  await page.waitForURL("**/teacher/students");
  await page.getByRole("button", { name: "Dev" }).click();
  await page.waitForURL("**/teacher/students/s-dev");
  await expect(page.getByText("Often mixed up")).toBeVisible();

  await page.getByRole("link", { name: /Courses/ }).click();
  await page.waitForURL("**/teacher/courses");
  await page.getByRole("link", { name: /Tissues/ }).click();
  await page.getByTestId("lesson-row-tis-l1").getByRole("link", { name: /Review/ }).click();
  await page.waitForURL("**/lessons/tis-l1");
  await expect(page.getByTestId("publish-lesson")).toBeDisabled();
  for (const id of ["tis-q1-2", "tis-q1-4"]) {
    await page.getByTestId(`question-${id}`).getByTestId("approve-question").click();
    await expect(page.getByTestId(`question-${id}`).getByTestId("approve-question")).toHaveCount(0);
  }
  await page.getByTestId("publish-lesson").click();
  await expect(page.getByText("This lesson is live for your students.")).toBeVisible();

  await page.goto("/teacher/courses/new");
  await page.getByTestId("typed-notes").fill("Plant cells have a cell wall and a large vacuole.");
  await page.getByRole("button", { name: /Add as a page/ }).focus();
  await page.keyboard.press("Enter");
  // On the phone viewport the card is still settling after the page is added; use the keyboard like the button above.
  await page.getByTestId("start-upload").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("pipeline-steps")).toBeVisible();
  await expect(page.getByTestId("review-new-course")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("review-new-course").click();
  await expect(page.getByTestId("publish-lesson")).toBeVisible();
});

test("parent: link a child by code → approve consent → weekly summary", async ({ page }) => {
  await chooseLanguageAndRole(page, /ಕನ್ನಡ/, /Parent/);
  await page.waitForURL("**/parent");
  await expect(page.getByText(/No child linked yet/)).toBeVisible();
  await page.getByTestId("link-code").fill("EXP1RD");
  await expect(page.getByText(/That code has expired/)).toBeVisible();
  await page.getByTestId("link-code").fill("k7m4px");
  await expect(page.getByTestId("link-preview")).toContainText("Asha");
  await page.getByTestId("confirm-link").click();
  await page.waitForURL("**/parent/child/u-asha");
  await page.getByTestId("approve-consent").click();
  await expect(page.getByTestId("revoke-consent")).toBeVisible();
  await expect(page.getByText("This week in short")).toBeVisible();
  await expect(page.getByTestId("farm-picture")).toBeVisible();
  await expectNoSeriousAxe(page);
  await page.goto("/parent");
  await expect(page.getByTestId("child-u-asha")).toContainText("Asha");
});
