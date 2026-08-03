import "dotenv/config";
import { sql } from "../lib/db";

async function main() {
  const rows = await sql`SELECT current_database() AS db, now() AS time`;
  console.log("[db-check] connected:", rows[0]);
  await sql.end();
}

main().catch((err) => {
  console.error("[db-check] FAILED:", err);
  process.exit(1);
});
