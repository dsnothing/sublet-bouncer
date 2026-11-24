# Accountability and recovery

## Sources and state

The engine reads bundled source-derived data via [core/data.ts](../core/data.ts); provenance and licences are in [DATA-SOURCES.md](DATA-SOURCES.md). [core/engine.ts:75](../core/engine.ts#L75) returns the listing, evidence, decisions, escalations, actions, log and could-not-check list. Browser preferences/listing state use localStorage ([web/src/App.tsx:53](../web/src/App.tsx#L53)); stored results are discarded and recomputed on load. This is local app state, not an authenticated server audit database. Live mode sends listing text to Gemini through the server adapter ([api/gemini.ts:18](../api/gemini.ts#L18)); offline extraction uses bundled rules.

## Permissions and access control

[core/log.ts:12](../core/log.ts#L12) creates draft replies and evidence-card payloads automatically. Copy requires confirmation; viewing ICS also requires a feasible/tight commute, score below 0.3 and no unresolved escalation. [core/log.ts:28](../core/log.ts#L28) rechecks ICS conditions and rejects send_message, pay, sign and contact_landlord. Refused input blocks reply/copy. There is no user-account authorization layer; these are application capability rules, not protection against a user modifying client code.

## Confidence and escalation

[core/engine.ts:75](../core/engine.ts#L75) escalates fields below 0.8, clauses below 0.75, scam scores from 0.3 through 0.7, unknown commute and unknown applicability. [core/extract.ts:30](../core/extract.ts#L30) verifies spans and policy-sensitive values; quotation alone does not prove semantic correctness. See [DECISION-MAP.md](DECISION-MAP.md) for boundary details, including D5's informational confidence threshold.

## Log and recovery

[core/log.ts:7](../core/log.ts#L7) appends IDs, timestamps, actor, listing hash, available confidence/threshold and decision output; action entries retain inverse state. The hash is a simple noncryptographic fingerprint. The log is inspectable and append-only through normal core operations, not tamper-proof storage.

[core/log.ts:37](../core/log.ts#L37) restores reversible action state and appends an undo entry. It cannot retract clipboard contents or downloaded files. [core/log.ts:44](../core/log.ts#L44) keeps unsure answers unresolved and requires typed corrections for address/rent questions. [core/log.ts:54](../core/log.ts#L54) implements `markWrong`: roll back generated actions in reverse order, validate/pin a correction, recompute dependent state, reapply the action gate and emit `{listing, decision_id, expected}` as a regression fixture. This fixture needs review and inclusion in tests; it does not train or persist itself. D7 policy cannot be overridden; a D6 correction cannot bypass a computed REFUSE.

Recovery path: inspect evidence ? answer an escalation or supply a typed correction ? inspect recomputed verdict and log ? export/review the fixture ? add a regression test. Tests `correction rolls back actions, recomputes downstream and emits fixture`, `undo reverts the draft and preserves append-only history`, and `logs the recomputed verdict output after a correction` in [core.test.ts](../tests/core.test.ts) cover this path.
