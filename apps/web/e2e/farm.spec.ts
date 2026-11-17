import { expect, test } from "@playwright/test";
import { chooseLanguageAndRole, expectFarmRendered } from "./helpers";

test("3D farm: renders, takes pointer input, and offers keyboard access to places", async ({ page }, info) => {
  await chooseLanguageAndRole(page, /हिन्दी/, /Student/);
  await page.waitForURL("**/farm");
  await expectFarmRendered(page);

  // Drag to orbit the camera: the picture must change.
  const canvas = page.locator("canvas");
  const before = await canvas.screenshot();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  expect(Buffer.compare(before, await canvas.screenshot())).not.toBe(0);

  // Keyboard users reach the same places through the hidden list.
  await page.getByRole("button", { name: /खलिहान · Learning barn/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Learning barn" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("farm.png") });

  // Student nav: the quest board and the fair are open from Phase 4.
  await expect(page.getByRole("link", { name: /Quests/ }).first()).toHaveAttribute("href", "/farm/quests");
});
