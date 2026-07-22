# Sources & citations — vaxdue corpus

Corpus last verified: **2026-07-22**. Scope: birth to 24 months only.

vaxdue ships **two schedules, never blended**. Their provenance differs, and the
app labels each honestly (see the trust bar and the per-row `Source:` line).

---

## 1. NIS — National Immunization Schedule (provenance: **primary**)

- **Source:** Ministry of Health and Family Welfare (MoHFW), Government of India —
  *National Immunization Schedule (NIS) for Infants, Children and Pregnant Women*,
  published on the National Health Mission (NHM) portal.
- **URL:** https://nhm.gov.in/New_Updates_2018/NHM_Components/Immunization/report/National_%20Immunization_Schedule.pdf
- **Staged locally:** [`MoHFW-NIS-National-Immunization-Schedule.pdf`](./MoHFW-NIS-National-Immunization-Schedule.pdf)
- **How verified:** the official PDF was fetched at build time and its text extracted
  with `pdftotext`. Every NIS row in `data/schedule.js` is transcribed **verbatim**
  from the "When to give" column of the vaccine-wise table, including the footnotes:
  - `* PCV in selected states/districts` (Bihar, Himachal Pradesh, Madhya Pradesh,
    Rajasthan, selected districts of Uttar Pradesh; Haryana as state initiative)
  - `** JE in endemic districts only`
- **Rows in scope (birth–24m):** BCG, Hepatitis B birth dose, OPV-0/1/2/3,
  Pentavalent 1/2/3, RVV 1/2/3, fIPV 1/2, PCV 1/2/booster, MR 1/2, JE 1/2, Vitamin A,
  DPT booster-1, OPV booster. Rows at 5–6y, 10y, 16y and pregnant-mother Td are
  **out of scope** and were dropped.

The NIS table is treated as the fully-verified default corpus.

---

## 2. IAP — Indian Academy of Pediatrics recommended schedule (provenance: **secondary**)

- **Intended primary source:** *Indian Academy of Pediatrics (IAP) Advisory Committee
  on Vaccines and Immunization Practices (ACVIP): Recommended Immunization Schedule
  (2023)*, Indian Pediatrics.
  - PubMed: https://pubmed.ncbi.nlm.nih.gov/38243749/
  - Full text: https://indianpediatrics.net/epub012024/FTA-00592.pdf
    **(this PDF returned HTTP 403 at build time and could not be machine-transcribed.)**
- **What was used instead — two independent secondary sources that AGREE on the
  birth-to-24-month structure:**
  1. Sapling Hospitals — *IAP Immunization Schedule 2025: Guide for Parents*
     — https://saplinghospitals.com/blogs/iap-immunization-schedule-guide-parents
  2. Pharmatrek — *IAP Immunisation Chart*
     — https://www.pharmatrek.com/iap_immunisation.html
  - Cross-checked against fragments from medtalks.in and droracle.ai for the 2023 update
    notes (HPV for boys, Td at 16–18y — all outside the 0–2y scope).
- **How verified:** the two secondary sources were compared row by row; only doses on
  which both agree were encoded (BCG/OPV-0/HepB birth; DTwP-DTaP + IPV + Hib + HepB-2 +
  Rotavirus + PCV at 6/10/14 wk; HepB-3 at 6m; MMR-1 + TCV at 9m; HepA-1 at 12m;
  MMR-2 + Varicella + PCV booster at 15m; DTwP booster-1 + Hib booster + IPV booster at
  15–18m; HepA-2 at ~18–24m).
- **Honest label:** because the primary Indian Pediatrics table was not accessible for a
  verbatim read-back, every IAP row cites `IAP schedule` (not a specific edition/table
  string) and the app shows a persistent banner:
  *"IAP rows: cross-verified from secondary sources — confirm with your paediatrician."*
  The `META.iapProvenance` field is set to `secondary` and asserted in the tests.

---

## Verification discipline

- Any row that could not be verified from a source was **dropped, never guessed**
  (per the build contract's health-corpus rule — never fabricate a health number).
- Structural invariants (unique ids, a citation on every row, sequential `doseNum`,
  strictly increasing `dueOffset` within each series, counts in range, zero catch-up
  rows) are enforced by `test/vaxdue.test.js` so the corpus cannot silently rot.
- Schedules are revised over time. This corpus is a **dated snapshot**; the app displays
  the verified-on date and tells the user to confirm current recommendations at their clinic.
