# Architecture

```mermaid
flowchart TD
  P[Paste listing and profile] --> D1[D1 extraction and span verification]
  G[Server Gemini adapter in live mode] --> D1
  O[Bundled offline extraction] --> D1
  D1 --> D5[D5 owner-sharing applicability]
  D1 --> D2[D2 clause rules and verified proposals]
  D5 --> D2
  D1 --> D3[D3 fixed logistic scam model]
  D1 --> D4[D4 cached commute]
  D2 --> D6[D6 aggregate verdict]
  D3 --> D6
  D4 --> D6
  D5 --> D6
  D6 --> D7[D7 permission gate]
  D7 --> A[Local drafts and confirmed copy or ICS]
  A --> L[Action log with inverse state]
  D6 --> L
  L --> H[Human correction or undo]
  H --> D6
```

`core/` is shared TypeScript: source-derived JSON data, extraction verification, scoring, decisions, escalation and recovery. Live extraction is the only provider step; deterministic code determines verdicts and permissions. Live failures preserve an explicit reason and use offline rules ([engine](../core/engine.ts), [adapter](../api/gemini.ts)).

Vercel serves the Vite output `web/dist` and Node function handlers in `api/`; `api/analyze.ts` has a 30-second function limit ([vercel.json](../vercel.json)). The local server exposes the same handlers on port 8787; Vite on 5173 proxies `/api` there. Secrets stay on the API side.

The browser offline mode runs the bundled core without a provider request. The React app maintains interactive results and localStorage preferences/listing state; no durable server session database or messaging/payment integration is implemented. Drafts are artifacts for user review, not external transactions. [Recovery details](ACCOUNTABILITY.md).
