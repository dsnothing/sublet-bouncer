# C5 web review
What this change does: Reviews Antigravity commits 408c322 and 9737a24 against SPEC sections 1, 5, 6 and core/types.ts. Preserves visual design.

Role: Codex L6. Skill: ponytail-review (trace callers and require concrete failure cases); explicit task authorizes fixes despite skill report-only default. Workforce workflow and catalog read. Design toolbox checked; metadata script blocked by local PowerShell execution policy, enabled catalog used instead. No browser ownership taken.

## Fixed
- High ? web/src/components/BoardingPass.tsx:97: download happened before core perform validation. A proposed ICS action with scam p >= .30 still downloaded before core rejected it. Parent now returns success and export stops on rejection.
- Medium ? web/src/App.tsx:72: valid JSON such as {"listing":"test","result":{}} passed storage loading and crashed on result.scam.p. Recompute cached results and validate stored preferences; storage access remains caught. Settings/listing persist; analysis history now resets on reload.
- Medium ? web/src/App.tsx:145: click Clean (slow live request), then Scammy (fast response); Clean could replace Scammy. Request sequence suppresses superseded responses and loading updates.
- Medium ? web/src/components/BoardingPass.tsx:86: clipboard rejection still displayed Copied reply and recorded success. It now displays an error and does not record completion.

- Medium ? web/src/App.tsx:418: changing campus after analysis relabeled an old commute. Boarding pass now uses the profile snapshot from its completed analysis.

## Open findings
2. Medium ? web/src/adapter.ts:74,86,90: explicit ?demo=fixtures replaces listing text but keeps fixture offsets/fields. An arbitrary listing can display unrelated marked text. Suggested fix: use fixture original text, or restrict fixtures to exact original samples and remap spans.
3. Medium ? web/src/App.tsx:72: defensive cache invalidation resets correction/undo history on refresh. Suggested follow-up: versioned, deeply validated persisted analysis schema with migration; preserve validated logs and recompute permissions.
4. Low ? web/src/components/BoardingPass.tsx:81: clipboard operation awaits permission; a correction/new analysis during that wait can leave its completion callback referring to an old run. Suggested fix: bind completion to run ID or disable state mutations during clipboard operation.

## Verification
- npm run build: passed (TypeScript and Vite production bundle).
- npm test: 64 passed, 1 skipped, 4 test files. Existing suite, no new UI event tests.
- Core adapters correctly thread returned results for resolveEscalation, perform, undo, markWrong. No never-tier UI trigger found. Same-origin /api/analyze; localhost exists only in Vite development proxy.
- Highlight slices use exclusive end offsets, with bounds and overlap checks. Listing text renders through React text nodes; no HTML injection sink found. Labels and Escape dismissal present; no source-level keyboard trap found.
- Not checked: rendered keyboard/mobile/visual behavior; delegated to Antigravity L5. Clean-clone README startup cannot be checked because README.md is absent in current checkout. API/core were concurrently modified by another worker; build/test reflect shared checkout at execution time.

Verdict: production source paths reviewed; fixture mode and durable history need follow-up.
