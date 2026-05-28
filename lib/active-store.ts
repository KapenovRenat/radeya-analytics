import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kaspiStores } from "@/lib/db/schema";

/**
 * Returns the first active store (single-store mode for demos).
 * Used by all top-level sidebar pages and routing helpers.
 *
 * Returns null when:
 *   - DB is not reachable (e.g. local dev without POSTGRES_URL)
 *   - no stores have been added yet
 *   - all stores are inactive
 */
export async function getActiveStore() {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(kaspiStores)
      .where(eq(kaspiStores.isActive, true))
      .orderBy(desc(kaspiStores.createdAt))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export type ActiveStore = Awaited<ReturnType<typeof getActiveStore>>;
