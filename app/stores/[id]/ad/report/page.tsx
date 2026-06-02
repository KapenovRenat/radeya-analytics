import { getActiveStore } from "@/lib/active-store";
import { redirect } from "next/navigation";
import { ReportClient } from "./report-client";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getActiveStore();
  if (!store) redirect("/stores");
  return <ReportClient storeId={id} />;
}
