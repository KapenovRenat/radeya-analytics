/**
 * Drizzle DB client. Uses @vercel/postgres for production (auto-populated
 * POSTGRES_URL env) and node-postgres for local dev.
 */
import { drizzle as drizzleVercel } from "drizzle-orm/vercel-postgres";
import { drizzle as drizzleNode, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql as vercelSql } from "@vercel/postgres";
import pg from "pg";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzleVercel<typeof schema>> | NodePgDatabase<typeof schema> | null = null;

export function getDb() {
  if (_db) return _db;

  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("POSTGRES_URL or DATABASE_URL env var is required");

  // Prefer vercel-postgres when POSTGRES_URL is set (it uses WebSockets for edge)
  if (process.env.POSTGRES_URL) {
    _db = drizzleVercel(vercelSql, { schema });
  } else {
    const pool = new pg.Pool({ connectionString: url });
    _db = drizzleNode(pool, { schema });
  }

  return _db;
}

export { schema };
