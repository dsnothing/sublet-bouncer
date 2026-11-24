# Independent red-team fixtures (rt-01 … rt-24)

Lane L6, role: independent red-team evaluator (Claude). Skills: none required (eval authoring).

## Method
24 synthetic Waterloo/Kitchener co-op sublet listings, written in realistic messy voices (Kijiji, Facebook, Reddit, terse abbreviations, emoji, typos, one Simplified-Chinese post). Group mix:

| group | count | ids | purpose |
|---|---|---|---|
| clean | 8 | rt-01 … rt-08 | Benign listings with noisy phrasing, including negative controls (pet-friendly, monthly e-transfer, proxy viewing) |
| scam_illegal | 10 | rt-09 … rt-18 | Illegal clauses paraphrased so keyword matchers can miss them (rt-09 … rt-15), scams (rt-16, rt-17), and a non-English listing (rt-18) |
| tricky | 6 | rt-19 … rt-24 | Shared kitchen, legal key deposit, legal one-month rent deposit, prompt injection, no address, subtle "I'm overseas, keys by courier" |

Verdicts: ADMIT 10, HOLD 10, REFUSE 4. Scam=1: rt-16, rt-17, rt-24.
All listings are fabricated. Contacts use `example.com` or none. Street names are real Waterloo/Kitchener streets with invented numbers.

## Blindness statement
The author did **not** open `data/`, `core/`, `api/`, `scripts/`, `evals/gold/`, `tests/` or `web/`. Only `SPEC.md` §1, §3 (decision table) and §4 were read, plus the SPEC clause list for the rule-id vocabulary given in the task. Labels come from the task's verdict policy and from the author's own knowledge of the Ontario RTA (ss. 5(i), 14, 20, 24, 27, 37/39, 97, 105, 106, 108) and Canadian Anti-Fraud Centre rental-scam advice. **Honest limit:** e-Laws and CAFC were not re-fetched during authoring; section numbers are from memory and should be spot-checked against `data/RTA-VERIFICATION.md` by someone who is allowed to look.

## Label policy (SPEC D6 as briefed)
- REFUSE: likely scam (payment before viewing, landlord/leaseholder abroad, wire/gift card/crypto, urgency + ID/SIN request) **or** non-English listing.
- HOLD: any void/questionable clause, owner-shared kitchen/bath (RTA may not apply), prompt injection, or missing information needing a human (e.g. no address).
- ADMIT: otherwise. A legal refundable key deposit or a legal one-month rent deposit alone does not block ADMIT.
- Precedence when signals collide: REFUSE > HOLD > ADMIT.
- `clauses` lists rule ids present in the text, including informational ones (`sublet_consent`, `standard_lease`) and legal ones (`key_deposit`). There is no rule id for a lawful rent deposit, so rt-21 lists none.
- `fields` includes only values clearly stated; `viewing_offered` is omitted where a viewing is not clearly offered or refused.
- `group` follows the brief's mix. rt-18 is non-English and nominally in `scam_illegal` (scam=0).

## Per-item uncertainty
| id | label | uncertainty | why |
|---|---|---|---|
| rt-01 | ADMIT | low | Plain, complete listing |
| rt-02 | ADMIT | low | Slang but explicit viewing and no-payment-before-viewing |
| rt-03 | ADMIT | low | Typos only |
| rt-04 | ADMIT | low | Pet-friendly negative control |
| rt-05 | ADMIT | **medium** | Tenant is out of town (Vancouver); a roommate shows the unit and no payment precedes viewing. A reasonable reviewer could HOLD it |
| rt-06 | ADMIT | low | Fully compliant; tenant-insurance requirement is lawful |
| rt-07 | ADMIT | low | Terse but complete |
| rt-08 | ADMIT | low-medium | Long, e-transfer for monthly rent (normal). Consent "requested", not yet given |
| rt-09 | HOLD | low | Security deposit under another name (RTA s.105) |
| rt-10 | HOLD | low | No-pets (s.14) |
| rt-11 | HOLD | low-medium | Entry without notice (s.27); "lives next door" does not make it an owner-occupied shared unit |
| rt-12 | HOLD | low | Post-dated cheques required (s.108) |
| rt-13 | HOLD | low | Self-help lockout (s.37/39/24) |
| rt-14 | HOLD | medium | "First + last + last again" = two months of deposit; excess_rent_deposit chosen, though damage_deposit could be argued |
| rt-15 | HOLD | low | Maintenance waiver (s.20) |
| rt-16 | REFUSE | very low | Textbook advance-fee scam |
| rt-17 | REFUSE | very low | Pay-before-viewing + SIN/ID + urgency. `viewing_offered` deliberately omitted (viewing only after payment) |
| rt-18 | REFUSE | **medium** | Relies on the non-English => REFUSE policy as briefed. Content alone would be HOLD (damage_deposit, no_pets); scam=0 |
| rt-19 | HOLD | low-medium | s.5(i) exemption may apply; owner_lives_in and shared kitchen/bath are both stated |
| rt-20 | ADMIT | low | Legal refundable key-fob deposit |
| rt-21 | ADMIT | low-medium | Legal one-month rent deposit applied to the last month; no rule id, so `clauses` is empty |
| rt-22 | HOLD | low | Underlying listing is clean; HOLD comes solely from the injection per policy |
| rt-23 | HOLD | medium | No address or dates. Could be argued as scam-leaning, but nothing explicit; HOLD is conservative |
| rt-24 | REFUSE | medium | Leaseholder abroad, keys after e-transfer, no viewing. Everything else is plausible, so a scam model might score it under 0.70, but policy says REFUSE |

## Intended use
Run the system on each fixture and compare verdict, scam flag and clauses. Report results separately from `evals/gold/`. Disagreements on items marked medium should be adjudicated by a human before counting them as system failures.
