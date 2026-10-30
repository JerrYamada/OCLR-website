import { test, expect } from "@playwright/test";

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`the player id pill clears the overlaid avatar (${viewport.name})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/player-profile-cover");
    const pill = page.locator(".profile-id-badge");
    await expect(pill).toBeVisible();

    const pillBox = (await pill.boundingBox())!;
    const avatarBox = (await page
      .locator(".profile-cover-content .avatar")
      .boundingBox())!;
    // The pill is pinned to the card corner, so the overlaid heading has to
    // start below it instead of sharing the corner.
    expect(avatarBox.y).toBeGreaterThanOrEqual(pillBox.y + pillBox.height);
  });
}
