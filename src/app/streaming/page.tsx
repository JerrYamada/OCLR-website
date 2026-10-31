import Link from "next/link";
import { authorizedPage } from "@/lib/auth/page";
import { requireBrowserSession } from "@/lib/auth/user";
import { streamingAccessEditions } from "@/lib/streaming-api";
import { PageHeading } from "@/components/ui";
import { getAppTranslations } from "@/i18n/server";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page() {
  return authorizedPage(async () => {
    const session = await requireBrowserSession();
    const editions = await streamingAccessEditions(session.osuId);
    const tr = await getAppTranslations();
    return (
      <div className="container page auth-page">
        <PageHeading title={tr("Streaming API access")} />
        <p className="small muted">
          {tr("Choose a tournament to manage its streaming API access.")}
        </p>
        <ul className="plain-list">
          {editions.map((edition) => (
            <li key={edition.slug}>
              <Link className="text-link" href={`/streaming/${edition.slug}`}>
                {edition.name}
              </Link>
            </li>
          ))}
        </ul>
        {!editions.length && <p>{tr("No tournaments available.")}</p>}
      </div>
    );
  });
}
