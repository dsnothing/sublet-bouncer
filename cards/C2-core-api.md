# C2 — Core decision engine + API (Lane L3, Codex gpt-6.1-sol high)
Owns: root package.json (npm workspaces: core, api, web), tsconfig, vitest config, /core, /api, /tests, vercel.json.
Do NOT touch: /web (Antigravity), /data content, /evals, /scripts (C3) — except reading them.
Steps:
1. FIRST commit: workspace scaffold + core/types.ts exactly per SPEC §5 + core/fixtures/sample-result.{admit,hold,refuse}.json (realistic, internally consistent). Commit message "C2: types + fixtures".
2. Implement core: extract (offline regex extractor + LLM adapter interface; span verification), rules engine reading data/rta_rules.json (use a minimal 3-rule placeholder file if C3 hasn't landed; C3 will replace), scam model inference reading data/scam_model.json (placeholder weights ok until C3), commute lookup (data/commute_table.json + geocode_cache.json; placeholder ok), RTA applicability, verdict, gate, log/undo/markWrong, injection + language guards.
3. api/analyze.ts (Vercel Node function) calling Gemini gemini-2.5-flash with JSON schema, 12 s timeout, fallback per SPEC §2; api/health.ts. Local dev: `npm run dev:api` (vercel dev not required — provide a tiny node http server in api/dev-server.ts on port 8787 serving the same handlers) reading .env.
4. Tests per SPEC §7 (≥16, ≥6 failure-oriented). LLM mocked in tests; one optional live smoke test skipped unless GEMINI_API_KEY present.
Done-check: `npm install && npm test` green; `npm run dev:api` + curl POST /api/analyze works live and with mode offline; no secrets in git; HANDOFF.md entry (≤15 lines). Commit on main with clear messages.
Node: if `node` isn't on PATH, prepend "C:\Program Files\nodejs".
