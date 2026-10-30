import { test, expect } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
});

for (const theme of ["light", "dark"]) {
  test(`the player id badge copies the id (${theme})`, async ({ page }) => {
    await page.goto("/player-id-badge");
    await page
      .locator("html")
      .evaluate((el, value) => el.setAttribute("data-theme", value), theme);
    const badge = page.locator(".profile-id-badge");
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/#7003013/);
    await expect(badge).toHaveClass(/profile-id-badge--tier/);

    const appearance = await badge.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        backgroundImage: style.backgroundImage,
        animation: style.animationName,
        colour: style.color,
      };
    });
    expect(appearance.backgroundImage).toContain("linear-gradient");
    expect(appearance.animation).toBe("bws-rank-tier-roll");
    // The gold tier is bright, so the readable foreground is black.
    expect(appearance.colour).toBe("rgb(0, 0, 0)");

    await badge.click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe("7003013");
    await expect(badge).toHaveClass(/profile-id-badge--copied/);
    await expect(page.locator('[role="status"]')).toHaveText(
      "Player ID copied.",
    );
    // The copied state resets on its own.
    await expect(badge).not.toHaveClass(/profile-id-badge--copied/, {
      timeout: 4000,
    });
  });
}

test("the badge stays a compact pill, not a themed button", async ({
  page,
}) => {
  await page.goto("/player-id-badge");
  const badge = page.locator(".profile-id-badge");
  const box = (await badge.boundingBox())!;
  expect(box.height).toBeLessThan(32);
  const style = await badge.evaluate((el) => {
    const used = getComputedStyle(el);
    return {
      minHeight: used.minHeight,
      border: used.borderTopWidth,
      radius: used.borderRadius,
      tag: el.tagName,
    };
  });
  expect(style.tag).toBe("BUTTON");
  expect(style.minHeight).toBe("0px");
  expect(style.border).toBe("0px");
  expect(style.radius).toBe("999px");
});
