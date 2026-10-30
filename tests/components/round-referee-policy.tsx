import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { RoundManager } from "../../src/components/round-manager";
import { StaffReadOnlyContext } from "../../src/components/staff-read-only";
import { s11RefereeDefaults } from "../../src/lib/referee-defaults";
import en from "../../messages/en.json";
import hans from "../../messages/zh-Hans.json";
import hant from "../../messages/zh-Hant.json";
import "../../src/app/globals.css";
import "../../src/app/workspace.css";
const params = new URLSearchParams(location.search);
const wins = params.has("bo13") ? 7 : 6;
const defaults = s11RefereeDefaults("11", { type: "first_to", wins })!;
const roundId = "00000000-0000-4000-8000-000000000001";
const savedPolicy = {
  ...defaults.policy,
  banCategoryRules: undefined,
  commands: {
    ...defaults.commands,
    roomSize: 8,
    noFail: false,
    banSeconds: 35,
    pickSeconds: 45,
    prepareSeconds: 55,
    startSeconds: 5,
  },
  maxReplaysPerMap: 3,
};
const router = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
  bfcacheId: "synthetic",
} as AppRouterInstance;
type RefereeData = NonNullable<
  Parameters<typeof RoundManager>[0]["refereeData"]
>;
const poolId = "00000000-0000-4000-8000-000000000002";
const entries = ["NM", "HD", "HR", "FM", "TB"].flatMap((category, index) =>
  [1, 2].map((position) => ({
    id: `00000000-0000-4000-8000-${String(100 + index * 2 + position).padStart(12, "0")}`,
    poolId,
    category,
    position,
    beatmapId: 1000 + index * 2 + position,
  })),
) as RefereeData["entries"];
const locale = params.get("locale") ?? "en";
document.documentElement.dataset.theme = params.get("theme") ?? "light";
document.documentElement.dataset.appearance = "default";
createRoot(document.getElementById("root")!).render(
  <AppRouterContext.Provider value={router}>
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "zh-Hant" ? hant : locale === "zh-Hans" ? hans : en}
      timeZone="UTC"
    >
      <StaffReadOnlyContext value={params.has("readonly")}>
        <main className="container themed-site private-site">
          <RoundManager
            slug="synthetic"
            initialStage="group"
            initialRoundId={roundId}
            season="11"
            canManageRefereePolicy
            rounds={[
              {
                id: roundId,
                name: "Synthetic S11 round",
                stage: "group",
                position: 1,
                version: 0,
              },
            ]}
            refereeData={{
              pools: [{ id: poolId, roundId }] as RefereeData["pools"],
              entries,
              refereeRules: [
                {
                  roundId,
                  revision: params.has("saved") ? 4 : 0,
                  policy: params.has("saved") ? savedPolicy : null,
                  series: { type: "first_to", wins },
                },
              ],
            }}
          />
        </main>
      </StaffReadOnlyContext>
    </NextIntlClientProvider>
  </AppRouterContext.Provider>,
);
