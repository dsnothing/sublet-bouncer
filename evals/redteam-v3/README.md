# Red-Team Held-Out Evaluation Set v3 (`evals/redteam-v3`)

- **Author / Role:** Independent Red-Team Evaluator (Lane L6 — Gemini / Antigravity, cross-family from earlier sets)
- **Date:** 2026-11-24
- **Count:** 30 synthetic Waterloo/Kitchener Winter 2027 co-op sublet fixtures (`v3-01.json` – `v3-30.json`)
- **Mix:** 12 `clean` (`v3-01`–`v3-12`), 10 `scam_illegal` (`v3-13`–`v3-22`), 8 `tricky` (`v3-23`–`v3-30`)

## Method

1. **Cross-family independent authoring:** All 30 listings were written from scratch as realistic synthetic Waterloo/Kitchener Winter 2027 (`2027-01-01` to `2027-04-30`, UW `08:30` earliest class) student sublet posts across varied authentic channels (Reddit `r/uwaterloo`, Kijiji, Facebook Marketplace, WhatsApp forwards, terse bullet lists, long chatty posts with natural typos/emojis, Mandarin Chinese student board post).
2. **Privacy & synthetic hygiene:** Zero real names, real phones, or real emails (all contacts use `@example.com` or reserved NANPA fiction numbers `519-555-01xx`). All addresses use real Waterloo/Kitchener streets with synthetic street numbers.
3. **Subtle paraphrasing & full rule coverage:**
   - Clean set (`v3-01`–`v3-12`) keeps realistic market rents ($815–$1,420), verifiable UW/ION-corridor addresses, varied viewing offers, pet-friendly/utilities details, and off-site landlords where stated.
   - Scam/illegal set (`v3-13`–`v3-22`) covers all 8 violation clause topics (`damage_deposit`, `excess_rent_deposit`, `no_pets`, `postdated_cheques`, `entry_notice`, `maintenance_waiver`, `lockout`, `deposit_interest`) and diverse CAFC scam tactics (overseas courier, crypto/wire + SIN harvesting, single-tactic advance-payment before viewing, charity sob story + illegal deposits). Six items (`v3-15`, `v3-17`–`v3-21`) isolate **only one subtle paraphrased problem** inside an otherwise ordinary listing.
   - Tricky set (`v3-23`–`v3-30`) covers all 8 hard edge cases: owner-shared kitchen (`v3-23`), lawful refundable key/fob deposit (`v3-24`), lawful one-month last-month rent deposit (`v3-25`), adversarial prompt injection (`v3-26`), missing street address (`v3-27`), mixed lawful + illegal deposits/terms (`v3-28`), clean non-English Mandarin listing (`v3-29`), and a ~520-word listing with one buried void clause (`v3-30`).
4. **Verdict policy (SPEC D6):** Precedence `REFUSE > HOLD > ADMIT`. `REFUSE` for likely scam (`scam=1`) or non-English; `HOLD` for any void/questionable clause, owner-shared kitchen/bath (`s. 5(i)`), prompt injection, or missing critical info (e.g., no address); `ADMIT` otherwise (lawful key deposit or lawful one-month rent deposit alone does not block `ADMIT`).

## Blindness Statement

- **Never opened or listed:** `data/`, `core/`, `api/`, `scripts/`, `tests/`, `web/`, `docs/`, `cards/`, `HANDOFF.md`, `README.md`, or any part of `evals/` other than our newly created `evals/redteam-v3/` directory. Did not run `ls` or `git status` on `evals/`.
- **Permitted reads only:** `SPEC.md` section headings (to locate exact line bounds without viewing other sections) and lines 7–15 (§1) and 30–68 (§3 decision table and §4 permission matrix).
- **External workspace reads:** `WORKFORCE-SKILLS.md` and `SKILLS-CATALOG.md` (outside the project, per global workspace workflow rule; no skills required/loaded).
- **Accidental leakage:** None. Zero system regexes, training templates, scam weights, or v1/v2 fixtures were viewed.

## Primary Legal & Anti-Fraud Sources Verified

1. **Ontario Residential Tenancies Act, 2006, S.O. 2006, c. 17** — `https://www.ontario.ca/laws/statute/06r17` (live URL served a client-side JS shell to non-browser HTTP fetch; full statute text verified directly via Internet Archive capture `https://web.archive.org/web/20261115210533id_/https://www.ontario.ca/laws/statute/06r17`):
   - `s. 4(1)` (conflicting tenancy provisions void)
   - `s. 5(i)` (exemption when sharing kitchen/bathroom with resident owner or owner's immediate family)
   - `s. 12.1(1)` (prescribed Ontario Standard Form of Lease)
   - `s. 14` ("no pet" provisions void)
   - `s. 20(1)–(2)` (landlord statutory responsibility to repair/maintain; cannot be waived)
   - `s. 24` (prohibition on changing locks without giving replacement keys)
   - `s. 25`, `s. 26(1)`, `s. 27(1)` (entry only with emergency/consent or >=24h written notice for permitted purposes)
   - `s. 37(1)`, `s. 39` (termination and recovery of possession only via Act / LTB eviction order)
   - `s. 97(1)–(3)` (subletting with landlord consent, not arbitrarily or unreasonably withheld)
   - `s. 105(1)–(2)` (only permitted security deposit is a rent deposit under s. 106; prohibits damage/security deposits)
   - `s. 106(1)–(2)`, `s. 106(6)`, `s. 106(10)` (rent deposit capped at one month/period, applied to last rent period, mandatory annual interest at guideline rate)
   - `s. 108(a)–(b)` (prohibition on requiring post-dated cheques or automatic debit/payments)
   - `s. 134(1)` (illegal additional charges, fees, penalties, and key deposits unless prescribed)
2. **O. Reg. 516/06 (General), s. 17** — `https://www.ontario.ca/laws/regulation/060516` (verified via Internet Archive capture `https://web.archive.org/web/20261115210536id_/https://www.ontario.ca/laws/regulation/060516`):
   - `s. 17 para. 3`: exempts a refundable key, remote entry device, or card deposit not greater than expected direct replacement cost from RTA `s. 134(1)`.
3. **Canadian Anti-Fraud Centre (CAFC) — Merchandise / Rental Frauds** — `https://antifraudcentre-centreantifraude.ca/scams-fraudes/merchandise-marchandises-eng.htm` (fetched live HTTP 200):
   - Rental fraud indicators: below-average ("too good to be true") rent in ideal locations, urgency to send quick advance payment before viewing, out-of-town/unavailable landlord excuses, stolen photos, untraceable payment requests, and premature identity harvesting.

## Per-Item Index & Uncertainty

| ID | Group | Verdict | Scam | Clauses (violations) | Info topics | Uncertainty | Focus / Notes |
|---|---|---|---|---|---|---|---|
| `v3-01` | clean | ADMIT | 0 | — | `sublet_consent` | low | Casual Reddit post, Lester St, ensuite, off-site owner |
| `v3-02` | clean | ADMIT | 0 | — | `standard_lease` | low | Terse Kijiji bullet list, Phillip St, off-site mgmt |
| `v3-03` | clean | ADMIT | 0 | — | — | low | Emoji Facebook Marketplace post, Sunview St, pet-friendly |
| `v3-04` | clean | ADMIT | 0 | — | — | low | WhatsApp group forward, Columbia St W, utility split |
| `v3-05` | clean | ADMIT | 0 | — | `sublet_consent` | low | Chatty post with natural typos, University Ave W |
| `v3-06` | clean | ADMIT | 0 | — | `sublet_consent`, `standard_lease` | low | Whole 1BR Uptown Waterloo apartment on Erb St W |
| `v3-07` | clean | ADMIT | 0 | — | — | low | Short blunt student bulletin, Albert St |
| `v3-08` | clean | ADMIT | 0 | — | — | low | Kitchener King St W ION corridor condo room |
| `v3-09` | clean | ADMIT | 0 | — | `sublet_consent` | low | Structured bullet Kijiji post, Hickory St W |
| `v3-10` | clean | ADMIT | 0 | — | — | low | Warm roommate post, Seagram Dr, pet-friendly |
| `v3-11` | clean | ADMIT | 0 | — | `standard_lease` | low | Minimalist Slack/WhatsApp post, Spruce St |
| `v3-12` | clean | ADMIT | 0 | — | `sublet_consent` | low | Quiet low-rise corner room, Westmount Rd N |
| `v3-13` | scam_illegal | REFUSE | 1 | — | — | low | Overseas Dublin courier scam + $590 luxury 1BR |
| `v3-14` | scam_illegal | REFUSE | 1 | — | — | low | Urgency + Telegram-only + wire/USDT + passport/SIN |
| `v3-15` | scam_illegal | REFUSE | 1 | — | — | medium | Single subtle scam tactic: normal $975 rent, away in Vancouver, $450 e-Transfer before viewing |
| `v3-16` | scam_illegal | REFUSE | 1 | `damage_deposit`, `excess_rent_deposit` | — | low | Combined sob-story Western Union/gift-card scam + illegal deposits (REFUSE > HOLD) |
| `v3-17` | scam_illegal | HOLD | 0 | `damage_deposit` | — | low | Single subtle clause: "$300 room-condition bond" (RTA s. 105, s. 134) |
| `v3-18` | scam_illegal | HOLD | 0 | `no_pets` | `sublet_consent` | low | Single subtle clause: "furry-friends-free rule" (RTA s. 14) |
| `v3-19` | scam_illegal | HOLD | 0 | `postdated_cheques` | — | low | Single subtle clause: 4 pre-dated cheques or mandatory auto-debit (RTA s. 108) |
| `v3-20` | scam_illegal | HOLD | 0 | `entry_notice` | — | low | Single subtle clause: 1–2h text notice for bedroom entry (RTA s. 25, s. 27(1)) |
| `v3-21` | scam_illegal | HOLD | 0 | `maintenance_waiver` | — | low | Single subtle clause: rented "as-is", tenant pays repairs (RTA s. 20(1)-(2), s. 4(1)) |
| `v3-22` | scam_illegal | HOLD | 0 | `excess_rent_deposit`, `deposit_interest`, `lockout` | — | low | Multi-clause private landlord: 2-mo deposit, 0% interest/non-refundable, smart-lock lockout |
| `v3-23` | tricky | HOLD | 0 | — | `owner_shared` | low | Homeowner shares main-floor kitchen (RTA s. 5(i) exemption) |
| `v3-24` | tricky | ADMIT | 0 | — | `key_deposit` | low | Lawful $45 refundable fob deposit at direct cost (O. Reg. 516/06 s. 17 para. 3) |
| `v3-25` | tricky | ADMIT | 0 | — | `standard_lease`, `sublet_consent` | low | Lawful 1-month last-month rent deposit (RTA s. 106(1)-(2)) |
| `v3-26` | tricky | HOLD | 0 | — | — | medium | Clean terms + embedded prompt injection attempting to force `ADMIT` |
| `v3-27` | tricky | HOLD | 0 | — | — | low | Clean listing omitting street address (SPEC D4 unknown commute -> HOLD) |
| `v3-28` | tricky | HOLD | 0 | `damage_deposit`, `no_pets` | `key_deposit`, `sublet_consent`, `standard_lease` | low | Mixed lawful deposits + illegal damage deposit & no-pets clause |
| `v3-29` | tricky | REFUSE | 0 | — | `sublet_consent` | low | Clean Mandarin Chinese listing -> REFUSE per non-English policy |
| `v3-30` | tricky | HOLD | 0 | `deposit_interest` | `sublet_consent`, `standard_lease` | medium | ~520-word listing with buried "no annual interest / strictly non-refundable" deposit clause (RTA s. 106(6), s. 106(10)) |

Status: done
