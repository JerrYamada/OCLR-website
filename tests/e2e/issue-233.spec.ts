import { closeDb } from "../../src/db";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
test.afterAll(closeDb);
import { test, expect } from "@playwright/test";
test("hero uses the site vector identity with a clear season mark", async ({
  page,
  context,
}, info) => {
  await seedEditions([
    {
      ...edition,
      status: "live",
      branding: {
        ...edition.branding,
        background: "/oclr-s11-website-background.webp",
      },
    },
  ]);
  for (const theme of ["light", "dark"])
    for (const appearance of ["default", "cute-pastel", "swiss-minimal"]) {
      await context.addCookies(
        [
          ["oclr-theme", theme],
          ["oclr-appearance", appearance],
        ].map(([name, value]) => ({
          name,
          value,
          url: "http://127.0.0.1:3100",
        })),
      );
      await page.goto("/");
      const hero = page.locator(".home-feature");
      await expect(
        hero.getByRole("heading", { name: "OCLR S11" }),
      ).toBeVisible();
      await expect(hero.locator(".home-brand-mark")).toHaveAttribute(
        "src",
        "/branding/oclr-wordmark.svg",
      );
      await expect(hero.locator(".home-brand-mark")).toHaveJSProperty(
        "naturalWidth",
        1460,
      );
      const mark = (await hero.locator(".home-brand-mark").boundingBox())!;
      const links = (await hero.locator(".home-entry-links").boundingBox())!;
      expect(mark.y + mark.height).toBeLessThan(links.y);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`hero-${appearance}-${theme}.png`),
      });
    }
});
