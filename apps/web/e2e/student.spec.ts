import { expect, test } from "@playwright/test";
import { chooseLanguageAndRole, expectFarmRendered, openPlace, playLesson } from "./helpers";

test("student core: farm → lesson → feedback → rewards → terms → doubt", async ({ page }, info) => {
  await chooseLanguageAndRole(page, /हिन्दी/, /Student/);
  await page.waitForURL("**/farm");
  await expectFarmRendered(page);
  await expect(page.getByRole("img", { name: "3 day streak" })).toBeVisible();
  await expect(page.getByRole("img", { name: "140 gems" })).toBeVisible();

  // The barn offers the current lesson.
  await openPlace(page, /Learning barn/);
  await expect(page.getByText("Lesson 2 of 6")).toBeVisible();
  await page.getByTestId("start-lesson").click();
  await page.waitForURL("**/farm/lesson/lesson-2");

  // A "not quite" answer first: the plant bends, a heart goes, the explanation shows.
  await page.getByRole("radiogroup").getByRole("button", { name: /Mitochondria/ }).click();
  await page.getByTestId("check-answer").click();
  const sheet = page.getByTestId("feedback-sheet");
  await expect(sheet).toHaveAttribute("data-correct", "false");
  await expect(sheet.getByText("Not quite")).toBeVisible();
  await expect(sheet.getByTestId("bending-plant")).toBeVisible();
  await page.screenshot({ path: info.outputPath("not-quite.png") });
  await page.getByTestId("feedback-continue").click();

  // Interrupt: reload mid-lesson and resume at the same question.
  await expect(page.getByText("Match each part to its job.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Match each part to its job.")).toBeVisible({ timeout: 30_000 });

  await playLesson(page);
  await expect(page.getByTestId("harvest-basket")).toBeVisible();
  await expect(page.getByText("Your streak grew today!")).toBeVisible();
  await page.screenshot({ path: info.outputPath("lesson-done.png") });
  await page.getByTestId("lesson-finish").click();
  await page.waitForURL("**/farm");
  await expect(page.getByRole("img", { name: "4 day streak" })).toBeVisible();

  // Terms in the farmhouse.
  await openPlace(page, /Farmhouse study/);
  await page.getByTestId("open-terms").click();
  await page.getByLabel(/Search words/).fill("ribo");
  await page.getByRole("button", { name: /Ribosome/ }).click();
  await expect(page.getByText("Makes proteins.")).toBeVisible();
  await page.getByTestId("toggle-save").click();
  await expect(page.getByTestId("toggle-save")).toHaveAttribute("aria-pressed", "true");

  // A doubt for Golu.
  await page.goto("/farm/ask");
  await page.getByLabel(/Your doubt/).fill("What does the nucleus do?");
  await page.getByTestId("send-doubt").click();
  await expect(page.getByTestId("golu-answer")).toContainText("Controls the cell and holds its DNA.");
  await expect(page.getByText("From your notes, page 2")).toBeVisible();
});
