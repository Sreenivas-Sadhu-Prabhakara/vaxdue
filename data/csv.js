/* ============================================================
   vaxdue — RFC-4180 CSV serialise + parse (pure, shared).
   ============================================================ */

function csvCell(v) {
  const s = v == null ? '' : String(v);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCSV(rows /* array of arrays */) {
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}

/* RFC-4180 parser: handles quoting, embedded commas/quotes/newlines. */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', i = 0, inQuotes = false;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  // flush last field/row if any content
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* Build the schedule export rows for a given generated schedule.
   `records` = [{ vaccine, doseLabel, schedule, dueDate, windowEnd,
                  status, givenOn, conditional, note, cite }] */
function scheduleCSV(childName, dob, scheduleName, records) {
  const header = ['Vaccine', 'Dose', 'Schedule', 'Due date', 'Window end',
    'Status', 'Given on', 'Conditional', 'Note', 'Source'];
  const rows = [header];
  for (const r of records) {
    rows.push([
      r.vaccine, r.doseLabel, r.schedule, r.dueDate, r.windowEnd || '',
      r.status, r.givenOn || 'pending', r.conditional || '', r.note || '', r.cite
    ]);
  }
  return toCSV(rows);
}

const CSV = { csvCell, toCSV, parseCSV, scheduleCSV };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CSV;
}
