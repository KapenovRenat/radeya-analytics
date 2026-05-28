import { PageShell } from "@/components/page/page-shell";
import { CampaignsClient } from "./campaigns-client";

export const dynamic = "force-dynamic";

export default async function AdCampaignsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PageShell title="Кампании" subtitle="Kaspi Реклама · по неделям">
      <CampaignsClient storeId={id} />
    </PageShell>
  );
}
