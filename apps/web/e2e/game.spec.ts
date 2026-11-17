import { expect, test } from "@playwright/test";
import { chooseLanguageAndRole, expectFarmRendered, openPlace } from "./helpers";

test("game: open a Golu Pot, claim a quest once, village fair, badges and Golu's growth", async ({ page }) => {
  await chooseLanguageAndRole(page, /हिन्दी/, /Student/);
  await page.waitForURL("**/farm");
  await expectFarmRendered(page);

  await openPlace(page, /Golu Pot/);
  await page.getByTestId("open-pot").click();
  await expect(page.getByTestId("pot-reward")).toBeVisible();
  await expect(page.getByTestId("open-pot")).toHaveCount(0);

  await page.goto("/farm/quests");
  const quest = page.getByTestId("quest-daily-earn_xp");
  await quest.getByTestId("claim-quest").click();
  await expect(quest).toHaveAttribute("data-state", "claimed");
  await page.reload();
  await expect(page.getByTestId("quest-daily-earn_xp")).toHaveAttribute("data-state", "claimed");

  await page.goto("/farm/league");
  await expect(page.getByTestId("league-board").getByRole("listitem")).toHaveCount(9);
  await expect(page.getByText(/Gems never change your place/)).toBeVisible();

  await page.goto("/farm/profile");
  await expect(page.getByTestId("mascot-growth")).toContainText("Golu the calf");
  await expect(page.getByTestId("badge-shelf").locator('[data-earned="true"]')).toHaveCount(3);
});
