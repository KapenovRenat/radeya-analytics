import { PageShell } from "@/components/page/page-shell";
import { SummaryClient } from "./summary-client";

export const dynamic = "force-dynamic";

export default async function AdSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PageShell title="Сводка" subtitle="Kaspi Реклама · итоговая аналитика">
      <SummaryClient storeId={id} />
    </PageShell>
  );
}
