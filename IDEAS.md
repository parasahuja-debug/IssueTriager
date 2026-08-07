# IDEAS.md

Running backlog of "good to have" feature ideas — not committed work. This is
separate from `PLAN.md`, which is the structured day-by-day build plan.
Nothing here is scheduled to a day until it's promoted into `PLAN.md`.

Add entries via `/idea <your thought>`, or by hand in the same format:

```
- <idea text> (YYYY-MM-DD)
```

---

- I should have a fix issue page or button (on which page it would be is a different discussion) (2026-08-07)
- lets add branching system across the project. (2026-08-07)
- Day 6 research (not configured, decision only): evaluated an MCP server for Postgres schema introspection. Anthropic's official `@modelcontextprotocol/server-postgres` was read-only by design but got deprecated and archived July 2025 after a SQL-injection finding — ruled out. Supabase's own `supabase-mcp` (official, Supabase-maintained) is the better fit for this project specifically, since local dev already runs Supabase's stack — supports `--read-only` / `read_only=true` to run as a read-only Postgres user with mutating tools disabled. Recommendation if this gets picked up later: adopt `supabase-mcp` in read-only mode, pointed at the local Supabase instance, so schema questions can be answered by live introspection instead of only reasoning from `migrations/*.sql` (which can drift from what's actually applied). (2026-08-07)
