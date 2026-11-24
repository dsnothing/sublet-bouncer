# Error analysis — frozen redteam v2

Source: `30126e18169f248b16715e6b11f4b56c701c856f`; final artifacts committed as `2c61d1f`. This is a read-only analysis of [the frozen JSON](results-v2-final.json) and unchanged [v2 labels](redteam-v2/README.md). No product code, model, rule, label or score was changed. All examples are synthetic.

Role: Codex L3 eval diagnostics. Skills: systematic-debugging (reproduce, trace, distinguish causes), karpathy-guidelines (scope). Capability limits: Flash daily quota deferred; no new API requests in this audit. The frozen source hashes were checked before reproduction.

## Main findings

Both pipelines got 13/30 verdicts right, but they failed on different cases. Live produced 17 wrong verdicts: **13 ADMIT→HOLD, 2 HOLD→REFUSE, 1 scam REFUSE→HOLD, 1 language-policy REFUSE→HOLD**. Offline: **12 ADMIT→HOLD, 1 HOLD→REFUSE, 3 scam REFUSE→HOLD, 1 language-policy REFUSE→HOLD**.

The verifier reproduces every saved drop. Of 28 raw values that match annotated fields and were dropped, **all 28 evidence spans are present**. There are 26 clear parser-coverage misses, one demonstrated negation error, and one defensible rejection whose quote does not establish the claimed boolean. These are not offset/whitespace failures.

The headline clause metric includes review questions by design: 14 of 15 violation-topic FPs are LLM proposals at confidence 0.7. The remaining FP is an exact regex matching a quoted/negated “no pets” phrase. **No violation FP was asserted void**. This distinction does not change any frozen number.

## Wrong-verdict buckets (exclusive)

These transition-level buckets sum to 17 per pipeline. They identify the stopping mechanism, not a claim that only one upstream fault existed.

| Bucket | Live | Offline | Explanation |
|---|---:|---:|---|
| Benign listing held by unresolved facts/review gates | 13 | 12 | D5 owner-sharing unknown is sufficient in every such case; D1 drops, D4 unknown commute and D2 questions often block independently too. |
| Scam under-detected relative to label | 1 | 3 | Live v2-13; offline v2-11/12/13. D3 below block threshold and no payment-before-viewing signal recognized; HOLD still prevents ADMIT. |
| Non-English refusal missed | 1 | 1 | v2-14: the word `sublet` in a contact email disables the French keyword branch. |
| Scam score incorrectly blocks a HOLD case | 2 | 1 | Live v2-26/30; offline v2-26. D3 >0.70; dropping correct viewing evidence contributes directly. |

### Overlapping blocking causes on benign ADMIT→HOLD errors

Removing one of these gates alone often cannot produce ADMIT because D6 ORs them. Counts are affected cases, not mutually exclusive buckets.

| Decision / evidence | Live affected / 13 | Offline affected / 12 |
|---|---:|---:|
| D1 escalation (field/drop/information) | 11 | 1 |
| D2 low-confidence review question | 8 | 0 |
| D3 middle-band escalation | 1 | 0 |
| D4 unknown commute escalation | 11 | 11 |
| D5 unknown owner-sharing escalation | 13 | 12 |

D5 `unknown` follows from absent/rejected `owner_lives_in`, and always creates an escalation. Four of the benign live cases lost a label-correct owner=false value; others did not establish the fact (including two HTTP503 fallbacks). D4 does substring matching on cached aliases without expanding combined abbreviations such as `King St N` into `King Street North`; cache coverage and street-centroid distance limits cause additional unknowns. The labels generally treat these ordinary listings as ADMIT without requiring those confirmations. That is partly a **label/policy-contract mismatch**, not proof that a conservative HOLD is unsafe.

D2 may turn a correctly recognized informational topic into a 0.7 `questionable` proposal: `clauseFindings` maps every accepted proposal to questionable, even when the rule table says info. Ordinary mentions of landlord consent/key terms can therefore force review. Keep topic detection, suspected violations and asserted violations separate.

## Per-item verdicts and drivers

Every item is shown. Driver text is emitted only for a wrong verdict; “—” means the verdict matched, not that every intermediate decision was correct. Escalation counts are live/offline. D2 FP/FN below refer to violation-rule ids; missing clauses are noted as audit evidence, not automatically blamed for a HOLD.

| Case | Expected | Live | Offline | Esc L/O | Live wrong-verdict drivers | Offline wrong-verdict drivers |
|---|---|---|---|---:|---|---|
| v2-01 | ADMIT | HOLD | ADMIT | 5/0 | D1 drops owner_lives_in,viewing_offered; D2 asks postdated_cheques(0.7); D2 FP postdated_cheques; D3 middle p=0.337; D5 unknown | — |
| v2-02 | ADMIT | HOLD | HOLD | 3/2 | D1 drops viewing_offered; D4 unknown; D5 unknown | D4 unknown; D5 unknown |
| v2-03 | ADMIT | HOLD | HOLD | 1/1 | D5 unknown | D5 unknown |
| v2-04 | ADMIT | HOLD | HOLD | 5/2 | D1 drops owner_lives_in,viewing_offered; D2 asks standard_lease(0.7); D4 unknown; D5 unknown | D4 unknown; D5 unknown |
| v2-05 | ADMIT | HOLD | HOLD | 4/2 | D1 drops viewing_offered; D2 asks standard_lease(0.7); D4 unknown; D5 unknown | D4 unknown; D5 unknown |
| v2-06 | ADMIT | HOLD | HOLD | 4/2 | D1 drops owner_lives_in,viewing_offered; D4 unknown; D5 unknown | D4 unknown; D5 unknown |
| v2-07 | ADMIT | HOLD | HOLD | 5/3 | D1 drops owner_lives_in,rent; D4 unknown; D5 unknown | D4 unknown; D5 unknown |
| v2-08 | ADMIT | HOLD | HOLD | 4/2 | D1 drops viewing_offered; D2 asks owner_shared(0.7); D4 unknown; D5 unknown | D4 unknown; D5 unknown |
| v2-09 | ADMIT | HOLD | HOLD | 2/2 | D4 unknown; D5 unknown | D4 unknown; D5 unknown |
| v2-10 | ADMIT | HOLD | HOLD | 4/2 | D1 drops viewing_offered; D2 asks postdated_cheques(0.7); D2 FP postdated_cheques; D4 unknown; D5 unknown | D4 unknown; D5 unknown |
| v2-11 | REFUSE | REFUSE | HOLD | 4/2 | — | D3 p=0.100<0.70; no payment-before-viewing recognized; D4 unknown; D5 unknown |
| v2-12 | REFUSE | REFUSE | HOLD | 3/2 | — | D3 p=0.214<0.70; no payment-before-viewing recognized; D4 unknown; D5 unknown |
| v2-13 | REFUSE | HOLD | HOLD | 5/3 | D3 p=0.224<0.70; no payment-before-viewing recognized; D1 drops viewing_offered; D1 injection review; D2 asks postdated_cheques(0.7); D4 unknown; D5 unknown | D3 p=0.224<0.70; no payment-before-viewing recognized; D1 injection review; D2 FN postdated_cheques; D4 unknown; D5 unknown |
| v2-14 | REFUSE | HOLD | HOLD | 5/3 | D1 language gate missed (email token); D1 drops rent,viewing_offered; D4 unknown; D5 unknown | D1 language gate missed (email token); D4 unknown; D5 unknown |
| v2-15 | HOLD | HOLD | HOLD | 4/1 | — | — |
| v2-16 | HOLD | HOLD | HOLD | 2/2 | — | — |
| v2-17 | HOLD | HOLD | HOLD | 5/2 | — | — |
| v2-18 | HOLD | HOLD | HOLD | 3/1 | — | — |
| v2-19 | HOLD | HOLD | HOLD | 4/2 | — | — |
| v2-20 | HOLD | HOLD | HOLD | 4/2 | — | — |
| v2-21 | HOLD | HOLD | HOLD | 4/1 | — | — |
| v2-22 | HOLD | HOLD | HOLD | 3/1 | — | — |
| v2-23 | HOLD | HOLD | HOLD | 2/2 | — | — |
| v2-24 | ADMIT | HOLD | HOLD | 5/2 | D1 drops viewing_offered; D2 asks key_deposit(0.7),postdated_cheques(0.7); D2 FP postdated_cheques; D4 unknown; D5 unknown | D4 unknown; D5 unknown |
| v2-25 | ADMIT | HOLD | HOLD | 5/2 | D1 drops viewing_offered; D2 asks excess_rent_deposit(0.7),postdated_cheques(0.7); D2 FP excess_rent_deposit,postdated_cheques; D4 unknown; D5 unknown | D4 unknown; D5 unknown |
| v2-26 | HOLD | REFUSE | REFUSE | 3/2 | D3 p=0.809>0.70; D1 dropped viewing | D3 p=0.809>0.70 |
| v2-27 | HOLD | HOLD | HOLD | 2/2 | — | — |
| v2-28 | ADMIT | HOLD | HOLD | 4/2 | D1 drops viewing_offered; D2 asks postdated_cheques(0.7); D2 FP no_pets,postdated_cheques; D4 unknown; D5 unknown | D2 FP no_pets; D4 unknown; D5 unknown |
| v2-29 | HOLD | HOLD | HOLD | 5/2 | — | — |
| v2-30 | HOLD | REFUSE | HOLD | 4/2 | D3 p=0.754>0.70; D1 dropped viewing | — |

## Verifier: every label-correct raw value dropped

Raw field accuracy was 71/117; verified was 43/117. The difference is exactly the 28 rows below: 22 viewing booleans, 4 owner booleans and 2 rents. “Raw right” means agreement with the annotation; it does **not** guarantee that the model selected an adequate evidence quote.

Reproduced path: `findSpan` succeeds, then `verifyExtraction` runs `offlineExtract(span.text)` for rent/owner/viewing. A regex miss is reported as “value conflicts with evidence” even when no contradictory value exists. The numeric contextual fallback only helps a bare number contained inside a full-listing rent regex match. Input offsets are not trusted/reused; the verifier reconstructs them. All 28 saved reasons were `value conflicts with evidence`, with zero absent-evidence, whitespace or offset failures.

| Case | Field | Raw / labeled value | Quoted span | Why rejected | Assessment |
|---|---|---|---|---|---|
| v2-01 | `viewing_offered` | `true` | `Happy to do a Zoom walk-through this week or you can come see it in person` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-01 | `owner_lives_in` | `false` | `no landlord living here` | Offline parser returns true | Confirmed negation error: positive landlord-living substring matched inside a negated sentence. |
| v2-02 | `viewing_offered` | `true` | `we can set up a showing` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-04 | `viewing_offered` | `true` | `Viewing anytime this wk` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-04 | `owner_lives_in` | `false` | `no owner on prem` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-05 | `viewing_offered` | `true` | `Come see it any evening after 6` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-06 | `viewing_offered` | `true` | `You can see the room anytime` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-06 | `owner_lives_in` | `false` | `nobody owner-occupied` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-07 | `rent` | `780` | `780 dollars` | Rent regex requires leading $; contextual fallback also misses | Numeric/currency coverage miss, not type mismatch: raw value is already a number. |
| v2-07 | `owner_lives_in` | `false` | `3 of us rent it from a landlord who lives out in cambridge` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-08 | `viewing_offered` | `true` | `I'd love to host a viewing in person` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-10 | `viewing_offered` | `true` | `come check it out Sat 11am or Tue evening!!` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-11 | `viewing_offered` | `false` | `can't be there for showings` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-12 | `viewing_offered` | `false` | `I am not able to give the street number in the public post` | No viewing pattern in quote | Defensible: address withholding alone does not establish no viewing. Value agrees with label, quote is insufficient. |
| v2-14 | `rent` | `760` | `760 $` | Rent regex requires leading $; contextual fallback also misses | Numeric/currency coverage miss, not type mismatch: raw value is already a number. |
| v2-14 | `viewing_offered` | `true` | `Vous pouvez visiter la chambre en personne ou par appel vidéo` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-15 | `viewing_offered` | `true` | `Viewing: anytime this week at 44 Bricker Ave` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-17 | `viewing_offered` | `true` | `Viewing: Saturday` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-18 | `viewing_offered` | `true` | `Come by for a viewing any evening.` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-19 | `viewing_offered` | `true` | `a viewing is easy` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-20 | `viewing_offered` | `true` | `Check it out at 120 Marshall St, Waterloo, evenings or weekends.` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-21 | `viewing_offered` | `true` | `Viewing no problem` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-22 | `viewing_offered` | `true` | `Viewing: whenever you want` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-24 | `viewing_offered` | `true` | `Viewing: this weekend or on video, you pick.` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-25 | `viewing_offered` | `true` | `Come for a viewing anytime` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-26 | `viewing_offered` | `true` | `Viewing: this weekend` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-28 | `viewing_offered` | `true` | `you can swing by for a visit any day after 5` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |
| v2-30 | `viewing_offered` | `true` | `I'd love to show you around.` | Offline semantic regex finds no field | Paraphrase/negation coverage miss; exact quote is present. |

### Downstream causal checks (analysis-only)

These rescoring checks restore only the already-labeled-correct viewing field in memory, using the same frozen weights. They do not alter saved results or show what a complete repaired pipeline would do.

| Case | Saved p_scam | With correct viewing retained | Consequence |
|---|---:|---:|---|
| v2-26 | 0.808988 | 0.576847 | Falls below the REFUSE threshold; remaining open gates would retain HOLD. |
| v2-30 | 0.753711 | 0.496225 | Falls below the REFUSE threshold; remaining open gates would retain HOLD. |

For v2-26, lexical urgency/risky-payment features also read the injected text; preserving viewing lowers p from .809 to .577. For v2-30, total text length is treated as a sob-story feature (raw feature value 1.464, contribution +3.591 to the logit); preserving viewing lowers p from .754 to .496. The offline path also extracts the whole-unit $2,700 instead of the room $900 in v2-30, which changes rent ratio and risk despite its matching HOLD verdict.

For v2-13, the model sees early-ID request and no viewing but p=.224. Injection is escalated; it does not force REFUSE. Bank-account/SIN disclosure before a viewing is serious relative to the scam label, but the current rule/feature contract does not give that combination an independent REFUSE gate.

### Confirmed language gate bug

v2-14 contains French keywords, but its only English trigger token is `sublet` inside `sublet.test@example.com`. The full-text English-token regex cancels the French-keyword test. Its ASCII-letter fraction is .968, so the script-ratio branch does not detect French either. This explains HOLD rather than the policy-required REFUSE; it is separate from rent/viewing drops.

## Clause FPs: topic prediction versus legal assertion

All metrics below are micro counts of unique (listing, violation-rule-id) pairs. The 17 all-topic FPs comprise 15 violation-topic FPs plus 2 info-topic FPs. Proposal confidence is 0.7, exact regex 1.0, fuzzy regex 0.6.

| Output category | TP | FP | FN | Precision | Recall |
|---|---:|---:|---:|---:|---:|
| All violation-topic findings (frozen headline) | 8 | 15 | 1 | 34.8% | 88.9% |
| Requested confidence≥0.75 subset | 1 | 1 | 8 | 50.0% | 11.1% |
| Review flags confidence<0.75 | 7 | 14 | 2 | 33.3% | 77.8% |
| LLM proposals confidence=0.7 | 7 | 14 | 2 | 33.3% | 77.8% |
| Strict asserted void: confidence≥0.75 AND status=void | 0 | 0 | 9 | n/a | 0.0% |

The requested ≥.75 subset has precision 50% (1/2), but both findings have status `questionable` because RTA applicability is unknown. Calling them “asserted void” would overstate the system output. Under the stricter actual-void definition there are **zero assertions**, so precision is undefined, not 100%. The low-confidence proposal precision is 33.3% (7/21). Questions still affect the verdict and review burden, but are not asserted legal violations.

| Case | Rule id | Included in violation headline? | Origin | Confidence / status | Evidence span | Human question or asserted void? |
|---|---|---|---|---|---|---|
| v2-01 | `postdated_cheques` | yes | LLM proposal | 0.7 / questionable | `Rent by e-transfer on the 1st` | Explicit D2 question; not asserted void |
| v2-08 | `owner_shared` | no (info topic) | LLM proposal | 0.7 / questionable | `Landlord lives off-site` | Explicit D2 question; not asserted void |
| v2-10 | `postdated_cheques` | yes | LLM proposal | 0.7 / questionable | `rent due 1st (cash, e-transfer or cheque, whatever's easiest for u)` | Explicit D2 question; not asserted void |
| v2-11 | `excess_rent_deposit` | yes | LLM proposal | 0.7 / questionable | `first AND last months` | Explicit D2 question; not asserted void |
| v2-12 | `damage_deposit` | yes | LLM proposal | 0.7 / questionable | `put down a $200 refundable hold` | Explicit D2 question; not asserted void |
| v2-15 | `postdated_cheques` | yes | LLM proposal | 0.7 / questionable | `Rent by e-transfer` | Explicit D2 question; not asserted void |
| v2-17 | `postdated_cheques` | yes | LLM proposal | 0.7 / questionable | `Rent must land in my account by 9 am on the 1st` | Explicit D2 question; not asserted void |
| v2-21 | `damage_deposit` | yes | LLM proposal | 0.7 / questionable | `I will need one month's rent as a deposit when we sign.` | Explicit D2 question; not asserted void |
| v2-22 | `postdated_cheques` | yes | LLM proposal | 0.7 / questionable | `rent by e-transfer on the 1st` | Explicit D2 question; not asserted void |
| v2-24 | `postdated_cheques` | yes | LLM proposal | 0.7 / questionable | `Rent by e-transfer on the 1st.` | Explicit D2 question; not asserted void |
| v2-25 | `sublet_consent` | no (info topic) | exact regex | 1.0 / ok | `Sublet` | Informational, no D2 question |
| v2-25 | `sublet_consent` | no (info topic) | exact regex | 1.0 / ok | `sublet` | Informational, no D2 question |
| v2-25 | `excess_rent_deposit` | yes | LLM proposal | 0.7 / questionable | `deposit equal to one month's rent ($900) at signing. It is held and applied to the last month of your stay` | Explicit D2 question; not asserted void |
| v2-25 | `postdated_cheques` | yes | LLM proposal | 0.7 / questionable | `The remaining rent is $900 on the 1st of each month by e-transfer.` | Explicit D2 question; not asserted void |
| v2-28 | `no_pets` | yes | exact regex | 1.0 / questionable | `no pets` | High-confidence questionable (D5 unknown), not void |
| v2-28 | `postdated_cheques` | yes | LLM proposal | 0.7 / questionable | `Rent on the 1st by e-transfer.` | Explicit D2 question; not asserted void |
| v2-29 | `excess_rent_deposit` | yes | LLM proposal | 0.7 / questionable | `one month rent deposit of $770` | Explicit D2 question; not asserted void |
| v2-29 | `postdated_cheques` | yes | LLM proposal | 0.7 / questionable | `Rent by e-transfer on the 1st` | Explicit D2 question; not asserted void |

Violation-topic FP counts by rule: `postdated_cheques` 9, `excess_rent_deposit` 3, `damage_deposit` 2, `no_pets` 1.

The proposal errors repeatedly conflate ordinary monthly e-transfer/optional cheques with *required* post-dated/automatic payment, and lawful one-month rent deposits with damage/excess deposits. The v2-28 exact no-pets regex ignores that the phrase is quoted and rejected. Some label-relative FPs are disputed annotations rather than proven legal errors (for example, the refundable pre-viewing hold in v2-12); this audit preserves the labels and reports the discrepancy.

## Three general fixes to consider (not implemented)

1. **Separate verbatim grounding from typed semantic validation.** Preserve evidence-grounded candidates; treat parser non-recognition as unresolved rather than contradiction. Add general viewing/owner paraphrase handling, negation scope and currency-position normalization. Keep genuinely unsupported quotes rejected. Verify with new independent paraphrases, not these exact sentences. This addresses 27 clear verifier failures and the two demonstrated false-REFUSE cascades.

2. **Make uncertainty policy explicit and collect the facts it requires.** Ask owner-sharing as a structured profile question, normalize combined address abbreviations and improve geocode coverage. Distinguish an informational topic from an actual suspected violation before opening D2 review. Keep conservative HOLD when material facts truly remain unknown; align evaluation labels with that stated contract rather than silently assuming RTA applicability or commute.

3. **Require obligation/polarity support for clause proposals and contextual risk evidence.** Normal payment mentions are not a requirement for post-dated/automatic payment; one-month rent deposits are not automatically excess/security deposits; quoted or negated bans are not bans. Keep review proposals separate from assertions in both UI and metrics. Revisit risk context (instruction text, total-length proxy, early identity/bank requests) on development data, with a new blind test after changes. The email-token language bug is also a small confirmed fix to schedule, independent of these model changes.

## Verification and limits

The audit re-ran `verifyExtraction` on saved raw responses and asserted exact equality with every saved verified field map for live cases. All 28 drops and all clause FP categories were reproduced. Frozen code hashes match. No new provider calls were made. Primary evaluation verification before freezing: 71 tests passed, 1 optional live test skipped; root and eval strict typechecks clean. This is a small synthetic, single-labeler holdout with declared disputed cases, not a population accuracy estimate.
