import { createRoot } from "react-dom/client";
import { useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ForceFixtureDelete } from "../../src/components/force-fixture-delete";
import { StaffReadOnlyContext } from "../../src/components/staff-read-only";
import en from "../../messages/en.json";
import hans from "../../messages/zh-Hans.json";
import hant from "../../messages/zh-Hant.json";
import "../../src/app/globals.css";
import "../../src/app/public-tournament.css";
import "../../src/app/workspace.css";
const params = new URLSearchParams(location.search),
  locale = params.get("locale") ?? "en";
const router = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
  bfcacheId: "synthetic",
} as AppRouterInstance;
document.documentElement.dataset.theme = params.get("theme") ?? "light";
function Harness() {
  const [deleted, setDeleted] = useState(false);
  return (
    <StaffReadOnlyContext value={params.has("readonly")}>
      <main className="container themed-site private-site">
        {deleted ? (
          <p role="status">Deleted synthetic fixture</p>
        ) : (
          <ForceFixtureDelete
            slug="synthetic"
            fixtureId="00000000-0000-4000-8000-000000000001"
            onDeleted={() => setDeleted(true)}
          />
        )}
      </main>
    </StaffReadOnlyContext>
  );
}
createRoot(document.getElementById("root")!).render(
  <AppRouterContext.Provider value={router}>
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "zh-Hant" ? hant : locale === "zh-Hans" ? hans : en}
      timeZone="UTC"
    >
      <Harness />
    </NextIntlClientProvider>
  </AppRouterContext.Provider>,
);
