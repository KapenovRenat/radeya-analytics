import { getActiveStore } from "@/lib/active-store";
import { redirect } from "next/navigation";
import { OverviewClient } from "./overview-client";

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getActiveStore();
  if (!store) redirect("/stores");
  return <OverviewClient storeId={id} />;
}
