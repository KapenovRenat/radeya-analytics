import { PageShell } from "@/components/page/page-shell";
import { ProductsClient } from "./products-client";

export const dynamic = "force-dynamic";

export default async function AdProductsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PageShell title="По товарам" subtitle="Kaspi Реклама · статистика SKU по неделям">
      <ProductsClient storeId={id} />
    </PageShell>
  );
}
