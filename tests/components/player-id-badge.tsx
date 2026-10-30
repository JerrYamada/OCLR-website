import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { PlayerIdBadge } from "../../src/components/player-id-badge";
import { rankTierPalette } from "../../src/lib/rank-tier";
import en from "../../messages/en.json";
import "../../src/app/globals.css";
import "../../src/app/public-tournament.css";

createRoot(document.getElementById("root")!).render(
  <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
    <main style={{ padding: 24 }}>
      {/* The real layout wraps every page in .themed-site; tokens live there. */}
      <div className="themed-site" data-appearance="default">
        <section className="panel profile-summary">
          <PlayerIdBadge osuId={7003013} palette={rankTierPalette(0.0142)} />
          <div style={{ height: 120 }} />
        </section>
      </div>
    </main>
  </NextIntlClientProvider>,
);
