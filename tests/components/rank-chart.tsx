import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { RankChart } from "../../src/components/rank-chart";
import en from "../../messages/en.json";
import "../../src/app/globals.css";
import "../../src/app/public-tournament.css";

// Synthetic rank history: a slow climb with noise, newest sample last.
let rank = 16200;
const history = Array.from({ length: 120 }, (_, index) => {
  rank -= 24;
  rank += index % 7 === 0 ? 180 : -Math.round(index % 5) * 12;
  return Math.max(1, rank);
});

createRoot(document.getElementById("root")!).render(
  <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
    <main style={{ padding: 24 }}>
      {/* The real layout wraps every page in .themed-site; tokens live there. */}
      <div className="themed-site">
        <section className="panel profile-summary">
          <div className="profile-body">
            <div className="rank-chart-card">
              <RankChart data={history} globalRank={12345} />
            </div>
            <dl className="profile-statistics">
              {[
                ["Accuracy", "97.25%"],
                ["Play count", "48,120"],
                ["Play time", "302 days 4 hours"],
                ["Ranked score", "9,007,199,254,740,993"],
                ["Total score", "987,654,321"],
                ["Maximum combo", "1,234×"],
                ["Level", "75 (42%)"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </div>
    </main>
  </NextIntlClientProvider>,
);
