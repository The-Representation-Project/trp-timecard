// app/importHistorical.js — Backfill hours from before you started using the app.
// Schedule: May 4 2026 onward, M–F 8:00–4:30 + 30 min lunch (8 hrs), no weekends,
// with June overrides per Erika's payroll records.

(function () {
  const IMPORT_TAG = 'hist-erika-2026';

  const STANDARD = { in: '08:00', out: '16:30', break: 30 };
  // Jun 2–5 (OT week): 8:00 AM – 9:00 PM, 30 min lunch → 12.5 hrs paid (×4 = 50)
  const LONG_SHIFT = { in: '08:00', out: '21:00', break: 30 };
  // Sat Jun 13: 7:30 AM – 8:00 PM, 30 min lunch → 12 hrs paid
  const JUNE_13_SAT = { in: '07:30', out: '20:00', break: 30 };

  // Override specific dates (YYYY-MM-DD → shift template).
  const JUNE_OVERRIDES = {
    '2026-06-02': LONG_SHIFT,
    '2026-06-03': LONG_SHIFT,
    '2026-06-04': LONG_SHIFT,
    '2026-06-05': LONG_SHIFT,
    '2026-06-13': JUNE_13_SAT,
  };

  function isoDate(y, m, d) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function isWeekday(dateIso) {
    const [y, m, d] = dateIso.split('-').map(Number);
    const wd = new Date(y, m - 1, d).getDay();
    return wd >= 1 && wd <= 5;
  }

  function shiftForDate(dateIso) {
    if (JUNE_OVERRIDES[dateIso]) return JUNE_OVERRIDES[dateIso];
    if (isWeekday(dateIso)) return STANDARD;
    return null;
  }

  function dateRangeEntries(startIso, endIso) {
    const TC = window.TC;
    const entries = [];
    const start = TC.parseDate(startIso);
    const end = TC.parseDate(endIso);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateIso = TC.isoDate(d);
      const shift = shiftForDate(dateIso);
      if (!shift) continue;
      entries.push({ date: dateIso, in: shift.in, out: shift.out, break: shift.break });
    }
    return entries;
  }

  function buildErikaMayJuneEntries() {
    // May 4 → June 15 (current semi-monthly period). Weekends skipped except Jun 13 (Sat).
    return dateRangeEntries('2026-05-04', '2026-06-15');
  }

  function summarize(entries) {
    const TC = window.TC;
    let total = 0;
    entries.forEach(e => {
      total += TC.entryHours({
        clockIn: TC.dateAndTimeToIso(e.date, e.in),
        clockOut: TC.dateAndTimeToIso(e.date, e.out),
        breakMinutes: e.break,
      });
    });
    const junePeriod = entries.filter(e => e.date >= '2026-06-01' && e.date <= '2026-06-15');
    let juneTotal = 0;
    junePeriod.forEach(e => {
      juneTotal += TC.entryHours({
        clockIn: TC.dateAndTimeToIso(e.date, e.in),
        clockOut: TC.dateAndTimeToIso(e.date, e.out),
        breakMinutes: e.break,
      });
    });
    return { days: entries.length, total, junePeriodDays: junePeriod.length, juneTotal };
  }

  function runImport() {
    if (!window.__tc || !window.__tc.actions) {
      alert('Timecard is still loading — try again in a moment.');
      return null;
    }
    const { state, actions } = window.__tc;
    const emp = state.users.find(u => u.role === 'employee');
    if (!emp) {
      alert('Employee record not found.');
      return null;
    }

    const entries = buildErikaMayJuneEntries();
    const summary = summarize(entries);

    actions.importHistoricalBatch({
      userId: emp.id,
      entries,
      ptoBalance: 10.93,
      sickBalance: 9.44,
      approvePeriodStarts: ['2026-05-01', '2026-05-16'],
      approverName: 'Katrina Steffek',
      approverTitle: 'Approver',
      importTag: IMPORT_TAG,
      replaceRangeStart: '2026-05-04',
      replaceRangeEnd: '2026-06-15',
    });

    return summary;
  }

  function alreadyImported() {
    try {
      const raw = localStorage.getItem('trp-timecard-v2');
      if (!raw) return false;
      const state = JSON.parse(raw);
      return (state.timeEntries || []).some(e => e.importTag === IMPORT_TAG);
    } catch (e) { return false; }
  }

  window.HistoricalImport = {
    IMPORT_TAG,
    buildErikaMayJuneEntries,
    summarize,
    runImport,
    alreadyImported,
  };
})();
