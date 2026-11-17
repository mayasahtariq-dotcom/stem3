import { expect, test } from "@playwright/test";
import { DEMO, chooseLanguageAndRole, expectFarmRendered, loginByOtp, openPhoneLogin } from "./helpers";

test("picking Student on the mode screen opens the farm straight away", async ({ page }) => {
  await chooseLanguageAndRole(page, /हिन्दी/, /Student/);
  await page.waitForURL("**/farm");
  await expect(page.getByTestId("role-badge")).toHaveAttribute("data-role", "student");
});

test("student logs in by phone OTP and lands on the 3D farm", async ({ page }) => {
  await openPhoneLogin(page, /हिन्दी/, "Student");
  await page.getByLabel(/Phone number/).fill("12345");
  await page.getByRole("button", { name: /Send code/ }).click();
  await expect(page.getByText("Enter a 10-digit mobile number.")).toBeVisible();
  await loginByOtp(page, DEMO.student);
  await page.waitForURL("**/farm");
  await expect(page.getByText(/Hi Asha! Tap the glowing post/)).toBeVisible();
  await expectFarmRendered(page);
});

test("wrong code says 'Not quite', never 'Wrong'", async ({ page }) => {
  await openPhoneLogin(page, /ಕನ್ನಡ/, "Student");
  await page.getByLabel(/Phone number/).fill(DEMO.student);
  await page.getByRole("button", { name: /Send code/ }).click();
  await page.getByLabel(/6-digit code/).fill("111111");
  await page.getByRole("button", { name: /Verify/ }).click();
  await expect(page.getByText(/Not quite/)).toBeVisible();
  await expect(page.getByText(/Wrong/)).toHaveCount(0);
});

test("student logs in on a school computer with class key and name", async ({ page }) => {
  await openPhoneLogin(page, /हिन्दी/, "Student");
  await page.getByRole("link", { name: /school computer/i }).click();
  await page.waitForURL("**/login/school");
  await page.getByLabel(/Class key/).fill("bi09k4x2");
  await expect(page.getByLabel(/Class key/)).toHaveValue("BI09-K4X2");
  await page.getByLabel(/Your name/).fill("Ravi");
  await page.getByRole("button", { name: /Sign in/ }).click();
  await page.waitForURL("**/farm");
  await expectFarmRendered(page);
});

test("teacher and parent land in their own shells; roles are enforced", async ({ page }) => {
  await chooseLanguageAndRole(page, /हिन्दी/, /Teacher/);
  await page.waitForURL("**/teacher");
  await expect(page.getByRole("navigation", { name: "Teacher sections" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Class" })).toContainText("Class 9-A Science");
  await page.goto("/farm");
  await page.waitForURL("**/teacher");

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: /Sign out/ }).click();
  await page.waitForURL("**/role");
  await page.getByRole("button", { name: /Parent/ }).click();
  await page.waitForURL("**/parent");
  await expect(page.getByText(/No child linked yet/)).toBeVisible();
});

test("a new user names themselves and joins a class", async ({ page }) => {
  await openPhoneLogin(page, /ಕನ್ನಡ/, "Student");
  await loginByOtp(page, "9123456780");
  await page.waitForURL("**/welcome");
  await page.getByLabel(/Your name/).fill("Kiran");
  await page.getByRole("button", { name: /Let's go/ }).click();
  await page.waitForURL("**/join");
  await page.getByLabel(/Class key/).fill("CH10-KNDA");
  await page.getByRole("button", { name: /Find class/ }).click();
  await expect(page.getByTestId("class-preview")).toContainText("Class 10-B Chemistry");
  await page.getByRole("button", { name: /Join this class/ }).click();
  await page.waitForURL("**/farm");
});

test("signed-out visitors to the farm are sent to login", async ({ page }) => {
  await page.goto("/farm");
  await page.waitForURL(/\/login\?next=%2Ffarm/);
});
