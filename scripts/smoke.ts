// pnpm smoke — assumes `pnpm dev` is already running. Hits a few key routes
// and fails loudly on any 5xx, as a basic "did I break the app" check.
// No dynamic port assignment (the reference repo's git-worktree workflow
// needs that; we don't) — just the plain Next.js default port.
const port = Number(process.env.PORT ?? 3000);
const base = `http://localhost:${port}`;

const routes = ["/", "/issues", "/issues/1"];
const fails: string[] = [];

async function run() {
  console.log(`[smoke] hitting ${base}`);
  for (const r of routes) {
    try {
      const res = await fetch(base + r, { redirect: "manual" });
      if (res.status >= 500) fails.push(`${r} -> ${res.status}`);
      else console.log(`  ${r} -> ${res.status}`);
    } catch (err) {
      fails.push(`${r} -> ${err instanceof Error ? err.message : "fetch error"}`);
    }
  }
  if (fails.length > 0) {
    console.error(`[smoke] FAIL\n  ${fails.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`[smoke] OK (${routes.length} routes)`);
}

run();
