/* ============================================================
   vaxdue — vaccination schedule corpus (birth to 2 years, India)
   ------------------------------------------------------------
   TWO schedules, never blended:
     NIS — National Immunization Schedule (Universal Immunization
           Programme, MoHFW). Government facilities, free.
           Transcribed VERBATIM from the official MoHFW/NHM PDF
           (see sources/CITATIONS.md, source verified 2026-07-22).
     IAP — Indian Academy of Pediatrics recommended schedule, the
           private-practice standard. Cross-verified from TWO
           agreeing secondary sources; the primary Indian Pediatrics
           full text was not machine-accessible at build time, so
           IAP rows are labelled provenance:"secondary" and the app
           shows a "verify with your paediatrician" banner.

   Scope: birth to 24 months only (v0.1). 2–18y is out of scope.
   Catch-up rows: ZERO by design — the app flags overdue but never
   re-plans a missed series (that needs a doctor).

   Fields per entry:
     id          stable slug, never renumbered
     schedule    'NIS' | 'IAP'
     vaccine     display name, verbatim from the source
     doseNum     dose ordinal within this vaccine+schedule series
     seriesTotal total doses of this vaccine in-scope for this schedule
     doseLabel   human label ('Dose 1 of 3' | 'Booster 1' | 'Birth dose')
     dueOffset   {weeks:n} | {months:n}  — offset from DOB
     windowEnd   nullable {weeks:n}|{months:n} — end of the acceptable range
     conditional nullable string transcribed from the source footnotes
     note        <=120 chars, only qualifiers actually printed in source
     cite        exact citation string rendered in the UI
   ============================================================ */

const META = {
  iapEdition: 'IAP recommended immunization schedule (Indian Academy of Pediatrics), birth to 2 years',
  nisEdition: 'National Immunization Schedule, Universal Immunization Programme, MoHFW (Government of India)',
  scope: 'Birth to 24 months only (v0.1). Catch-up and 2–18 years are out of scope.',
  verifiedOn: '2026-07-22',
  nisProvenance: 'primary',   // official MoHFW/NHM PDF, transcribed verbatim
  iapProvenance: 'secondary'  // two agreeing secondary sources; primary paper not accessible at build time
};

/* ---- helpers for windowEnd of dose-window rows (kept in the data, read by the engine) ---- */

const SCHEDULE = [
  /* =========================================================
     NIS — VERBATIM from the official MoHFW/NHM National
     Immunization Schedule PDF. "When to give" column quoted.
     ========================================================= */

  // Birth
  { id: 'nis-bcg', schedule: 'NIS', vaccine: 'BCG (Bacillus Calmette Guerin)',
    doseNum: 1, seriesTotal: 1, doseLabel: 'Birth dose',
    dueOffset: { weeks: 0 }, windowEnd: { months: 12 },
    conditional: null,
    note: 'At birth or as early as possible till one year of age.',
    cite: 'MoHFW NIS' },

  { id: 'nis-hepb-birth', schedule: 'NIS', vaccine: 'Hepatitis B — Birth dose',
    doseNum: 1, seriesTotal: 1, doseLabel: 'Birth dose',
    dueOffset: { weeks: 0 }, windowEnd: null,
    conditional: null,
    note: 'At birth or as early as possible within 24 hours.',
    cite: 'MoHFW NIS' },

  { id: 'nis-opv-0', schedule: 'NIS', vaccine: 'OPV (Oral Polio Vaccine)-0',
    doseNum: 1, seriesTotal: 4, doseLabel: 'Dose 0 (birth)',
    dueOffset: { weeks: 0 }, windowEnd: null,
    conditional: null,
    note: 'At birth or as early as possible within the first 15 days.',
    cite: 'MoHFW NIS' },

  // 6 weeks
  { id: 'nis-opv-1', schedule: 'NIS', vaccine: 'OPV (Oral Polio Vaccine)-0',
    doseNum: 2, seriesTotal: 4, doseLabel: 'Dose 1 of 3 (primary)',
    dueOffset: { weeks: 6 }, windowEnd: null,
    conditional: null, note: 'OPV can be given till 5 years of age.',
    cite: 'MoHFW NIS' },
  { id: 'nis-penta-1', schedule: 'NIS', vaccine: 'Pentavalent',
    doseNum: 1, seriesTotal: 3, doseLabel: 'Dose 1 of 3',
    dueOffset: { weeks: 6 }, windowEnd: { months: 12 },
    conditional: null, note: 'Can be given till one year of age.',
    cite: 'MoHFW NIS' },
  { id: 'nis-rvv-1', schedule: 'NIS', vaccine: 'Rotavirus (RVV)',
    doseNum: 1, seriesTotal: 3, doseLabel: 'Dose 1 of 3',
    dueOffset: { weeks: 6 }, windowEnd: { months: 12 },
    conditional: null, note: 'Can be given till one year of age.',
    cite: 'MoHFW NIS' },
  { id: 'nis-fipv-1', schedule: 'NIS', vaccine: 'fIPV (Fractional Inactivated Polio Vaccine)',
    doseNum: 1, seriesTotal: 2, doseLabel: 'Dose 1 of 2',
    dueOffset: { weeks: 6 }, windowEnd: null,
    conditional: null, note: 'Two fractional doses at 6 and 14 weeks of age.',
    cite: 'MoHFW NIS' },
  { id: 'nis-pcv-1', schedule: 'NIS', vaccine: 'PCV (Pneumococcal Conjugate Vaccine)',
    doseNum: 1, seriesTotal: 3, doseLabel: 'Dose 1 of 2 (primary)',
    dueOffset: { weeks: 6 }, windowEnd: null,
    conditional: 'PCV in selected states/districts (Bihar, Himachal Pradesh, Madhya Pradesh, Rajasthan, selected districts of Uttar Pradesh; Haryana as state initiative).',
    note: 'Two primary doses at 6 and 14 weeks, then booster at 9–12 months.',
    cite: 'MoHFW NIS' },

  // 10 weeks
  { id: 'nis-opv-2', schedule: 'NIS', vaccine: 'OPV (Oral Polio Vaccine)-0',
    doseNum: 3, seriesTotal: 4, doseLabel: 'Dose 2 of 3 (primary)',
    dueOffset: { weeks: 10 }, windowEnd: null,
    conditional: null, note: 'OPV can be given till 5 years of age.',
    cite: 'MoHFW NIS' },
  { id: 'nis-penta-2', schedule: 'NIS', vaccine: 'Pentavalent',
    doseNum: 2, seriesTotal: 3, doseLabel: 'Dose 2 of 3',
    dueOffset: { weeks: 10 }, windowEnd: { months: 12 },
    conditional: null, note: 'Can be given till one year of age.',
    cite: 'MoHFW NIS' },
  { id: 'nis-rvv-2', schedule: 'NIS', vaccine: 'Rotavirus (RVV)',
    doseNum: 2, seriesTotal: 3, doseLabel: 'Dose 2 of 3',
    dueOffset: { weeks: 10 }, windowEnd: { months: 12 },
    conditional: null, note: 'Can be given till one year of age.',
    cite: 'MoHFW NIS' },

  // 14 weeks
  { id: 'nis-opv-3', schedule: 'NIS', vaccine: 'OPV (Oral Polio Vaccine)-0',
    doseNum: 4, seriesTotal: 4, doseLabel: 'Dose 3 of 3 (primary)',
    dueOffset: { weeks: 14 }, windowEnd: null,
    conditional: null, note: 'OPV can be given till 5 years of age.',
    cite: 'MoHFW NIS' },
  { id: 'nis-penta-3', schedule: 'NIS', vaccine: 'Pentavalent',
    doseNum: 3, seriesTotal: 3, doseLabel: 'Dose 3 of 3',
    dueOffset: { weeks: 14 }, windowEnd: { months: 12 },
    conditional: null, note: 'Can be given till one year of age.',
    cite: 'MoHFW NIS' },
  { id: 'nis-fipv-2', schedule: 'NIS', vaccine: 'fIPV (Fractional Inactivated Polio Vaccine)',
    doseNum: 2, seriesTotal: 2, doseLabel: 'Dose 2 of 2',
    dueOffset: { weeks: 14 }, windowEnd: null,
    conditional: null, note: 'Two fractional doses at 6 and 14 weeks of age.',
    cite: 'MoHFW NIS' },
  { id: 'nis-rvv-3', schedule: 'NIS', vaccine: 'Rotavirus (RVV)',
    doseNum: 3, seriesTotal: 3, doseLabel: 'Dose 3 of 3',
    dueOffset: { weeks: 14 }, windowEnd: { months: 12 },
    conditional: null, note: 'Can be given till one year of age.',
    cite: 'MoHFW NIS' },
  { id: 'nis-pcv-2', schedule: 'NIS', vaccine: 'PCV (Pneumococcal Conjugate Vaccine)',
    doseNum: 2, seriesTotal: 3, doseLabel: 'Dose 2 of 2 (primary)',
    dueOffset: { weeks: 14 }, windowEnd: null,
    conditional: 'PCV in selected states/districts (Bihar, Himachal Pradesh, Madhya Pradesh, Rajasthan, selected districts of Uttar Pradesh; Haryana as state initiative).',
    note: 'Two primary doses at 6 and 14 weeks, then booster at 9–12 months.',
    cite: 'MoHFW NIS' },

  // 9-12 months
  { id: 'nis-mr-1', schedule: 'NIS', vaccine: 'Measles & Rubella (MR)',
    doseNum: 1, seriesTotal: 2, doseLabel: 'Dose 1 of 2',
    dueOffset: { months: 9 }, windowEnd: { months: 12 },
    conditional: null,
    note: '9 completed months–12 months. Measles can be given till 5 years of age.',
    cite: 'MoHFW NIS' },
  { id: 'nis-je-1', schedule: 'NIS', vaccine: 'Japanese Encephalitis (JE)',
    doseNum: 1, seriesTotal: 2, doseLabel: 'Dose 1 of 2',
    dueOffset: { months: 9 }, windowEnd: { months: 12 },
    conditional: 'JE in endemic districts only.',
    note: '9 completed months–12 months. Endemic districts only.',
    cite: 'MoHFW NIS' },
  { id: 'nis-pcv-booster', schedule: 'NIS', vaccine: 'PCV (Pneumococcal Conjugate Vaccine)',
    doseNum: 3, seriesTotal: 3, doseLabel: 'Booster',
    dueOffset: { months: 9 }, windowEnd: { months: 12 },
    conditional: 'PCV in selected states/districts (Bihar, Himachal Pradesh, Madhya Pradesh, Rajasthan, selected districts of Uttar Pradesh; Haryana as state initiative).',
    note: 'Booster dose at 9–12 months.',
    cite: 'MoHFW NIS' },
  { id: 'nis-vita-1', schedule: 'NIS', vaccine: 'Vitamin A',
    doseNum: 1, seriesTotal: 1, doseLabel: 'Dose 1',
    dueOffset: { months: 9 }, windowEnd: { months: 12 },
    conditional: null,
    note: 'At 9 completed months with measles–rubella.',
    cite: 'MoHFW NIS' },

  // 16-24 months
  { id: 'nis-mr-2', schedule: 'NIS', vaccine: 'Measles & Rubella (MR)',
    doseNum: 2, seriesTotal: 2, doseLabel: 'Dose 2 of 2',
    dueOffset: { months: 16 }, windowEnd: { months: 24 },
    conditional: null, note: '16–24 months.',
    cite: 'MoHFW NIS' },
  { id: 'nis-je-2', schedule: 'NIS', vaccine: 'Japanese Encephalitis (JE)',
    doseNum: 2, seriesTotal: 2, doseLabel: 'Dose 2 of 2',
    dueOffset: { months: 16 }, windowEnd: { months: 24 },
    conditional: 'JE in endemic districts only.',
    note: '16–24 months. Endemic districts only.',
    cite: 'MoHFW NIS' },
  { id: 'nis-dpt-booster-1', schedule: 'NIS', vaccine: 'DPT (Diphtheria, Pertussis & Tetanus) Booster',
    doseNum: 1, seriesTotal: 1, doseLabel: 'Booster 1',
    dueOffset: { months: 16 }, windowEnd: { months: 24 },
    conditional: null, note: '16–24 months.',
    cite: 'MoHFW NIS' },
  { id: 'nis-opv-booster', schedule: 'NIS', vaccine: 'OPV Booster',
    doseNum: 1, seriesTotal: 1, doseLabel: 'Booster',
    dueOffset: { months: 16 }, windowEnd: { months: 24 },
    conditional: null, note: '16–24 months.',
    cite: 'MoHFW NIS' },

  /* =========================================================
     IAP — recommended schedule, private-practice standard.
     provenance: secondary (two agreeing secondary sources).
     Cite reads "IAP schedule" and the app shows a banner
     asking the parent to confirm with their paediatrician.
     ========================================================= */

  // Birth
  { id: 'iap-bcg', schedule: 'IAP', vaccine: 'BCG',
    doseNum: 1, seriesTotal: 1, doseLabel: 'Birth dose',
    dueOffset: { weeks: 0 }, windowEnd: { months: 12 },
    conditional: null, note: 'At birth or as early as possible.',
    cite: 'IAP schedule' },
  { id: 'iap-opv-0', schedule: 'IAP', vaccine: 'OPV',
    doseNum: 1, seriesTotal: 1, doseLabel: 'Dose 0 (birth)',
    dueOffset: { weeks: 0 }, windowEnd: null,
    conditional: null, note: 'Birth dose.',
    cite: 'IAP schedule' },
  { id: 'iap-hepb-1', schedule: 'IAP', vaccine: 'Hepatitis B',
    doseNum: 1, seriesTotal: 3, doseLabel: 'Dose 1 of 3 (birth)',
    dueOffset: { weeks: 0 }, windowEnd: null,
    conditional: null, note: 'At birth.',
    cite: 'IAP schedule' },

  // 6 weeks
  { id: 'iap-dtwp-1', schedule: 'IAP', vaccine: 'DTwP / DTaP',
    doseNum: 1, seriesTotal: 3, doseLabel: 'Dose 1 of 3',
    dueOffset: { weeks: 6 }, windowEnd: null,
    conditional: null, note: 'Primary series dose 1.',
    cite: 'IAP schedule' },
  { id: 'iap-ipv-1', schedule: 'IAP', vaccine: 'IPV (Inactivated Polio Vaccine)',
    doseNum: 1, seriesTotal: 3, doseLabel: 'Dose 1 of 3',
    dueOffset: { weeks: 6 }, windowEnd: null,
    conditional: null, note: 'Primary series dose 1.',
    cite: 'IAP schedule' },
  { id: 'iap-hib-1', schedule: 'IAP', vaccine: 'Hib (Haemophilus influenzae type b)',
    doseNum: 1, seriesTotal: 3, doseLabel: 'Dose 1 of 3',
    dueOffset: { weeks: 6 }, windowEnd: null,
    conditional: null, note: 'Primary series dose 1.',
    cite: 'IAP schedule' },
  { id: 'iap-hepb-2', schedule: 'IAP', vaccine: 'Hepatitis B',
    doseNum: 2, seriesTotal: 3, doseLabel: 'Dose 2 of 3',
    dueOffset: { weeks: 6 }, windowEnd: null,
    conditional: null, note: 'Second dose.',
    cite: 'IAP schedule' },
  { id: 'iap-rota-1', schedule: 'IAP', vaccine: 'Rotavirus',
    doseNum: 1, seriesTotal: 3, doseLabel: 'Dose 1 of 3',
    dueOffset: { weeks: 6 }, windowEnd: null,
    conditional: 'Third dose depends on the rotavirus vaccine brand used.',
    note: 'Primary series dose 1.',
    cite: 'IAP schedule' },
  { id: 'iap-pcv-1', schedule: 'IAP', vaccine: 'PCV (Pneumococcal Conjugate Vaccine)',
    doseNum: 1, seriesTotal: 4, doseLabel: 'Dose 1 of 3',
    dueOffset: { weeks: 6 }, windowEnd: null,
    conditional: null, note: 'Primary series dose 1.',
    cite: 'IAP schedule' },

  // 10 weeks
  { id: 'iap-dtwp-2', schedule: 'IAP', vaccine: 'DTwP / DTaP',
    doseNum: 2, seriesTotal: 3, doseLabel: 'Dose 2 of 3',
    dueOffset: { weeks: 10 }, windowEnd: null,
    conditional: null, note: 'Primary series dose 2.',
    cite: 'IAP schedule' },
  { id: 'iap-ipv-2', schedule: 'IAP', vaccine: 'IPV (Inactivated Polio Vaccine)',
    doseNum: 2, seriesTotal: 3, doseLabel: 'Dose 2 of 3',
    dueOffset: { weeks: 10 }, windowEnd: null,
    conditional: null, note: 'Primary series dose 2.',
    cite: 'IAP schedule' },
  { id: 'iap-hib-2', schedule: 'IAP', vaccine: 'Hib (Haemophilus influenzae type b)',
    doseNum: 2, seriesTotal: 3, doseLabel: 'Dose 2 of 3',
    dueOffset: { weeks: 10 }, windowEnd: null,
    conditional: null, note: 'Primary series dose 2.',
    cite: 'IAP schedule' },
  { id: 'iap-rota-2', schedule: 'IAP', vaccine: 'Rotavirus',
    doseNum: 2, seriesTotal: 3, doseLabel: 'Dose 2 of 3',
    dueOffset: { weeks: 10 }, windowEnd: null,
    conditional: 'Third dose depends on the rotavirus vaccine brand used.',
    note: 'Primary series dose 2.',
    cite: 'IAP schedule' },
  { id: 'iap-pcv-2', schedule: 'IAP', vaccine: 'PCV (Pneumococcal Conjugate Vaccine)',
    doseNum: 2, seriesTotal: 4, doseLabel: 'Dose 2 of 3',
    dueOffset: { weeks: 10 }, windowEnd: null,
    conditional: null, note: 'Primary series dose 2.',
    cite: 'IAP schedule' },

  // 14 weeks
  { id: 'iap-dtwp-3', schedule: 'IAP', vaccine: 'DTwP / DTaP',
    doseNum: 3, seriesTotal: 3, doseLabel: 'Dose 3 of 3',
    dueOffset: { weeks: 14 }, windowEnd: null,
    conditional: null, note: 'Primary series dose 3.',
    cite: 'IAP schedule' },
  { id: 'iap-ipv-3', schedule: 'IAP', vaccine: 'IPV (Inactivated Polio Vaccine)',
    doseNum: 3, seriesTotal: 3, doseLabel: 'Dose 3 of 3',
    dueOffset: { weeks: 14 }, windowEnd: null,
    conditional: null, note: 'Primary series dose 3.',
    cite: 'IAP schedule' },
  { id: 'iap-hib-3', schedule: 'IAP', vaccine: 'Hib (Haemophilus influenzae type b)',
    doseNum: 3, seriesTotal: 3, doseLabel: 'Dose 3 of 3',
    dueOffset: { weeks: 14 }, windowEnd: null,
    conditional: null, note: 'Primary series dose 3.',
    cite: 'IAP schedule' },
  { id: 'iap-rota-3', schedule: 'IAP', vaccine: 'Rotavirus',
    doseNum: 3, seriesTotal: 3, doseLabel: 'Dose 3 of 3',
    dueOffset: { weeks: 14 }, windowEnd: null,
    conditional: 'Third dose depends on the rotavirus vaccine brand used.',
    note: 'Primary series dose 3.',
    cite: 'IAP schedule' },
  { id: 'iap-pcv-3', schedule: 'IAP', vaccine: 'PCV (Pneumococcal Conjugate Vaccine)',
    doseNum: 3, seriesTotal: 4, doseLabel: 'Dose 3 of 3',
    dueOffset: { weeks: 14 }, windowEnd: null,
    conditional: null, note: 'Primary series dose 3.',
    cite: 'IAP schedule' },

  // 6 months
  { id: 'iap-hepb-3', schedule: 'IAP', vaccine: 'Hepatitis B',
    doseNum: 3, seriesTotal: 3, doseLabel: 'Dose 3 of 3',
    dueOffset: { months: 6 }, windowEnd: null,
    conditional: null, note: 'Third dose.',
    cite: 'IAP schedule' },

  // 9 months
  { id: 'iap-mmr-1', schedule: 'IAP', vaccine: 'MMR (Measles, Mumps & Rubella)',
    doseNum: 1, seriesTotal: 2, doseLabel: 'Dose 1 of 2',
    dueOffset: { months: 9 }, windowEnd: { months: 12 },
    conditional: null, note: 'First dose at 9 completed months.',
    cite: 'IAP schedule' },
  { id: 'iap-tcv-1', schedule: 'IAP', vaccine: 'Typhoid Conjugate Vaccine (TCV)',
    doseNum: 1, seriesTotal: 1, doseLabel: 'Dose 1',
    dueOffset: { months: 9 }, windowEnd: { months: 12 },
    conditional: null, note: '9–12 months.',
    cite: 'IAP schedule' },

  // 12 months
  { id: 'iap-hepa-1', schedule: 'IAP', vaccine: 'Hepatitis A',
    doseNum: 1, seriesTotal: 2, doseLabel: 'Dose 1 of 2',
    dueOffset: { months: 12 }, windowEnd: null,
    conditional: null, note: 'First dose at 12 months.',
    cite: 'IAP schedule' },

  // 15 months
  { id: 'iap-mmr-2', schedule: 'IAP', vaccine: 'MMR (Measles, Mumps & Rubella)',
    doseNum: 2, seriesTotal: 2, doseLabel: 'Dose 2 of 2',
    dueOffset: { months: 15 }, windowEnd: null,
    conditional: null, note: 'Second dose at 15 months.',
    cite: 'IAP schedule' },
  { id: 'iap-varicella-1', schedule: 'IAP', vaccine: 'Varicella',
    doseNum: 1, seriesTotal: 1, doseLabel: 'Dose 1',
    dueOffset: { months: 15 }, windowEnd: null,
    conditional: 'A second varicella dose is given later (out of the 0–2y scope).',
    note: 'First dose at 15 months.',
    cite: 'IAP schedule' },
  { id: 'iap-pcv-booster', schedule: 'IAP', vaccine: 'PCV (Pneumococcal Conjugate Vaccine)',
    doseNum: 4, seriesTotal: 4, doseLabel: 'Booster',
    dueOffset: { months: 15 }, windowEnd: null,
    conditional: null, note: 'Booster at 12–15 months.',
    cite: 'IAP schedule' },

  // 18 months
  { id: 'iap-dtwp-booster-1', schedule: 'IAP', vaccine: 'DTwP / DTaP Booster',
    doseNum: 1, seriesTotal: 1, doseLabel: 'Booster 1',
    dueOffset: { months: 18 }, windowEnd: null,
    conditional: null, note: 'First booster at 15–18 months.',
    cite: 'IAP schedule' },
  { id: 'iap-hib-booster', schedule: 'IAP', vaccine: 'Hib (Haemophilus influenzae type b) Booster',
    doseNum: 1, seriesTotal: 1, doseLabel: 'Booster',
    dueOffset: { months: 18 }, windowEnd: null,
    conditional: null, note: 'Booster at 15–18 months.',
    cite: 'IAP schedule' },
  { id: 'iap-ipv-booster', schedule: 'IAP', vaccine: 'IPV (Inactivated Polio Vaccine) Booster',
    doseNum: 1, seriesTotal: 1, doseLabel: 'Booster',
    dueOffset: { months: 18 }, windowEnd: null,
    conditional: null, note: 'Booster at 15–18 months.',
    cite: 'IAP schedule' },

  // 24 months
  { id: 'iap-hepa-2', schedule: 'IAP', vaccine: 'Hepatitis A',
    doseNum: 2, seriesTotal: 2, doseLabel: 'Dose 2 of 2',
    dueOffset: { months: 18 }, windowEnd: { months: 24 },
    conditional: 'Two doses are given for killed Hep A vaccine, 6 months apart; single-dose live vaccine also exists.',
    note: 'Second dose 6 months after the first.',
    cite: 'IAP schedule' }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SCHEDULE, META };
}
