import { test, expect } from "@playwright/test";
import en from "../../messages/en.json" with { type: "json" };
import hans from "../../messages/zh-Hans.json" with { type: "json" };
import hant from "../../messages/zh-Hant.json" with { type: "json" };
const route = "**/api/admin/tournaments/synthetic/rounds/*/referee-policy";
test("edits S11 defaults in round management before any fixture exists", async ({
  page,
}) => {
  const writes: Record<string, unknown>[] = [];
  await page.route(route, async (request) => {
    const body = request.request().postDataJSON();
    writes.push(body);
    await request.fulfill({ json: { revision: 1, policy: body.policy } });
  });
  await page.goto("/round-referee-policy");
  await page
    .getByText("Configure round referee policy", { exact: true })
    .click();
  await expect(
    page.getByLabel("Ban timer seconds", { exact: true }),
  ).toHaveValue("60");
  await expect(
    page.getByLabel("Pick timer seconds", { exact: true }),
  ).toHaveValue("90");
  await expect(
    page.getByLabel("Preparation timer seconds", { exact: true }),
  ).toHaveValue("120");
  await expect(
    page.getByLabel("Require No Fail for every map", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Maximum replays per map", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByLabel("Start countdown seconds", { exact: true }),
  ).toHaveValue("");
  const save = page.getByRole("button", {
    name: "Save round referee policy",
    exact: true,
  });
  await save.click();
  expect(writes).toHaveLength(0);
  await page
    .getByLabel("Room size (separate from players per team)", { exact: true })
    .fill("16");
  await save.click();
  await expect(page.getByRole("status")).toHaveText(
    "Round referee policy saved.",
  );
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    expectedRevision: 0,
    policy: {
      commands: {
        roomSize: 16,
        noFail: true,
        banSeconds: 60,
        pickSeconds: 90,
        prepareSeconds: 120,
        startSeconds: null,
      },
    },
  });
  const policy = writes[0].policy as {
    steps: { kind: string; tiedAt: number | null }[];
    maxReplaysPerMap?: number;
  };
  expect(policy.steps.map((step) => step.kind).slice(0, 6)).toEqual([
    "ban",
    "ban",
    "pick",
    "pick",
    "ban",
    "ban",
  ]);
  expect(policy.steps).toHaveLength(15);
  expect(policy.steps.at(-1)?.tiedAt).toBe(5);
  expect(policy).not.toHaveProperty("maxReplaysPerMap");
});
test("preserves saved settings and keeps the draft on a revision conflict", async ({
  page,
}) => {
  await page.route(route, (request) =>
    request.fulfill({
      status: 409,
      json: {
        error: "The round referee policy changed. Refresh before saving.",
      },
    }),
  );
  await page.goto("/round-referee-policy?saved");
  await page
    .getByText("Configure round referee policy", { exact: true })
    .click();
  await expect(
    page.getByLabel("Ban timer seconds", { exact: true }),
  ).toHaveValue("35");
  await expect(
    page.getByLabel("Require No Fail for every map", { exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByLabel("Maximum replays per map", { exact: true }),
  ).toHaveValue("3");
  await page.getByLabel("Ban timer seconds", { exact: true }).fill("61");
  await page
    .getByRole("button", { name: "Save round referee policy", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText(
    "The round referee policy changed. Refresh before saving.",
  );
  await expect(
    page.getByLabel("Ban timer seconds", { exact: true }),
  ).toHaveValue("61");
});
test("offers BO13 defaults and disables mutations in read-only mode", async ({
  page,
}) => {
  await page.goto("/round-referee-policy?bo13&readonly");
  await page
    .getByText("Configure round referee policy", { exact: true })
    .click();
  await expect(
    page.getByLabel("Both teams must have this score before TB", {
      exact: true,
    }),
  ).toHaveValue("6");
  await expect(
    page.getByRole("button", {
      name: "Save round referee policy",
      exact: true,
    }),
  ).toBeDisabled();
});

for (const [locale, catalog] of [
  ["en", en],
  ["zh-Hans", hans],
  ["zh-Hant", hant],
] as const) {
  test(`keeps ${locale} rules readable in both themes`, async ({
    page,
    isMobile,
  }, testInfo) => {
    if (isMobile) await page.setViewportSize({ width: 320, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const key = Object.entries(en.ui).find(
      ([, value]) => value === "Configure round referee policy",
    )![0] as keyof typeof en.ui;
    for (const theme of ["light", "dark"]) {
      await page.goto(`/round-referee-policy?locale=${locale}&theme=${theme}`);
      await page.getByText(catalog.ui[key], { exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await expect(page.getByRole("button").last()).toBeVisible();
      if (theme === "dark")
        await page.screenshot({
          path: testInfo.outputPath(`${locale}-${theme}.png`),
        });
    }
    expect(errors).toEqual([]);
  });
}
