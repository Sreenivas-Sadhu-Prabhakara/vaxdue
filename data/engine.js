/* ============================================================
   vaxdue — date + status engine (pure functions, no I/O)
   Shared by the app (browser global) and Node self-tests.
   All dates are ISO 'YYYY-MM-DD' strings. Arithmetic is done
   on integer Y/M/D fields, never on a floating Date timestamp,
   so it is timezone-independent and deterministic.
   ============================================================ */

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
}
function daysInMonth(y, m /* 1-12 */) {
  if (m === 2 && isLeap(y)) return 29;
  return DAYS_IN_MONTH[m - 1];
}

/* Strict ISO parse -> {y,m,d} or throws. Rejects malformed / impossible dates. */
function parseISO(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new Error('Invalid ISO date: ' + iso);
  }
  const y = +iso.slice(0, 4), m = +iso.slice(5, 7), d = +iso.slice(8, 10);
  if (m < 1 || m > 12) throw new Error('Invalid month: ' + iso);
  if (d < 1 || d > daysInMonth(y, m)) throw new Error('Invalid day: ' + iso);
  return { y, m, d };
}

function pad(n) { return String(n).padStart(2, '0'); }
function toISO(y, m, d) { return `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`; }

/* Add N whole days to an ISO date. Handles month/year/leap rollover. */
function addDays(iso, n) {
  let { y, m, d } = parseISO(iso);
  d += n;
  while (d > daysInMonth(y, m)) {
    d -= daysInMonth(y, m);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  while (d < 1) {
    m -= 1;
    if (m < 1) { m = 12; y -= 1; }
    d += daysInMonth(y, m);
  }
  return toISO(y, m, d);
}

function addWeeks(iso, n) { return addDays(iso, n * 7); }

/* Add N calendar months, clamping the day to the target month's last day
   (Jan 31 + 1 month -> Feb 28/29). */
function addMonths(iso, n) {
  let { y, m, d } = parseISO(iso);
  let total = (y * 12 + (m - 1)) + n;
  y = Math.floor(total / 12);
  m = (total % 12) + 1;
  const maxD = daysInMonth(y, m);
  if (d > maxD) d = maxD;
  return toISO(y, m, d);
}

/* Whole-days difference b - a (can be negative). */
function daysBetween(aISO, bISO) {
  return toEpochDay(bISO) - toEpochDay(aISO);
}
function toEpochDay(iso) {
  const { y, m, d } = parseISO(iso);
  // days from 0000-03-01 style; simple accumulation is fine for our range.
  let days = d - 1;
  for (let mm = 1; mm < m; mm++) days += daysInMonth(y, mm);
  for (let yy = 0; yy < y; yy++) days += isLeap(yy) ? 366 : 365;
  return days;
}

/* dueDate: apply an entry's dueOffset to a DOB. weeks or months. */
function dueDate(entry, dob) {
  const off = entry.dueOffset || {};
  if (typeof off.weeks === 'number') return addWeeks(dob, off.weeks);
  if (typeof off.months === 'number') return addMonths(dob, off.months);
  throw new Error('Entry ' + (entry.id || '?') + ' has no valid dueOffset');
}

/* windowEndDate: nullable acceptable-range end (same shape as dueOffset). */
function windowEndDate(entry, dob) {
  const w = entry.windowEnd;
  if (!w) return null;
  if (typeof w.weeks === 'number') return addWeeks(dob, w.weeks);
  if (typeof w.months === 'number') return addMonths(dob, w.months);
  return null;
}

/* offsetInDays: normalise an offset to a day count for monotonicity checks.
   Uses a nominal 30.4375 average only for cross-unit comparison ordering;
   NEVER used to compute an actual due date. */
function offsetInDays(off) {
  if (typeof off.weeks === 'number') return off.weeks * 7;
  if (typeof off.months === 'number') return Math.round(off.months * 30.4375);
  return NaN;
}

/* Status of one dose given a DOB and 'today' (both ISO), plus a done flag.
   Returns one of: 'done' | 'overdue' | 'due' | 'upcoming'.
     done     -> the caller marked it given
     overdue  -> not done, today is past the acceptable window
                 (past windowEnd if present, else past the due date)
     due      -> not done, today is on/after the due date and within window
     upcoming -> not done, due date is in the future */
function doseStatus(entry, dob, todayISO, done) {
  if (done) return 'done';
  const due = dueDate(entry, dob);
  const wEnd = windowEndDate(entry, dob);
  const dToday = toEpochDay(todayISO);
  const dDue = toEpochDay(due);
  if (dToday < dDue) return 'upcoming';
  // today >= due date
  const cutoff = wEnd ? toEpochDay(wEnd) : dDue;
  if (dToday > cutoff) return 'overdue';
  return 'due';
}

const ENGINE = {
  isLeap, daysInMonth, parseISO, toISO, addDays, addWeeks, addMonths,
  daysBetween, toEpochDay, dueDate, windowEndDate, offsetInDays, doseStatus
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ENGINE;
}
