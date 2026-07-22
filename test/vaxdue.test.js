'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const E = require('../data/engine.js');
const { SCHEDULE, META } = require('../data/schedule.js');
const CSV = require('../data/csv.js');

/* ---------------------------------------------------------------
   Calendar arithmetic — the paisa/day core
   --------------------------------------------------------------- */

test('addWeeks: 6-week dose lands exactly DOB+42 days', () => {
  assert.equal(E.addWeeks('2026-01-15', 6), '2026-02-26');
  // sanity: 42 days later
  assert.equal(E.daysBetween('2026-01-15', '2026-02-26'), 42);
});

test('addMonths clamps month-ends and handles leap years', () => {
  assert.equal(E.addMonths('2025-01-31', 1), '2025-02-28');
  assert.equal(E.addMonths('2024-01-31', 1), '2024-02-29'); // leap
  assert.equal(E.addMonths('2025-08-31', 1), '2025-09-30');
  // year rollover
  assert.equal(E.addMonths('2025-12-15', 1), '2026-01-15');
  assert.equal(E.addMonths('2025-11-30', 3), '2026-02-28');
});

test('addDays rolls across month, year and leap boundaries', () => {
  assert.equal(E.addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(E.addDays('2025-02-28', 1), '2025-03-01');
  assert.equal(E.addDays('2025-12-31', 1), '2026-01-01');
  assert.equal(E.addDays('2026-01-01', -1), '2025-12-31');
});

test('parseISO rejects malformed and impossible dates', () => {
  assert.throws(() => E.parseISO('2026-13-01'));
  assert.throws(() => E.parseISO('2025-02-29')); // not a leap year
  assert.throws(() => E.parseISO('2026-1-1'));
  assert.throws(() => E.parseISO('not-a-date'));
  assert.doesNotThrow(() => E.parseISO('2024-02-29'));
});

/* ---------------------------------------------------------------
   Birth doses land exactly on the DOB
   --------------------------------------------------------------- */

test('birth doses (weeks:0) fall exactly on the DOB', () => {
  const dob = '2026-03-10';
  const births = SCHEDULE.filter(e => e.dueOffset.weeks === 0);
  assert.ok(births.length >= 3, 'expected BCG / OPV-0 / HepB-birth style rows');
  for (const e of births) {
    assert.equal(E.dueDate(e, dob), dob, `${e.id} should be due on the DOB`);
  }
});

/* ---------------------------------------------------------------
   Status engine — today frozen at 2026-07-01
   --------------------------------------------------------------- */

test('status engine: overdue / due / upcoming / done with a frozen today', () => {
  const today = '2026-07-01';
  const dob = '2026-01-01'; // irrelevant to the synthetic entries below

  const noWindow = (due) => ({ id: 't', dueOffset: null, windowEnd: null, _due: due });
  // Build synthetic entries by monkeypatching dueDate via wrapper:
  function statusFor(dueISO, windowEndISO, done) {
    const entry = {
      id: 't',
      dueOffset: { weeks: E.daysBetween(dob, dueISO) / 7 }, // exact weeks offset
      windowEnd: windowEndISO
        ? { weeks: E.daysBetween(dob, windowEndISO) / 7 }
        : null
    };
    return E.doseStatus(entry, dob, today, done);
  }

  // unchecked, due 2026-06-01, no window -> overdue
  assert.equal(statusFor('2026-06-01', null, false), 'overdue');
  // due exactly today -> due
  assert.equal(statusFor('2026-07-01', null, false), 'due');
  // due 2026-06-01 with window end 2026-08-01 -> still due (inside window)
  assert.equal(statusFor('2026-06-01', '2026-08-01', false), 'due');
  // due in the future -> upcoming
  assert.equal(statusFor('2026-08-01', null, false), 'upcoming');
  // checked -> done in every case
  assert.equal(statusFor('2026-06-01', null, true), 'done');
  assert.equal(statusFor('2026-07-01', null, true), 'done');
  assert.equal(statusFor('2026-06-01', '2026-08-01', true), 'done');
  assert.equal(statusFor('2026-08-01', null, true), 'done');
});

test('status engine: past the window end is overdue', () => {
  const dob = '2026-01-01', today = '2026-09-01';
  const entry = { id: 'w', dueOffset: { months: 4 }, windowEnd: { months: 6 } };
  // due 2026-05-01, window end 2026-07-01, today 2026-09-01 -> overdue
  assert.equal(E.doseStatus(entry, dob, today, false), 'overdue');
});

/* ---------------------------------------------------------------
   Corpus invariants
   --------------------------------------------------------------- */

test('all ids are unique', () => {
  const ids = SCHEDULE.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every entry has a non-empty cite matching a known schedule string', () => {
  for (const e of SCHEDULE) {
    assert.ok(e.cite && e.cite.length > 0, `${e.id} missing cite`);
    assert.ok(/MoHFW NIS|IAP schedule/.test(e.cite), `${e.id} cite unexpected: ${e.cite}`);
  }
});

test('cite matches the schedule field', () => {
  for (const e of SCHEDULE) {
    if (e.schedule === 'NIS') assert.match(e.cite, /MoHFW NIS/);
    if (e.schedule === 'IAP') assert.match(e.cite, /IAP schedule/);
  }
});

test('doseNum runs 1..seriesTotal within each vaccine+schedule series', () => {
  const groups = new Map();
  for (const e of SCHEDULE) {
    const k = e.schedule + '|' + e.vaccine;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  for (const [k, arr] of groups) {
    arr.sort((a, b) => a.doseNum - b.doseNum);
    const nums = arr.map(e => e.doseNum);
    // sequential 1..N with no gaps or dups
    for (let i = 0; i < nums.length; i++) {
      assert.equal(nums[i], i + 1, `${k} doseNum sequence broken at index ${i}: ${nums.join(',')}`);
    }
    // seriesTotal consistent within the group and >= max doseNum
    const maxNum = nums[nums.length - 1];
    for (const e of arr) {
      assert.ok(e.seriesTotal >= maxNum, `${e.id} seriesTotal ${e.seriesTotal} < maxDoseNum ${maxNum}`);
    }
  }
});

test('dueOffset (in days) strictly increases within each series', () => {
  const groups = new Map();
  for (const e of SCHEDULE) {
    const k = e.schedule + '|' + e.vaccine;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  for (const [k, arr] of groups) {
    arr.sort((a, b) => a.doseNum - b.doseNum);
    for (let i = 1; i < arr.length; i++) {
      const prev = E.offsetInDays(arr[i - 1].dueOffset);
      const cur = E.offsetInDays(arr[i].dueOffset);
      assert.ok(cur > prev, `${k}: offset not strictly increasing (${prev} -> ${cur})`);
    }
  }
});

test('schedule counts are in the pitched ranges', () => {
  const nis = SCHEDULE.filter(e => e.schedule === 'NIS').length;
  const iap = SCHEDULE.filter(e => e.schedule === 'IAP').length;
  assert.ok(iap >= 26 && iap <= 40, `IAP count ${iap} out of range`);
  assert.ok(nis >= 22 && nis <= 28, `NIS count ${nis} out of range`);
});

test('zero catch-up rows (out of scope by design)', () => {
  for (const e of SCHEDULE) {
    const blob = JSON.stringify(e).toLowerCase();
    assert.ok(!/catch[- ]?up/.test(blob), `${e.id} references catch-up`);
  }
});

test('every entry has a valid dueOffset (weeks XOR months)', () => {
  for (const e of SCHEDULE) {
    const off = e.dueOffset || {};
    const hasW = typeof off.weeks === 'number';
    const hasM = typeof off.months === 'number';
    assert.ok(hasW !== hasM, `${e.id} must have exactly one of weeks/months`);
  }
});

test('metadata carries editions, verified-on date, and provenance labels', () => {
  assert.match(META.verifiedOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.doesNotThrow(() => E.parseISO(META.verifiedOn));
  assert.ok(META.nisEdition.length > 0 && META.iapEdition.length > 0);
  assert.equal(META.nisProvenance, 'primary');
  assert.equal(META.iapProvenance, 'secondary');
});

/* NIS corpus honesty: the well-known UIP birth+6/10/14-week rows must exist */
test('NIS corpus contains the anchor UIP rows verbatim', () => {
  const ids = new Set(SCHEDULE.map(e => e.id));
  for (const id of ['nis-bcg', 'nis-hepb-birth', 'nis-opv-0',
    'nis-penta-1', 'nis-penta-2', 'nis-penta-3',
    'nis-fipv-1', 'nis-fipv-2', 'nis-mr-1', 'nis-mr-2',
    'nis-dpt-booster-1', 'nis-opv-booster']) {
    assert.ok(ids.has(id), `NIS missing anchor row ${id}`);
  }
  // Pentavalent primary lands at 6/10/14 weeks exactly
  const dob = '2026-01-01';
  const p1 = SCHEDULE.find(e => e.id === 'nis-penta-1');
  const p2 = SCHEDULE.find(e => e.id === 'nis-penta-2');
  const p3 = SCHEDULE.find(e => e.id === 'nis-penta-3');
  assert.equal(E.dueDate(p1, dob), E.addWeeks(dob, 6));
  assert.equal(E.dueDate(p2, dob), E.addWeeks(dob, 10));
  assert.equal(E.dueDate(p3, dob), E.addWeeks(dob, 14));
});

/* Conditional flags are transcribed, not invented: JE must be endemic-only */
test('JE rows carry the endemic-districts conditional', () => {
  const je = SCHEDULE.filter(e => /Japanese Encephalitis/.test(e.vaccine));
  assert.ok(je.length > 0);
  for (const e of je) assert.match(e.conditional || '', /endemic/i);
});

/* ---------------------------------------------------------------
   Full-schedule generation
   --------------------------------------------------------------- */

function generate(dob, scheduleName) {
  return SCHEDULE.filter(e => e.schedule === scheduleName).map(e => ({
    id: e.id,
    vaccine: e.vaccine,
    doseLabel: e.doseLabel,
    schedule: e.schedule,
    dueDate: E.dueDate(e, dob),
    windowEnd: E.windowEndDate(e, dob),
    conditional: e.conditional,
    note: e.note,
    cite: e.cite
  }));
}

test('full-schedule generation: row count matches corpus, all dates valid & >= DOB', () => {
  const dob = '2026-01-01';
  for (const name of ['NIS', 'IAP']) {
    const corpusCount = SCHEDULE.filter(e => e.schedule === name).length;
    const gen = generate(dob, name);
    assert.equal(gen.length, corpusCount);
    for (const r of gen) {
      assert.doesNotThrow(() => E.parseISO(r.dueDate));
      assert.ok(E.daysBetween(dob, r.dueDate) >= 0, `${r.id} due before DOB`);
      if (r.windowEnd) {
        assert.doesNotThrow(() => E.parseISO(r.windowEnd));
        assert.ok(E.daysBetween(r.dueDate, r.windowEnd) >= 0,
          `${r.id} windowEnd before dueDate`);
      }
    }
  }
});

/* ---------------------------------------------------------------
   Property / fuzz — thousands of random DOBs stay consistent
   --------------------------------------------------------------- */

function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('property fuzz: 3000 random DOBs generate valid, ordered, non-negative schedules', () => {
  const rnd = mulberry32(cyrb53('vaxdue-fuzz'));
  for (let iter = 0; iter < 3000; iter++) {
    const y = 2018 + Math.floor(rnd() * 12);          // 2018..2029
    const m = 1 + Math.floor(rnd() * 12);
    const d = 1 + Math.floor(rnd() * E.daysInMonth(y, m));
    const dob = E.toISO(y, m, d);
    const name = rnd() < 0.5 ? 'NIS' : 'IAP';
    const gen = generate(dob, name);
    for (const r of gen) {
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(r.dueDate), `bad date ${r.dueDate}`);
      assert.doesNotThrow(() => E.parseISO(r.dueDate));
      assert.ok(E.daysBetween(dob, r.dueDate) >= 0);
      assert.ok(!Number.isNaN(E.toEpochDay(r.dueDate)));
    }
    // within each series, generated dates are non-decreasing
    const byVac = new Map();
    for (const e of SCHEDULE.filter(x => x.schedule === name)) {
      const k = e.vaccine;
      if (!byVac.has(k)) byVac.set(k, []);
      byVac.get(k).push(e);
    }
    for (const [, arr] of byVac) {
      arr.sort((a, b) => a.doseNum - b.doseNum);
      for (let i = 1; i < arr.length; i++) {
        const a = E.dueDate(arr[i - 1], dob), b = E.dueDate(arr[i], dob);
        assert.ok(E.daysBetween(a, b) >= 0, `${arr[i].id} earlier than prev dose`);
      }
    }
  }
});

/* ---------------------------------------------------------------
   CSV export
   --------------------------------------------------------------- */

test('CSV export: line count === rows + 1 header, includes a BCG row', () => {
  const dob = '2026-01-01';
  const gen = generate(dob, 'NIS').map(r => ({
    ...r,
    status: 'upcoming',
    givenOn: r.id === 'nis-bcg' ? '2026-01-02' : null
  }));
  const csv = CSV.scheduleCSV('Baby', dob, 'NIS', gen);
  const lines = csv.split('\r\n');
  assert.equal(lines.length, gen.length + 1);
  assert.match(lines[0], /^Vaccine,/);
  assert.ok(lines.some(l => /BCG/.test(l)), 'expected a BCG row');
});

test('CSV export: given dose serialises its date, unmarked serialises pending', () => {
  const dob = '2026-01-01';
  const gen = generate(dob, 'NIS').map(r => ({
    ...r, status: 'done',
    givenOn: r.id === 'nis-bcg' ? '2026-01-02' : null
  }));
  const csv = CSV.scheduleCSV('Baby', dob, 'NIS', gen);
  const rows = CSV.parseCSV(csv);
  const header = rows[0];
  const givenIdx = header.indexOf('Given on');
  const bcgRow = rows.find(r => /BCG/.test(r[0]));
  assert.equal(bcgRow[givenIdx], '2026-01-02');
  const pendingRow = rows.find(r => r[givenIdx] === 'pending');
  assert.ok(pendingRow, 'expected at least one pending dose');
});

test('CSV round-trip: a child name with comma and quotes survives quoting', () => {
  const rows = [
    ['Name', 'Note'],
    ['O\'Brien, "twins"', 'line1\nline2']
  ];
  const csv = CSV.toCSV(rows);
  const back = CSV.parseCSV(csv);
  assert.deepEqual(back, rows);
});
