import { redirect } from "next/navigation";

export default function ArchivePage() {
  // Для MVP: архив = тот же список что и /reports. Позже добавим фильтрацию по году.
  redirect("/reports");
}
