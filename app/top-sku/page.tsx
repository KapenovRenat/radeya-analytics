import { ComingSoonPage } from "@/components/page/coming-soon";

export const dynamic = "force-static";

export default function TopSkuPage() {
  return (
    <ComingSoonPage
      title="Топ-SKU"
      description="Лидеры ассортимента — по revenue, по margin, по растущему спросу. С возможностью углубиться в каждый SKU."
      blocks={[
        "Топ-20 по revenue · с delta vs прошлый период",
        "Топ-20 по margin (₸ и %)",
        "Топ-10 'растущих' (velocity > 0)",
        "Тренд каждого SKU за 90 дней",
      ]}
    />
  );
}
