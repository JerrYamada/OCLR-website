import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { PlayerIdBadge } from "../../src/components/player-id-badge";
import { rankTierPalette } from "../../src/lib/rank-tier";
import en from "../../messages/en.json";
import styles from "../../src/app/players/[osuId]/profile.module.css";
import "../../src/app/globals.css";
import "../../src/app/public-tournament.css";
import type { CSSProperties } from "react";

// The real layout wraps every page in .themed-site; tokens live there. Tailwind
// turns globals.css `@theme` into these variables, which this CSS-only host
// does not process.
const themeTokens = {
  "--space-panel": "1.5rem",
  "--radius-panel": "0.75rem",
} as CSSProperties;

// The real cover branch of PlayerProfile: the player id pill anchored to the
// card corner and the identity heading overlaid on the cover.
createRoot(document.getElementById("root")!).render(
  <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
    <main style={{ padding: 24 }}>
      {/* The real layout wraps every page in .themed-site; tokens live there. */}
      <div className="themed-site" data-appearance="default" style={themeTokens}>
        <section className="panel profile-summary">
          <PlayerIdBadge osuId={7003013} palette={rankTierPalette(0.0142)} />
          <div className="profile-cover">
            <div className="profile-cover-content">
              <header className={styles.heading}>
                <div className="avatar" aria-hidden="true" />
                <div className={styles.headingText}>
                  <div className={styles.nameRow}>
                    <h1>
                      <a
                        href="https://osu.ppy.sh/users/7003013"
                        className={styles.identityLink}
                      >
                        Player
                      </a>
                    </h1>
                  </div>
                  <p className="muted">CN (CN)</p>
                </div>
              </header>
            </div>
          </div>
        </section>
      </div>
    </main>
  </NextIntlClientProvider>,
);
