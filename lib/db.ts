import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to .env");
}

declare global {
  var __sql: ReturnType<typeof postgres> | undefined;
}

// DAY 7: DATABASE_SSL added — unset locally (local Supabase needs no SSL,
// behavior unchanged), set to "require" only in Vercel's project settings,
// where DATABASE_URL points at Neon instead.
export const sql =
  globalThis.__sql ??
  postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    ssl: process.env.DATABASE_SSL === "require" ? "require" : undefined,
  });

if (process.env.NODE_ENV !== "production") globalThis.__sql = sql;
