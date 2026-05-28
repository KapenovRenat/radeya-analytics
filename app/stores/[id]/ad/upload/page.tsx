import { PageShell } from "@/components/page/page-shell";
import { UploadCampaignsClient } from "./upload-client";

export const dynamic = "force-dynamic";

export default async function AdUploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PageShell
      title="Загрузка по кампаниям"
      subtitle="Kaspi Реклама · CSV из кабинета"
    >
      <UploadCampaignsClient storeId={id} />
    </PageShell>
  );
}
