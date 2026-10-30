import { test, expect } from "@playwright/test";
for (const theme of ["light", "dark"]) {
  test(`rank chart renders and inspects points (${theme})`, async ({
    page,
  }) => {
    await page.goto("/rank-chart");
    await page
      .locator("html")
      .evaluate((el, value) => el.setAttribute("data-theme", value), theme);
    const chart = page.locator(".rank-chart-svg");
    await expect(chart).toBeVisible();
    const line = page.locator(".rank-chart-line");
    await expect(line).toHaveAttribute("d", /^M[\d.]+ [\d.]+ L/);
    await expect(page.locator(".rank-chart-tip")).toHaveCount(0);
    const box = (await chart.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const tip = page.locator(".rank-chart-tip");
    await expect(tip).toBeVisible();
    await expect(tip).toContainText("#");
    // The tooltip must stay inside the viewport while hovering the edge.
    await page.mouse.move(box.x + 2, box.y + box.height / 2);
    const edge = (await tip.boundingBox())!;
    expect(edge.x).toBeGreaterThanOrEqual(0);
    expect(edge.x + edge.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.mouse.move(0, 0);
    await expect(page.locator(".rank-chart-tip")).toHaveCount(0);
  });
}
test("statistics sit beside the chart and stack on narrow screens", async ({
  page,
}) => {
  await page.goto("/rank-chart");
  const viewport = page.viewportSize()!;
  const body = page.locator(".profile-body");
  const columns = await body.evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  );
  if (viewport.width >= 960) {
    expect(columns.split(" ")).toHaveLength(2);
    const chart = (await page.locator(".rank-chart-card").boundingBox())!;
    const stats = (await page.locator(".profile-statistics").boundingBox())!;
    expect(stats.x).toBeGreaterThan(chart.x + chart.width / 2);
  } else {
    expect(columns.split(" ")).toHaveLength(1);
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
