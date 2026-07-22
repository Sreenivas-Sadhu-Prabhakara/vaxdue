/* ============================================================
   vaxdue — app logic. No inline handlers (CSP forbids them).
   Reads the SCHEDULE/META corpus and the shared date engine.
   State lives in localStorage only; the CSP blocks all network.
   ============================================================ */
(function () {
  'use strict';

  var E = (typeof ENGINE !== 'undefined') ? ENGINE : require('./data/engine.js');
  var CORP = (typeof SCHEDULE !== 'undefined') ? { SCHEDULE: SCHEDULE, META: META }
                                               : require('./data/schedule.js');
  var CSVLIB = (typeof CSV !== 'undefined') ? CSV : require('./data/csv.js');
  var SCHED = CORP.SCHEDULE, METADATA = CORP.META;

  var NS = 'vaxdue.v1';
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- storage ---------- */
  function loadState() {
    try {
      var raw = localStorage.getItem(NS);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }
  function saveState() {
    try { localStorage.setItem(NS, JSON.stringify(state)); }
    catch (e) { /* storage may be full/blocked — app still works in-memory */ }
  }

  /* state shape:
     { activeId, schedule, profiles: { <id>: { name, dob, given: { <doseId>: givenOnISO|true } } } } */
  var state = loadState() || {
    activeId: null,
    schedule: 'IAP',
    profiles: {}
  };

  function activeProfile() {
    return state.activeId ? state.profiles[state.activeId] : null;
  }

  function newId() {
    return 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  }

  /* ---------- today (local calendar date as ISO) ---------- */
  function todayISO() {
    var d = new Date();
    return E.toISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  /* ---------- rendering helpers ---------- */
  var STATUS_META = {
    done:     { label: 'Done',     glyph: '✓', cls: 'done' },
    due:      { label: 'Due now',  glyph: '●', cls: 'due' },
    overdue:  { label: 'Overdue',  glyph: '⚠', cls: 'overdue' },
    upcoming: { label: 'Upcoming', glyph: '○', cls: 'upcoming' }
  };
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function prettyDate(iso) {
    var p = iso.split('-');
    return parseInt(p[2], 10) + ' ' + MONTHS[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }

  /* ---------- schedule generation ---------- */
  function rowsFor(dob, scheduleName) {
    return SCHED.filter(function (e) { return e.schedule === scheduleName; })
      .map(function (e) {
        return {
          id: e.id,
          vaccine: e.vaccine,
          doseLabel: e.doseLabel,
          schedule: e.schedule,
          dueDate: E.dueDate(e, dob),
          windowEnd: E.windowEndDate(e, dob),
          conditional: e.conditional,
          note: e.note,
          cite: e.cite
        };
      })
      .sort(function (a, b) { return E.daysBetween(b.dueDate, a.dueDate); });
  }

  function statusOf(row, dob, given) {
    var entry = SCHED.find(function (e) { return e.id === row.id; });
    var done = !!(given && given[row.id]);
    return E.doseStatus(entry, dob, todayISO(), done);
  }

  /* ---------- main render ---------- */
  function render() {
    renderProfiles();
    renderTrust();
    var prof = activeProfile();
    var tl = $('timeline'), empty = $('chartEmpty'), sumBody = $('summaryBody');

    // reflect schedule radio + fields
    var radios = document.querySelectorAll('input[name="schedule"]');
    Array.prototype.forEach.call(radios, function (r) { r.checked = (r.value === state.schedule); });

    if (!prof || !prof.dob) {
      tl.innerHTML = '';
      empty.hidden = false;
      sumBody.innerHTML = '<p class="summary__none">Enter a date of birth to see what needs attention.</p>';
      $('ageHint').textContent = '';
      return;
    }
    empty.hidden = true;

    var rows = rowsFor(prof.dob, state.schedule);
    var given = prof.given || {};

    // age hint
    var ageDays = E.daysBetween(prof.dob, todayISO());
    $('ageHint').textContent = ageDays >= 0
      ? 'Age today: ' + describeAge(ageDays)
      : 'Date of birth is in the future.';

    // summary strip — overdue + due
    var attn = rows.map(function (r) { return { r: r, s: statusOf(r, prof.dob, given) }; })
      .filter(function (x) { return x.s === 'overdue' || x.s === 'due'; });
    attn.sort(function (a, b) {
      if (a.s !== b.s) return a.s === 'overdue' ? -1 : 1;
      return E.daysBetween(b.r.dueDate, a.r.dueDate);
    });
    if (!attn.length) {
      sumBody.innerHTML = '<p class="summary__none">✓ Nothing overdue or due right now for this schedule.</p>';
    } else {
      sumBody.innerHTML = '';
      attn.forEach(function (x) {
        var row = document.createElement('div');
        row.className = 'summary__row summary__row--' + x.s;
        row.innerHTML =
          '<span class="chip chip--' + STATUS_META[x.s].cls + '">' +
            '<span class="chip__glyph" aria-hidden="true">' + STATUS_META[x.s].glyph + '</span>' +
            esc(STATUS_META[x.s].label) + '</span>' +
          '<span class="summary__vac">' + esc(x.r.vaccine) + '</span>' +
          '<span class="summary__meta">' + esc(x.r.doseLabel) + ' &middot; due ' + esc(prettyDate(x.r.dueDate)) + '</span>';
        sumBody.appendChild(row);
      });
    }

    // timeline
    tl.innerHTML = '';
    rows.forEach(function (r) {
      var s = statusOf(r, prof.dob, given);
      var done = s === 'done';
      var li = document.createElement('li');
      li.className = 'dose' + (done ? ' dose--done' : '');

      var html =
        '<div class="dose__head">' +
          '<span class="dose__vaccine">' + esc(r.vaccine) + '</span>' +
          '<span class="dose__label">' + esc(r.doseLabel) + '</span>' +
          '<span class="dose__date">' + esc(prettyDate(r.dueDate)) +
            (r.windowEnd ? '<span class="dose__window">give by ' + esc(prettyDate(r.windowEnd)) + '</span>' : '') +
          '</span>' +
        '</div>';

      if (r.conditional) {
        html += '<p class="dose__cond"><b>Conditional:</b> ' + esc(r.conditional) + '</p>';
      }
      if (r.note) html += '<p class="dose__note">' + esc(r.note) + '</p>';
      html += '<p class="dose__cite">Source: ' + esc(r.cite) + '</p>';

      var givenVal = given[r.id];
      var givenOn = (typeof givenVal === 'string') ? givenVal : '';
      html +=
        '<div class="dose__foot">' +
          '<span class="chip chip--' + STATUS_META[s].cls + '">' +
            '<span class="chip__glyph" aria-hidden="true">' + STATUS_META[s].glyph + '</span>' +
            esc(STATUS_META[s].label) + '</span>' +
          '<label class="give">' +
            '<input type="checkbox" data-dose="' + esc(r.id) + '"' + (done ? ' checked' : '') + '>' +
            '<span>Mark given</span>' +
          '</label>' +
          (done
            ? '<input type="date" class="given-date" data-dosedate="' + esc(r.id) + '" value="' + esc(givenOn) + '" aria-label="Given-on date for ' + esc(r.vaccine) + '">'
            : '') +
        '</div>';

      li.innerHTML = html;
      tl.appendChild(li);
    });

    // print header (only visible when printing)
    var ph = $('printHead');
    ph.innerHTML =
      '<h2>Vaccination schedule' + (prof.name ? ' — ' + esc(prof.name) : '') + '</h2>' +
      '<p>Date of birth: ' + esc(prettyDate(prof.dob)) + ' &middot; ' +
      esc(state.schedule === 'IAP' ? METADATA.iapEdition : METADATA.nisEdition) + '</p>' +
      '<p>Verified on ' + esc(METADATA.verifiedOn) + '. Informational only — your paediatrician overrides this chart. Catch-up excluded.</p>';
  }

  function describeAge(days) {
    if (days < 14) return days + ' day' + (days === 1 ? '' : 's');
    if (days < 70) return Math.floor(days / 7) + ' weeks';
    var months = Math.floor(days / 30.4375);
    if (months < 24) return months + ' months';
    return Math.floor(months / 12) + ' years';
  }

  function renderTrust() {
    var isIAP = state.schedule === 'IAP';
    $('trustEdition').textContent = isIAP ? METADATA.iapEdition : METADATA.nisEdition;
    $('trustVerified').textContent = 'Corpus last verified on ' + METADATA.verifiedOn +
      '. Each dose row shows its source citation.';
    var badge = $('trustProvenance');
    if (isIAP) {
      badge.textContent = 'IAP rows: cross-verified from secondary sources — confirm with your paediatrician';
      badge.className = 'trust__badge';
    } else {
      badge.textContent = 'NIS rows: transcribed from the official MoHFW / NHM schedule';
      badge.className = 'trust__badge trust__badge--verified';
    }
  }

  function renderProfiles() {
    var wrap = $('profiles');
    wrap.innerHTML = '';
    var ids = Object.keys(state.profiles);
    ids.forEach(function (id) {
      var p = state.profiles[id];
      var el = document.createElement('span');
      el.className = 'profile' + (id === state.activeId ? ' profile--active' : '');
      var name = p.name || 'Unnamed';
      el.innerHTML =
        '<button type="button" class="profile__pick" data-pick="' + esc(id) + '">' +
          esc(name) + (p.dob ? ' · ' + esc(prettyDate(p.dob)) : '') + '</button>' +
        '<button type="button" class="profile__x" data-del="' + esc(id) + '" aria-label="Delete ' + esc(name) + '">×</button>';
      wrap.appendChild(el);
    });
    if (ids.length < 3) {
      var add = document.createElement('button');
      add.type = 'button';
      add.className = 'profile profile--add';
      add.id = 'addProfile';
      add.textContent = '+ Add child';
      wrap.appendChild(add);
    }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------- profile management ---------- */
  function ensureActiveProfile() {
    if (state.activeId && state.profiles[state.activeId]) return;
    var id = newId();
    state.profiles[id] = { name: '', dob: '', given: {} };
    state.activeId = id;
  }

  function addProfile() {
    var ids = Object.keys(state.profiles);
    if (ids.length >= 3) return;
    var id = newId();
    state.profiles[id] = { name: '', dob: '', given: {} };
    state.activeId = id;
    saveState(); syncInputs(); render();
  }

  function deleteProfile(id) {
    if (!state.profiles[id]) return;
    var p = state.profiles[id];
    var label = p.name ? '"' + p.name + '"' : 'this child';
    if (!window.confirm('Delete ' + label + ' and all their ticked doses from this device? This cannot be undone.')) return;
    delete state.profiles[id];
    if (state.activeId === id) {
      var rest = Object.keys(state.profiles);
      state.activeId = rest.length ? rest[0] : null;
    }
    saveState(); syncInputs(); render();
    toast('Child data deleted.');
  }

  function syncInputs() {
    var p = activeProfile();
    $('childName').value = p ? (p.name || '') : '';
    $('dob').value = p ? (p.dob || '') : '';
  }

  /* ---------- events ---------- */
  function wire() {
    $('childName').addEventListener('input', function () {
      ensureActiveProfile();
      activeProfile().name = this.value.slice(0, 40);
      saveState(); renderProfiles();
    });

    $('dob').addEventListener('change', function () {
      var v = this.value;
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
      ensureActiveProfile();
      activeProfile().dob = v;
      saveState(); render();
    });

    document.querySelectorAll('input[name="schedule"]').forEach(function (r) {
      r.addEventListener('change', function () {
        if (this.checked) { state.schedule = this.value; saveState(); render(); }
      });
    });

    // delegated clicks for profiles + timeline
    document.body.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t.id === 'addProfile') { addProfile(); return; }
      var pick = t.getAttribute && t.getAttribute('data-pick');
      if (pick) { state.activeId = pick; saveState(); syncInputs(); render(); return; }
      var del = t.getAttribute && t.getAttribute('data-del');
      if (del) { deleteProfile(del); return; }
    });

    // delegated change for the "mark given" checkboxes + given-date
    $('timeline').addEventListener('change', function (ev) {
      var t = ev.target;
      var doseId = t.getAttribute('data-dose');
      if (doseId) {
        var p = activeProfile(); if (!p) return;
        p.given = p.given || {};
        if (t.checked) { p.given[doseId] = todayISO(); }
        else { delete p.given[doseId]; }
        saveState(); render(); return;
      }
      var dateId = t.getAttribute('data-dosedate');
      if (dateId) {
        var pp = activeProfile(); if (!pp) return;
        if (t.value && /^\d{4}-\d{2}-\d{2}$/.test(t.value)) { pp.given[dateId] = t.value; }
        else { pp.given[dateId] = true; }
        saveState(); return;
      }
    });

    $('printBtn').addEventListener('click', function () {
      if (!activeProfile() || !activeProfile().dob) { toast('Enter a date of birth first.'); return; }
      window.print();
    });

    $('csvBtn').addEventListener('click', exportCSV);

    $('clearBtn').addEventListener('click', function () {
      if (!state.activeId) { toast('No child selected.'); return; }
      deleteProfile(state.activeId);
    });

    $('firstrunOk').addEventListener('click', function () {
      $('firstrun').hidden = true;
      try { localStorage.setItem(NS + '.seen', '1'); } catch (e) {}
    });
  }

  function exportCSV() {
    var p = activeProfile();
    if (!p || !p.dob) { toast('Enter a date of birth first.'); return; }
    var given = p.given || {};
    var records = rowsFor(p.dob, state.schedule).map(function (r) {
      var s = statusOf(r, p.dob, given);
      var g = given[r.id];
      return {
        vaccine: r.vaccine, doseLabel: r.doseLabel, schedule: r.schedule,
        dueDate: r.dueDate, windowEnd: r.windowEnd, status: s,
        givenOn: (typeof g === 'string') ? g : (g ? 'given' : null),
        conditional: r.conditional, note: r.note, cite: r.cite
      };
    });
    var csv = CSVLIB.scheduleCSV(p.name, p.dob, state.schedule, records);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var safeName = (p.name || 'child').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'child';
    a.href = url;
    a.download = 'vaxdue-' + safeName + '-' + state.schedule.toLowerCase() + '.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('CSV exported.');
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- theme: honour manual toggle if previously set ---------- */
  function initTheme() {
    try {
      var th = localStorage.getItem(NS + '.theme');
      if (th === 'light' || th === 'dark') document.documentElement.setAttribute('data-theme', th);
    } catch (e) {}
  }

  /* ---------- boot ---------- */
  function boot() {
    initTheme();
    // first-run disclaimer
    var seen = false;
    try { seen = localStorage.getItem(NS + '.seen') === '1'; } catch (e) {}
    if (!seen) $('firstrun').hidden = false;

    if (!state.activeId || !state.profiles[state.activeId]) {
      var ids = Object.keys(state.profiles);
      if (ids.length) state.activeId = ids[0];
      else ensureActiveProfile();
    }
    if (state.schedule !== 'IAP' && state.schedule !== 'NIS') state.schedule = 'IAP';

    wire();
    syncInputs();
    render();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})();
