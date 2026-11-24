Regression suite written alongside the code (development data). Not a held-out accuracy number.

# Safety suite

Git SHA: c055d26828c644a0e32df8d3fb16a64eacc75c6e
Date: 2026-11-24T20:30:04.024Z
Tests: 83 passed, 0 failed, 0 skipped.
Minimal pairs: 35. Known failures: 3 (asserted).

| Family or suite | Regression status | Known failing pairs |
|---|---|---|
| damage_deposit | PASS | 0 |
| excess_rent_deposit | PASS | 0 |
| key_deposit | KNOWN FAIL | 3 |
| no_pets | PASS | 0 |
| entry_notice | PASS | 0 |
| postdated_cheques | PASS | 0 |
| maintenance_waiver | PASS | 0 |
| lockout | PASS | 0 |
| injection | PASS | 0 |
| headline.test.ts | PASS | 0 |
| hero.test.ts | PASS | 0 |
| jurisdiction.test.ts | PASS | 0 |
| published-claims.test.ts | PASS | 0 |
| Mixed lawful and unlawful terms | PASS | 0 |

## Known failures
- key_deposit-1: Key-deposit policy is informational, so unlawful deposits do not trigger blocking review.
- key_deposit-2: Key-deposit policy is informational, so unlawful deposits do not trigger blocking review. Equal-cost numeric proposal is also retained as information instead of rejected.
- key_deposit-3: Key-deposit policy is informational, so unlawful deposits do not trigger blocking review.

Live paths use a stub and make no provider calls.
