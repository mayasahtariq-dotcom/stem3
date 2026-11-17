import { expect, test } from "@playwright/test";
import { chooseLanguageAndRole } from "./helpers";

test("one platform: teacher creates a class, student joins with its code, teacher sees the student", async ({ page }) => {
  await chooseLanguageAndRole(page, /हिन्दी/, /Teacher/);
  await page.waitForURL("**/teacher");
  await expect(page.getByTestId("role-badge")).toHaveAttribute("data-role", "teacher");
  await expect(page.getByTestId("all-classes")).toBeVisible();

  await page.goto("/teacher/classes");
  await page.getByTestId("new-class").click();
  await page.getByLabel(/Class name/).fill("Class 8-B Science");
  await page.getByTestId("create-class").click();
  const code = (await page.getByRole("dialog").getByTestId("class-join-code").textContent())!.trim();
  expect(code).toMatch(/^BI09-[A-Z2-9]{4}$/);

  await page.goto("/teacher/courses");
  await expect(page.getByTestId("materials")).toBeVisible();

  // Student joins from the profile with that code.
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: /Sign out/ }).click();
  await page.waitForURL("**/role");
  await page.getByRole("button", { name: /Student/ }).click();
  await page.waitForURL("**/farm");
  await expect(page.getByTestId("role-badge")).toHaveAttribute("data-role", "student");
  await page.goto("/farm/profile");
  await page.getByTestId("join-class-link").click();
  await page.waitForURL("**/join");
  await page.getByLabel(/Class key/).fill(code);
  await page.getByRole("button", { name: /Find class/ }).click();
  await expect(page.getByTestId("class-preview")).toContainText("Class 8-B Science");
  await page.getByRole("button", { name: /Join this class/ }).click();
  await page.waitForURL("**/farm");

  // The teacher now sees Asha in the new class.
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: /Sign out/ }).click();
  await page.waitForURL("**/role");
  await page.getByRole("button", { name: /Teacher/ }).click();
  await page.waitForURL("**/teacher");
  await page.goto("/teacher/classes");
  await page.getByRole("listitem").filter({ hasText: "Class 8-B Science" }).getByRole("link").click();
  await expect(page.getByTestId("class-roster")).toContainText("Asha");
});
