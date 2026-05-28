import { redirect } from "next/navigation";

export default async function AdRootPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/stores/${id}/ad/summary`);
}
