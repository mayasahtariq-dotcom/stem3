import { expect, type Page } from "@playwright/test";

export const DEMO = { student: "9876543210", teacher: "9876500001", parent: "9876500002", key: "BI09-K4X2" };

export async function chooseLanguageAndRole(page: Page, language: RegExp, role: RegExp) {
  await page.goto("/");
  await page.waitForURL("**/language");
  await page.getByRole("button", { name: language }).click();
  await page.waitForURL("**/role");
  await page.getByRole("button", { name: role }).click();
}

/** Picking a mode on /role opens it straight away (demo account), so phone login is tested from /login directly. */
export async function openPhoneLogin(page: Page, language: RegExp, role: "Student" | "Teacher" | "Parent") {
  await page.goto("/");
  await page.waitForURL("**/language");
  await page.getByRole("button", { name: language }).click();
  await page.waitForURL("**/role");
  await page.goto("/login");
  await page.getByTestId("login-role-switch").getByRole("radio", { name: role }).click();
}

export async function loginByOtp(page: Page, phone: string) {
  await page.getByLabel(/Phone number/).fill(phone);
  await page.getByRole("button", { name: /Send code/ }).click();
  await page.getByLabel(/6-digit code/).fill("123456");
  await page.getByRole("button", { name: /Verify/ }).click();
}

/** Waits for the 3D farm and checks the canvas really drew a varied picture. */
export async function expectFarmRendered(page: Page) {
  await expect(page.locator('[data-scene-status="ready"]')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  const shot = await page.locator("canvas").screenshot();
  // A blank or single-colour canvas compresses to almost nothing.
  expect(shot.byteLength).toBeGreaterThan(30_000);
}

/** Opens a farm place or lesson marker through the keyboard list (same as tapping it in 3D). */
export async function openPlace(page: Page, name: RegExp) {
  await page.getByRole("button", { name }).first().focus();
  await page.keyboard.press("Enter");
}

const RIGHT: Record<string, RegExp> = {
  "Which part controls the cell?": /Nucleus/,
  "Which part makes proteins?": /Ribosome/,
  "Which part is found only in plant cells?": /Cell wall/,
  "The cell membrane lets some things in and out.": /True/,
};

/** Plays the open lesson to the end. The first question is answered "not quite" on purpose. */
export async function playLesson(page: Page) {
  for (let i = 0; i < 20; i++) {
    if (await page.getByTestId("lesson-finish").isVisible()) return;
    const cont = page.getByTestId("feedback-continue");
    if (await cont.isVisible()) {
      await cont.click();
      continue;
    }
    if (await page.getByTestId("match-right-0").isVisible()) {
      const lefts = page.getByRole("list", { name: "Parts" }).getByRole("button");
      const n = await lefts.count();
      for (let k = 0; k < n; k++) {
        await lefts.nth(k).click();
        await page.getByTestId(`match-right-${k}`).click();
      }
      await expect(cont.or(page.getByTestId("lesson-finish"))).toBeVisible();
      continue;
    }
    const group = page.getByRole("radiogroup");
    if (await group.isVisible()) {
      const text = await page.locator("main").innerText();
      const key = Object.keys(RIGHT).find((k) => text.includes(k));
      const want = i === 0 ? /Mitochondria/ : key ? RIGHT[key]! : null;
      await (want ? group.getByRole("button", { name: want }) : group.getByRole("button").first()).click();
      await page.getByTestId("check-answer").click();
      await expect(cont.or(page.getByTestId("lesson-finish"))).toBeVisible();
      continue;
    }
    await page.waitForTimeout(300);
  }
}
