import { authorizedPage } from "@/lib/auth/page";
import { requireBrowserSession } from "@/lib/auth/user";
import { listStreamingTokens } from "@/lib/streaming-api";
import { StreamingAccess } from "@/components/streaming-access";
import { PageHeading } from "@/components/ui";
import { getAppTranslations } from "@/i18n/server";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  return authorizedPage(async () => {
    const { edition } = await params;
    const context = await listStreamingTokens(
      await requireBrowserSession(),
      edition,
    );
    const tr = await getAppTranslations();
    return (
      <div className="container page auth-page">
        <PageHeading title={tr("Streaming API access")} />
        <StreamingAccess
          editionSlug={edition}
          backend={context.backend}
          origins={context.origins}
          initialTokens={context.tokens}
        />
      </div>
    );
  });
}
