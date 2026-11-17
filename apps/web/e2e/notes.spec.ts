import { expect, test } from "@playwright/test";
import { chooseLanguageAndRole } from "./helpers";

test("teacher uploads notes with a file, and a student in that class opens them", async ({ page }) => {
  await chooseLanguageAndRole(page, /हिन्दी/, /Teacher/);
  await page.waitForURL("**/teacher");
  await page.goto("/teacher/notes");
  await page.getByLabel(/Title/).fill("Photosynthesis summary");
  await page.getByLabel(/Notes \(type here\)/).fill("Plants make food from sunlight, water and carbon dioxide.");
  await page.getByTestId("note-file").setInputFiles({ name: "chapter-notes.txt", mimeType: "text/plain", buffer: Buffer.from("Chlorophyll is green.") });
  await page.getByTestId("share-note").click();
  await expect(page.getByTestId("notes-list").getByText("Photosynthesis summary")).toBeVisible();

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: /Sign out/ }).click();
  await page.waitForURL("**/role");
  await page.getByRole("button", { name: /Student/ }).click();
  await page.waitForURL("**/farm");
  await page.goto("/farm/notes");
  const card = page.getByTestId("note-card").filter({ hasText: "Photosynthesis summary" });
  await expect(card).toBeVisible();
  await expect(card.getByText("chapter-notes.txt")).toBeVisible();
  await page.screenshot({ path: "test-results/notes-student.png", fullPage: true });
});
