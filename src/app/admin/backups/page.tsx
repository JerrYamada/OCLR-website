import { authorizedPage } from "@/lib/auth/page";
import { backupActor } from "@/lib/admin-backups";
import { getAppTranslations } from "@/i18n/server";
import { PageHeading } from "@/components/ui";
import { BackupManager } from "@/components/backup-manager";
export default async function Page() {
  return authorizedPage(async () => {
    await backupActor();
    const tr = await getAppTranslations();
    return (
      <>
        <PageHeading title={tr("Database backups")} />
        <BackupManager />
      </>
    );
  });
}
