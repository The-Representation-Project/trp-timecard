// app/store.jsx — state, persistence, actions, email-handoff approval
//
// This is a SINGLE-USER app for Erika. Katrina (the approver) sees the
// timecard via a one-off URL link Erika emails her — she doesn't have her
// own copy of the app. The approval ceremony lives in app/Approval.jsx.
//
// Data persists in localStorage under STORAGE_KEY. There is no backend.

// Bumped from v1 → v2 to drop any seed-era data automatically. If you
// ever change the user identity / starting balances and want a clean
// slate on next load, bump this again.
const STORAGE_KEY = 'trp-timecard-v2';

// ----- Real people --------------------------------------------------------
// Edit these here if titles or email addresses ever change.

const EMPLOYEE = {
  id: 'u-employee',
  name: 'Erika Valencia-Quidwai',
  email: 'erika@therepproject.org',
  role: 'employee',
  title: 'Director of Operations',
  ptoBalance: 10.93,
  sickBalance: 9.44,
};

const APPROVER = {
  id: 'u-approver',
  name: 'Katrina Steffek',
  email: 'katrina@therepproject.org',
  role: 'director',
  title: 'Approver',
};

// Payroll contact — CC'd on approval emails so Jesse keeps a copy.
const PAYROLL = {
  id: 'u-payroll',
  name: 'Jesse Barber',
  email: 'jesse@faithfearfinance.com',
  role: 'payroll',
  title: 'Payroll',
};

// Accrual rates per hour worked. Defaults match 2 weeks PTO / yr +
// CA-standard 1-hr-sick-per-30-worked. Editable in the Time Off page.
const DEFAULT_PTO_ACCRUAL_PER_HOUR = 0.0385;   // ≈ 80 hrs / 2080 work-hours
const DEFAULT_SICK_ACCRUAL_PER_HOUR = 1 / 30;  // 1 sick hr per 30 hrs worked

// ----- Schema -------------------------------------------------------------

function emptyState() {
  return {
    users: [EMPLOYEE, APPROVER, PAYROLL],
    timeEntries: [],
    leaveEntries: [],
    weekSubmissions: [],
    payPeriods: [],
    activeClock: null,
    activeLunch: null,
    settings: {
      weekStartDay: 0,
      ptoAccrualPerHour: DEFAULT_PTO_ACCRUAL_PER_HOUR,
      sickAccrualPerHour: DEFAULT_SICK_ACCRUAL_PER_HOUR,
      accrualEnabled: true,
      payPeriodMode: 'semimonthly',
      // Submit pay period to approver this many days before the pay date.
      // Erika's payroll wants approval by the 13th (for 1–15) and 28th
      // (for 16–end), so default = 2 days early.
      submitLeadDays: 2,
    },
    session: { userId: EMPLOYEE.id },
  };
}

// ----- Persistence --------------------------------------------------------

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
}

function getInitialState() {
  const saved = loadState();
  const base = emptyState();
  if (!saved) return base;
  // Defensive forward-compat merge — keep the user's logged data but pull
  // in any new settings keys + ensure both user records always exist.
  const users = base.users.map(u => {
    const found = (saved.users || []).find(x => x.id === u.id);
    return found ? { ...u, ...found } : u;
  });
  return {
    ...base,
    ...saved,
    users,
    settings: { ...base.settings, ...(saved.settings || {}) },
    session: { ...base.session, ...(saved.session || {}) },
  };
}

// ----- Provider + hook ----------------------------------------------------

const StoreContext = React.createContext(null);

function StoreProvider({ children }) {
  const [state, setState] = React.useState(getInitialState);

  // Are we currently writing because we just received remote data?
  // (Prevents the local save effect from echoing back to the cloud.)
  const skipNextSaveRef = React.useRef(false);

  // Local cache always — same as before. Cloud save layered on top.
  React.useEffect(() => {
    saveState(state);
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    const cs = window.CloudSync;
    if (cs && cs.status() === 'signed-in') {
      // Debounce: only the last change in a 600ms window hits the network.
      const t = setTimeout(() => {
        cs.save(state).then((result) => {
          if (result && result.error) {
            console.error('[Timecard] Cloud save failed:', result.error);
          }
        });
      }, 600);
      return () => clearTimeout(t);
    }
  }, [state]);

  // When CloudSync signs in or a remote write arrives, pull the latest
  // cloud state into local state.
  React.useEffect(() => {
    const cs = window.CloudSync;
    if (!cs) return;

    async function pullRemote() {
      await cs.whenReady;
      if (cs.status() !== 'signed-in') return;
      const { data, error } = await cs.load();
      if (error) {
        console.error('[Timecard] Cloud load failed:', error);
        return;
      }
      if (!data) return;
      // Defensive merge with our schema defaults so any newly-added
      // settings keys don't blow up older cloud rows.
      const base = emptyState();
      const merged = {
        ...base,
        ...data,
        users: base.users.map(u => {
          const found = (data.users || []).find(x => x.id === u.id);
          return found ? { ...u, ...found } : u;
        }),
        settings: { ...base.settings, ...(data.settings || {}) },
        session: { ...base.session, ...(data.session || {}) },
      };
      skipNextSaveRef.current = true;
      setState(merged);
    }

    const offStatus = cs.onStatusChange(s => { if (s === 'signed-in') pullRemote(); });
    const offRemote = cs.onRemoteData(remote => {
      skipNextSaveRef.current = true;
      setState(prev => ({ ...prev, ...remote }));
    });
    // Initial pull if we're already signed-in at mount.
    pullRemote();
    return () => { offStatus(); offRemote(); };
  }, []);

  const update = React.useCallback((fn) => {
    setState(prev => (typeof fn === 'function' ? fn(prev) : fn));
  }, []);

  const actions = React.useMemo(() => makeActions(update), [update]);
  const value = React.useMemo(() => ({ state, update, actions }), [state, update, actions]);
  // Console handle for debugging / resets — see DEPLOY.md.
  React.useEffect(() => { window.__tc = { state, actions }; }, [state, actions]);
  return React.createElement(StoreContext.Provider, { value }, children);
}

function useStore() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside provider');
  return ctx;
}

// ----- Selectors ----------------------------------------------------------

function currentUser(state) {
  return state.users.find(u => u.id === state.session.userId) || state.users[0];
}
function employee(state) { return state.users.find(u => u.role === 'employee'); }
function director(state) { return state.users.find(u => u.role === 'director'); }
function payroll(state) { return state.users.find(u => u.role === 'payroll'); }

function entriesForWeek(state, weekStartIso, userId) {
  const days = window.TC.weekDays(weekStartIso);
  return state.timeEntries.filter(e => e.userId === userId && days.includes(e.date));
}
function leavesForWeek(state, weekStartIso, userId) {
  const days = window.TC.weekDays(weekStartIso);
  return state.leaveEntries.filter(l => l.userId === userId && days.includes(l.date));
}
function weekSubmission(state, weekStartIso, userId) {
  return state.weekSubmissions.find(w => w.weekStart === weekStartIso && w.userId === userId);
}

// Lock a semi-monthly pay period (1–15 or 16–end) ONLY after Katrina signs
// via the receipt link. Sent-for-approval, submitted weeks, and offline
// backfill records never lock editing. Locked periods are visually locked
// but remain editable with an explicit override (see forceUnlock in actions).
function isDayLocked(state, dateIso, userId) {
  const pp = payPeriodForDate(dateIso, state.settings);
  const rec = payPeriodRecord(state, pp.periodStart, userId);
  return !!(rec && rec.status === 'approved' && rec.signedViaReceipt);
}

function isDaySoftLocked(state, dateIso, userId) {
  return isDayLocked(state, dateIso, userId);
}

function dayLockMessage(state, dateIso, userId) {
  const pp = payPeriodForDate(dateIso, state.settings);
  const rec = payPeriodRecord(state, pp.periodStart, userId);
  if (rec && rec.status === 'approved' && rec.signedViaReceipt) {
    return `${window.TC.fmtDayShort(dateIso)} is in ${pp.label} — Katrina signed this pay period. Edits are locked for payroll, but you can override if a correction is needed.`;
  }
  return null;
}

function isWeekLocked(state, weekStartIso, userId) {
  const days = window.TC.weekDays(weekStartIso);
  return days.length > 0 && days.every(d => isDayLocked(state, d, userId));
}

// ----- Pay period helpers -------------------------------------------------

function payPeriodForDate(dateIso, settings) {
  const TC = window.TC;
  const date = TC.parseDate(dateIso);
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();

  if (d <= 15) {
    const start = new Date(y, m, 1);
    const end = new Date(y, m, 15);
    return {
      periodStart: TC.isoDate(start),
      periodEnd: TC.isoDate(end),
      payDate: TC.isoDate(end),
      label: `${start.toLocaleDateString(undefined, {month: 'short'})} 1–15`,
      mode: 'semimonthly',
    };
  }
  const start = new Date(y, m, 16);
  const end = new Date(y, m + 1, 0); // last day of month
  return {
    periodStart: TC.isoDate(start),
    periodEnd: TC.isoDate(end),
    payDate: TC.isoDate(end),
    label: `${start.toLocaleDateString(undefined, {month: 'short'})} 16–${end.getDate()}`,
    mode: 'semimonthly',
  };
}

// The day Erika needs to send the approval link to Katrina, based on
// settings.submitLeadDays. For default lead=2, returns the 13th and 28th.
function payPeriodSubmitDeadline(periodStartIso, settings) {
  const pp = payPeriodForDate(periodStartIso, settings);
  const lead = settings.submitLeadDays != null ? settings.submitLeadDays : 2;
  const d = window.TC.parseDate(pp.payDate);
  d.setDate(d.getDate() - lead);
  return window.TC.isoDate(d);
}

function payPeriodRecord(state, periodStartIso, userId) {
  return state.payPeriods.find(p => p.periodStart === periodStartIso && p.userId === userId);
}

function payPeriodWeekStarts(periodStartIso, periodEndIso) {
  const TC = window.TC;
  const start = TC.parseDate(periodStartIso);
  const end = TC.parseDate(periodEndIso);
  const set = new Set();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    set.add(TC.weekRange(d, 0).startIso);
  }
  return [...set].sort();
}

function payPeriodWeeks(state, periodStartIso, userId) {
  const pp = payPeriodForDate(periodStartIso, state.settings);
  return payPeriodWeekStarts(pp.periodStart, pp.periodEnd)
    .map(ws => weekSubmission(state, ws, userId))
    .filter(Boolean);
}

// Sum hours/leave for every day in the period (period-clipped, not week-clipped).
function payPeriodTotals(state, periodStartIso, userId) {
  const TC = window.TC;
  const pp = payPeriodForDate(periodStartIso, state.settings);
  let total = 0, work = 0, pto = 0, sick = 0, holiday = 0, lwop = 0;
  const start = TC.parseDate(pp.periodStart);
  const end = TC.parseDate(pp.periodEnd);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = TC.isoDate(d);
    const dayWork = state.timeEntries
      .filter(e => e.userId === userId && e.date === iso)
      .reduce((a, e) => a + TC.entryHours(e), 0);
    const dayPto = state.leaveEntries
      .filter(l => l.userId === userId && l.date === iso && l.type === 'pto')
      .reduce((a, l) => a + l.hours, 0);
    const daySick = state.leaveEntries
      .filter(l => l.userId === userId && l.date === iso && l.type === 'sick')
      .reduce((a, l) => a + l.hours, 0);
    const dayHoliday = state.leaveEntries
      .filter(l => l.userId === userId && l.date === iso && l.type === 'holiday')
      .reduce((a, l) => a + l.hours, 0);
    const dayLwop = state.leaveEntries
      .filter(l => l.userId === userId && l.date === iso && l.type === 'lwop')
      .reduce((a, l) => a + l.hours, 0);
    work += dayWork; pto += dayPto; sick += daySick; holiday += dayHoliday; lwop += dayLwop;
    total += dayWork + dayPto + daySick + dayHoliday + dayLwop;
  }
  return { total, work, pto, sick, holiday, lwop };
}

// Hours flagged as assumptions for early pay-period approval (before period ends).
// Counts entries marked Estimated OR dated after today, plus leave on future days.
function payPeriodAssumptionHours(state, periodStartIso, userId, todayIso) {
  const TC = window.TC;
  const refDay = todayIso || TC.isoDate(new Date());
  const pp = payPeriodForDate(periodStartIso, state.settings);
  let assumed = 0;
  state.timeEntries.forEach(e => {
    if (e.userId !== userId) return;
    if (e.date < pp.periodStart || e.date > pp.periodEnd) return;
    if (e.estimated || e.date > refDay) assumed += TC.entryHours(e);
  });
  state.leaveEntries.forEach(l => {
    if (l.userId !== userId) return;
    if (l.date < pp.periodStart || l.date > pp.periodEnd) return;
    if (l.date > refDay) assumed += l.hours;
  });
  return assumed;
}

function payPeriodBreakdown(state, periodStartIso, userId, todayIso) {
  const totals = payPeriodTotals(state, periodStartIso, userId);
  const assumed = payPeriodAssumptionHours(state, periodStartIso, userId, todayIso);
  const confirmed = Math.max(0, totals.total - assumed);
  return { ...totals, assumed, confirmed };
}

// Per-day rows clipped to a pay period — for Home/Send approval cards.
function payPeriodDayRows(state, periodStartIso, userId) {
  const TC = window.TC;
  const pp = payPeriodForDate(periodStartIso, state.settings);
  const rows = [];
  const start = TC.parseDate(pp.periodStart);
  const end = TC.parseDate(pp.periodEnd);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateIso = TC.isoDate(d);
    const work = state.timeEntries
      .filter(e => e.userId === userId && e.date === dateIso)
      .reduce((a, e) => a + TC.entryHours(e), 0);
    const pto = state.leaveEntries
      .filter(l => l.userId === userId && l.date === dateIso && l.type === 'pto')
      .reduce((a, l) => a + l.hours, 0);
    const sick = state.leaveEntries
      .filter(l => l.userId === userId && l.date === dateIso && l.type === 'sick')
      .reduce((a, l) => a + l.hours, 0);
    const holiday = state.leaveEntries
      .filter(l => l.userId === userId && l.date === dateIso && l.type === 'holiday')
      .reduce((a, l) => a + l.hours, 0);
    const lwop = state.leaveEntries
      .filter(l => l.userId === userId && l.date === dateIso && l.type === 'lwop')
      .reduce((a, l) => a + l.hours, 0);
    const total = work + pto + sick + holiday + lwop;
    if (total > 0) {
      rows.push({ dateIso, work, pto, sick, holiday, lwop, total });
    }
  }
  return rows;
}

// Build Gmail compose URL with optional CC for approval emails.
function buildGmailComposeUrl({ to, cc, subject, body }) {
  let url = 'https://mail.google.com/mail/?view=cm&fs=1' +
    `&to=${encodeURIComponent(to)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;
  if (cc) url += `&cc=${encodeURIComponent(cc)}`;
  return url;
}

function buildMailtoUrl({ to, cc, subject, body }) {
  let url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (cc) url += `&cc=${encodeURIComponent(cc)}`;
  return url;
}

function payPeriodTimeOffTotal(totals) {
  return (totals.pto || 0) + (totals.sick || 0) + (totals.holiday || 0) + (totals.lwop || 0);
}

function payPeriodTimeOffParts(totals) {
  const parts = [];
  if ((totals.pto || 0) > 0) parts.push({ label: 'PTO', hours: totals.pto });
  if ((totals.sick || 0) > 0) parts.push({ label: 'Sick', hours: totals.sick });
  if ((totals.holiday || 0) > 0) parts.push({ label: 'Holiday', hours: totals.holiday });
  if ((totals.lwop || 0) > 0) parts.push({ label: 'LWOP', hours: totals.lwop });
  return parts;
}

// Plain-text block for the approval email Katrina receives.
function buildPayPeriodEmailSummary(totals, { todayIso, periodEnd, payDateLabel }) {
  const TC = window.TC;
  const timeOff = payPeriodTimeOffTotal(totals);
  const assumed = totals.assumed || 0;
  const confirmed = totals.confirmed != null ? totals.confirmed : Math.max(0, totals.total - assumed);
  const offParts = payPeriodTimeOffParts(totals).map(p => `${TC.fmtHours(p.hours)} ${p.label}`).join(', ');

  const lines = [
    `PAY PERIOD TOTAL: ${TC.fmtHours(totals.total)} hrs`,
    `  · ${TC.fmtHours(totals.work)} hrs worked (clocked in)`,
  ];
  if (timeOff > 0) {
    lines.push(`  · ${TC.fmtHours(timeOff)} hrs time off${offParts ? ` (${offParts})` : ''}`);
  }

  if (assumed > 0) {
    lines.push(
      '',
      'Submitted early for approval (payroll deadline):',
      `  · ${TC.fmtHours(confirmed)} hrs CONFIRMED — logged through ${TC.fmtDayShort(todayIso)}`,
      `  · ${TC.fmtHours(assumed)} hrs ASSUMED — estimated for upcoming days (${TC.fmtDayShort(todayIso)} → ${TC.fmtDayShort(periodEnd)})`,
      '',
      `I'm sending before the pay period ends so you can approve in time for pay date (${payDateLabel}). The ${TC.fmtHours(assumed)} assumed hrs are my best estimate for days not yet worked; I'll adjust if anything changes.`,
    );
  }

  return lines.join('\n');
}

// A pay period is ready once it has logged hours and isn't already signed off.
function payPeriodReady(state, periodStartIso, userId) {
  const rec = payPeriodRecord(state, periodStartIso, userId);
  if (rec && (rec.status === 'approved' || rec.status === 'awaiting_approval')) return false;
  return payPeriodTotals(state, periodStartIso, userId).total > 0;
}

function weekTotals(state, weekStartIso, userId, now = Date.now()) {
  const days = window.TC.weekDays(weekStartIso);
  const ent = entriesForWeek(state, weekStartIso, userId);
  const lv = leavesForWeek(state, weekStartIso, userId);
  const perDay = days.map(d => {
    const work = ent.filter(e => e.date === d).reduce((a, e) => a + window.TC.entryHours(e, now), 0);
    const pto = lv.filter(l => l.date === d && l.type === 'pto').reduce((a, l) => a + l.hours, 0);
    const sick = lv.filter(l => l.date === d && l.type === 'sick').reduce((a, l) => a + l.hours, 0);
    const holiday = lv.filter(l => l.date === d && l.type === 'holiday').reduce((a, l) => a + l.hours, 0);
    const lwop = lv.filter(l => l.date === d && l.type === 'lwop').reduce((a, l) => a + l.hours, 0);
    return { date: d, work, pto, sick, holiday, lwop, total: work + pto + sick + holiday + lwop };
  });
  const total = perDay.reduce((a, d) => a + d.total, 0);
  const workTotal = perDay.reduce((a, d) => a + d.work, 0);
  const ptoTotal = perDay.reduce((a, d) => a + d.pto, 0);
  const sickTotal = perDay.reduce((a, d) => a + d.sick, 0);
  const holidayTotal = perDay.reduce((a, d) => a + d.holiday, 0);
  const lwopTotal = perDay.reduce((a, d) => a + d.lwop, 0);
  return { perDay, total, workTotal, ptoTotal, sickTotal, holidayTotal, lwopTotal };
}

// ----- Approval handoff (URL hash payload) --------------------------------
//
// We use the URL hash because (a) it never hits a server, (b) it survives
// being pasted into an email body, and (c) we can host the same static HTML
// file in one place and let the hash control whether the visitor sees
// Erika's app or the standalone approval screen.

// Build the small JSON payload Katrina will see.
function buildApprovalRequest(state, periodStartIso) {
  const TC = window.TC;
  const emp = employee(state);
  const appr = director(state);
  const pp = payPeriodForDate(periodStartIso, state.settings);
  const totals = payPeriodTotals(state, periodStartIso, emp.id);
  const todayIso = TC.isoDate(new Date());
  const assumed = payPeriodAssumptionHours(state, periodStartIso, emp.id, todayIso);
  const confirmed = Math.max(0, totals.total - assumed);

  const weekStarts = payPeriodWeekStarts(pp.periodStart, pp.periodEnd);
  const weeks = weekStarts.map(ws => {
    const t = weekTotals(state, ws, emp.id);
    const sub = weekSubmission(state, ws, emp.id);
    // Include per-day detail (clipped to the period) so Katrina can review
    // exactly what she's signing off on.
    const ppStart = TC.parseDate(pp.periodStart);
    const ppEnd = TC.parseDate(pp.periodEnd);
    const days = TC.weekDays(ws).filter(d => {
      const dt = TC.parseDate(d);
      return dt >= ppStart && dt <= ppEnd;
    }).map(d => {
      const ents = state.timeEntries.filter(e => e.userId === emp.id && e.date === d);
      const lvs = state.leaveEntries.filter(l => l.userId === emp.id && l.date === d);
      return {
        d,
        sessions: ents.map(e => ({
          in: e.clockIn,
          out: e.clockOut,
          br: e.breakMinutes || 0,
          ed: e.manuallyEdited ? 1 : 0,
          est: e.estimated ? 1 : 0,
        })),
        leaves: lvs.map(l => ({ t: l.type, h: l.hours, n: l.name || undefined })),
      };
    });
    return {
      ws,
      we: TC.weekDays(ws)[6],
      work: t.workTotal,
      pto: t.ptoTotal,
      sick: t.sickTotal,
      holiday: t.holidayTotal,
      lwop: t.lwopTotal,
      total: t.total,
      days,
      submittedAt: sub ? sub.submittedAt : null,
    };
  }).filter(w => w.total > 0 || w.lwop > 0);

  return {
    v: 1,
    kind: 'approve',
    pp: {
      periodStart: pp.periodStart,
      periodEnd: pp.periodEnd,
      payDate: pp.payDate,
      label: pp.label,
    },
    employee: { name: emp.name, title: emp.title, email: emp.email },
    approver: { name: appr.name, title: appr.title, email: appr.email },
    weeks,
    totals: { ...totals, assumed, confirmed },
    requestedAt: new Date().toISOString(),
  };
}

function buildApprovalReceipt({ periodStart, periodEnd, signedName, signedTitle, signedAt, comment, totalHours }) {
  return {
    v: 1,
    kind: 'receipt',
    periodStart, periodEnd,
    signedName, signedTitle, signedAt,
    comment: comment || '',
    totalHours,
  };
}

// URL-safe base64 of UTF-8 JSON. Survives email clients better than raw JSON.
function encodePayload(obj) {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodePayload(s) {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
    const json = decodeURIComponent(escape(atob(padded)));
    return JSON.parse(json);
  } catch (e) { return null; }
}

function approvalRequestUrl(state, periodStartIso) {
  const payload = buildApprovalRequest(state, periodStartIso);
  const enc = encodePayload(payload);
  const base = window.location.origin + window.location.pathname;
  return `${base}#approve=${enc}`;
}

function approvalReceiptUrl(receipt) {
  const enc = encodePayload(receipt);
  const base = window.location.origin + window.location.pathname;
  return `${base}#receipt=${enc}`;
}

// Parse the current URL hash into { kind, payload } or null.
function readHashPayload() {
  const h = window.location.hash || '';
  const m = h.match(/^#(approve|receipt)=(.+)$/);
  if (!m) return null;
  const payload = decodePayload(m[2]);
  if (!payload) return null;
  return { kind: m[1], payload };
}

// ----- Actions ------------------------------------------------------------

function makeActions(update) {
  return {
    ensureWeek(weekStartIso, userId) {
      update(s => {
        const exists = s.weekSubmissions.find(w => w.weekStart === weekStartIso && w.userId === userId);
        if (exists) return s;
        const end = window.TC.weekDays(weekStartIso)[6];
        return {
          ...s,
          weekSubmissions: [...s.weekSubmissions, {
            id: 'w-' + window.TC.uid(),
            userId,
            weekStart: weekStartIso,
            weekEnd: end,
            status: 'draft',
            directorComment: '',
            submittedAt: null,
            decidedAt: null,
          }],
        };
      });
    },

    clockIn(userId, { force = false } = {}) {
      update(s => {
        const u = s.users.find(x => x.id === userId);
        if (!u || u.role !== 'employee') return s;
        if (s.activeClock && s.activeClock.userId === userId) return s;
        const now = new Date();
        const dateIso = window.TC.isoDate(now);
        if (!force && isDayLocked(s, dateIso, userId)) return s;
        const weekId = window.TC.weekRange(now, 0).startIso;
        const wk = s.weekSubmissions.find(w => w.weekStart === weekId && w.userId === userId);
        const entry = {
          id: 't-' + window.TC.uid(),
          userId, date: dateIso,
          clockIn: now.toISOString(),
          clockOut: null,
          breakMinutes: 0,
          manuallyEdited: false,
          estimated: false,
          weekId,
        };
        let weekSubmissions = s.weekSubmissions;
        if (!wk) {
          weekSubmissions = [...weekSubmissions, {
            id: 'w-' + window.TC.uid(),
            userId, weekStart: weekId,
            weekEnd: window.TC.weekDays(weekId)[6],
            status: 'draft', directorComment: '',
            submittedAt: null, decidedAt: null,
          }];
        }
        return {
          ...s,
          timeEntries: [...s.timeEntries, entry],
          weekSubmissions,
          activeClock: { userId, entryId: entry.id },
        };
      });
    },

    clockOut(userId) {
      update(s => {
        if (!s.activeClock || s.activeClock.userId !== userId) return s;
        const id = s.activeClock.entryId;
        const now = new Date().toISOString();
        let timeEntries = s.timeEntries;
        if (s.activeLunch && s.activeLunch.userId === userId && s.activeLunch.entryId === id) {
          const lunchMs = Date.now() - new Date(s.activeLunch.lunchStartIso).getTime();
          const lunchMin = Math.max(0, Math.round(lunchMs / 60000));
          timeEntries = timeEntries.map(e =>
            e.id === id ? { ...e, breakMinutes: (e.breakMinutes || 0) + lunchMin } : e
          );
        }
        return {
          ...s,
          timeEntries: timeEntries.map(e => e.id === id ? { ...e, clockOut: now } : e),
          activeClock: null,
          activeLunch: null,
        };
      });
    },

    startLunch(userId) {
      update(s => {
        if (!s.activeClock || s.activeClock.userId !== userId) return s;
        if (s.activeLunch && s.activeLunch.userId === userId) return s;
        return { ...s, activeLunch: {
          userId, entryId: s.activeClock.entryId,
          lunchStartIso: new Date().toISOString(),
        }};
      });
    },

    endLunch(userId) {
      update(s => {
        if (!s.activeLunch || s.activeLunch.userId !== userId) return s;
        const { entryId, lunchStartIso } = s.activeLunch;
        const lunchMs = Date.now() - new Date(lunchStartIso).getTime();
        const lunchMin = Math.max(0, Math.round(lunchMs / 60000));
        return {
          ...s,
          timeEntries: s.timeEntries.map(e =>
            e.id === entryId ? { ...e, breakMinutes: (e.breakMinutes || 0) + lunchMin } : e
          ),
          activeLunch: null,
        };
      });
    },

    updateEntry(id, patch, { manual = true, force = false } = {}) {
      update(s => {
        const entry = s.timeEntries.find(e => e.id === id);
        if (!force && entry && isDayLocked(s, patch.date || entry.date, entry.userId)) return s;
        const next = {
          ...s,
          timeEntries: s.timeEntries.map(e =>
            e.id === id ? { ...e, ...patch, manuallyEdited: manual ? true : e.manuallyEdited } : e
          ),
        };
        if (s.activeClock && s.activeClock.entryId === id && patch.clockOut) {
          next.activeClock = null;
        }
        return next;
      });
    },

    deleteEntry(id, { force = false } = {}) {
      update(s => {
        const entry = s.timeEntries.find(e => e.id === id);
        if (!force && entry && isDayLocked(s, entry.date, entry.userId)) return s;
        const next = { ...s, timeEntries: s.timeEntries.filter(e => e.id !== id) };
        // If we just deleted the live entry, clear the active clock too so
        // the timer stops and the Clock-In button comes back.
        if (s.activeClock && s.activeClock.entryId === id) {
          next.activeClock = null;
          next.activeLunch = null;
        }
        return next;
      });
    },

    addManualEntry(userId, { date, clockIn, clockOut, breakMinutes, estimated = false }, { force = false } = {}) {
      update(s => {
        if (!force && isDayLocked(s, date, userId)) return s;
        const weekId = window.TC.weekRange(window.TC.parseDate(date), 0).startIso;
        const entry = {
          id: 't-' + window.TC.uid(),
          userId, date,
          clockIn: window.TC.dateAndTimeToIso(date, clockIn),
          clockOut: clockOut ? window.TC.dateAndTimeToIso(date, clockOut) : null,
          breakMinutes: breakMinutes || 0,
          manuallyEdited: true,
          estimated: !!estimated,
          weekId,
        };
        let weekSubmissions = s.weekSubmissions;
        const wk = weekSubmissions.find(w => w.weekStart === weekId && w.userId === userId);
        if (!wk) {
          weekSubmissions = [...weekSubmissions, {
            id: 'w-' + window.TC.uid(), userId,
            weekStart: weekId, weekEnd: window.TC.weekDays(weekId)[6],
            status: 'draft', directorComment: '',
            submittedAt: null, decidedAt: null,
          }];
        }
        return { ...s, timeEntries: [...s.timeEntries, entry], weekSubmissions };
      });
    },

    submitWeek(userId, weekStartIso) {
      update(s => ({
        ...s,
        weekSubmissions: s.weekSubmissions.map(w =>
          w.weekStart === weekStartIso && w.userId === userId
            ? { ...w, status: 'submitted', submittedAt: new Date().toISOString(), directorComment: '' }
            : w
        ),
      }));
    },

    // Submit every draft week inside a pay period in one action. Used by
    // the "Submit Pay Period" flow so Erika doesn't have to click each
    // week individually.
    submitAllWeeksInPeriod(periodStartIso, userId) {
      update(s => {
        const pp = payPeriodForDate(periodStartIso, s.settings);
        const weekStarts = payPeriodWeekStarts(pp.periodStart, pp.periodEnd);
        const submittedAt = new Date().toISOString();
        return {
          ...s,
          weekSubmissions: s.weekSubmissions.map(w => {
            if (w.userId !== userId) return w;
            if (!weekStarts.includes(w.weekStart)) return w;
            if (w.status === 'approved') return w;
            // Bring drafts + changes-requested + rejected back up to submitted.
            return { ...w, status: 'submitted', submittedAt, directorComment: '' };
          }),
        };
      });
    },

    // Erika has clicked "Send to Katrina for approval". This marks the pay
    // period as awaiting_approval locally so the UI shows the right state
    // while we wait for the signed receipt to come back via URL.
    markPayPeriodSent(periodStartIso, userId) {
      update(s => {
        let payPeriods = s.payPeriods;
        const existing = payPeriods.find(p => p.periodStart === periodStartIso && p.userId === userId);
        if (existing) {
          payPeriods = payPeriods.map(p => p.id === existing.id
            ? { ...p, status: 'awaiting_approval', sentToApproverAt: new Date().toISOString() }
            : p);
        } else {
          const pp = payPeriodForDate(periodStartIso, s.settings);
          payPeriods = [...payPeriods, {
            id: 'pp-' + window.TC.uid(),
            userId, periodStart: pp.periodStart, periodEnd: pp.periodEnd,
            status: 'awaiting_approval',
            directorComment: '', decidedAt: null,
            sentToApproverAt: new Date().toISOString(),
          }];
        }
        return { ...s, payPeriods };
      });
    },

    // Katrina has emailed back the approval receipt link. Erika clicked it,
    // we decoded the receipt, this folds it into local state: marks the pay
    // period approved, locks all weeks inside it, accrues PTO + sick.
    importApprovalReceipt(receipt) {
      update(s => {
        const emp = s.users.find(u => u.role === 'employee');
        const appr = s.users.find(u => u.role === 'director');
        if (!emp) return s;

        const pp = payPeriodForDate(receipt.periodStart, s.settings);
        let payPeriods = s.payPeriods;
        const existing = payPeriods.find(p => p.periodStart === pp.periodStart && p.userId === emp.id);

        const signed = {
          status: 'approved',
          signedViaReceipt: true,
          offline: false,
          directorComment: receipt.comment || '',
          decidedAt: receipt.signedAt,
          signedName: receipt.signedName,
          signedTitle: receipt.signedTitle || (appr ? appr.title : ''),
          signedAt: receipt.signedAt,
          approverEmail: appr ? appr.email : '',
        };

        if (existing) {
          payPeriods = payPeriods.map(p => p.id === existing.id ? { ...p, ...signed } : p);
        } else {
          payPeriods = [...payPeriods, {
            id: 'pp-' + window.TC.uid(),
            userId: emp.id,
            periodStart: pp.periodStart,
            periodEnd: pp.periodEnd,
            ...signed,
          }];
        }

        // Mark every week that touches this period as approved + locked.
        const weekStarts = payPeriodWeekStarts(pp.periodStart, pp.periodEnd);
        const weekSubmissions = s.weekSubmissions.map(w =>
          (weekStarts.includes(w.weekStart) && w.userId === emp.id)
            ? { ...w, status: 'approved', decidedAt: signed.decidedAt, directorComment: signed.directorComment || w.directorComment }
            : w
        );

        // Accrue PTO + sick from worked hours in this period (one-time per
        // period — we tag the pp record so a second import is idempotent).
        const alreadyAccrued = existing && existing.accrued;
        let users = s.users;
        if (!alreadyAccrued && s.settings.accrualEnabled) {
          const totals = payPeriodTotals(s, pp.periodStart, emp.id);
          const ptoAccrued = totals.work * (s.settings.ptoAccrualPerHour || 0);
          const sickAccrued = totals.work * (s.settings.sickAccrualPerHour || 0);
          users = users.map(u => u.id === emp.id ? {
            ...u,
            ptoBalance: Number((u.ptoBalance + ptoAccrued).toFixed(4)),
            sickBalance: Number((u.sickBalance + sickAccrued).toFixed(4)),
          } : u);
          payPeriods = payPeriods.map(p => (p.periodStart === pp.periodStart && p.userId === emp.id)
            ? { ...p, accrued: { pto: ptoAccrued, sick: sickAccrued, when: signed.decidedAt } }
            : p);
        }

        return { ...s, users, payPeriods, weekSubmissions };
      });
    },

    // Like importApprovalReceipt but for backfilling already-approved-offline
    // pay periods. Marks the period approved with the supplied signature
    // metadata WITHOUT accruing PTO/sick (since the period happened before
    // the user started using this app, accrual would double-count).
    markPayPeriodApprovedOffline(periodStartIso, userId, { signedName, signedTitle, signedAt, comment }) {
      update(s => {
        const pp = payPeriodForDate(periodStartIso, s.settings);
        let payPeriods = s.payPeriods;
        const existing = payPeriods.find(p => p.periodStart === pp.periodStart && p.userId === userId);
        const signed = {
          status: 'approved',
          signedViaReceipt: false,
          directorComment: comment || 'Approved offline / backfilled record.',
          decidedAt: signedAt,
          signedName, signedTitle,
          signedAt,
          offline: true,
          accrued: { pto: 0, sick: 0, when: signedAt },
        };
        if (existing) {
          payPeriods = payPeriods.map(p => p.id === existing.id ? { ...p, ...signed } : p);
        } else {
          payPeriods = [...payPeriods, {
            id: 'pp-' + window.TC.uid(),
            userId,
            periodStart: pp.periodStart,
            periodEnd: pp.periodEnd,
            ...signed,
          }];
        }
        const weekStarts = payPeriodWeekStarts(pp.periodStart, pp.periodEnd);
        const weekSubmissions = s.weekSubmissions.map(w =>
          (weekStarts.includes(w.weekStart) && w.userId === userId)
            ? { ...w, status: 'approved', decidedAt: signedAt, directorComment: signed.directorComment }
            : w
        );
        return { ...s, payPeriods, weekSubmissions };
      });
    },

    // Rewind a pay period to draft for editing. Works when the period was
    // marked "sent" (awaiting_approval) or mistakenly stamped approved
    // offline — not after Katrina's real signed receipt.
    cancelPayPeriodSend(periodStartIso, userId) {
      update(s => {
        const pp = payPeriodForDate(periodStartIso, s.settings);
        const weekStarts = payPeriodWeekStarts(pp.periodStart, pp.periodEnd);
        const rec = payPeriodRecord(s, periodStartIso, userId);
        const canReopen = rec && (
          rec.status === 'awaiting_approval' ||
          (rec.status === 'approved' && rec.offline)
        );
        if (!canReopen) return s;

        let payPeriods = s.payPeriods.map(p => {
          if (p.periodStart !== periodStartIso || p.userId !== userId) return p;
          if (p.status === 'awaiting_approval') {
            return { ...p, status: 'pending', sentToApproverAt: null };
          }
          if (p.status === 'approved' && p.offline) {
            return {
              ...p,
              status: 'pending',
              directorComment: '',
              decidedAt: null,
              signedName: null,
              signedTitle: null,
              signedAt: null,
              offline: false,
              sentToApproverAt: null,
            };
          }
          return p;
        });

        const reopeningOffline = rec.status === 'approved' && rec.offline;
        const weekSubmissions = s.weekSubmissions.map(w => {
          if (w.userId !== userId) return w;
          if (!weekStarts.includes(w.weekStart)) return w;
          if (w.status === 'submitted') {
            return { ...w, status: 'draft', submittedAt: null };
          }
          if (reopeningOffline && w.status === 'approved') {
            return { ...w, status: 'draft', decidedAt: null, directorComment: '' };
          }
          return w;
        });
        return { ...s, payPeriods, weekSubmissions };
      });
    },

    addLeave(userId, { date, type, hours, name, override = false }) {
      update(s => {
        const u = s.users.find(x => x.id === userId);
        if (!u) return s;
        // Holidays don't pull from any balance — they're just extra paid
        // hours on top of whatever was worked / taken as PTO/sick.
        // LWOP (Leave Without Pay) also doesn't touch any balance — it's
        // unpaid absence, logged for the record only.
        const noBalance = type === 'holiday' || type === 'lwop';
        if (!noBalance) {
          const bal = type === 'pto' ? u.ptoBalance : u.sickBalance;
          if (hours > bal && !override) return s;
        }
        const users = noBalance
          ? s.users
          : s.users.map(x => x.id !== userId ? x
              : type === 'pto' ? { ...x, ptoBalance: Math.max(0, x.ptoBalance - hours) }
              : { ...x, sickBalance: Math.max(0, x.sickBalance - hours) });
        const leave = {
          id: 'l-' + window.TC.uid(),
          userId, date, type, hours,
          name: name || null,
          status: 'approved',
          directorComment: '',
          requestedAt: new Date().toISOString(),
        };
        return { ...s, users, leaveEntries: [...s.leaveEntries, leave] };
      });
    },

    deleteLeave(id) {
      update(s => {
        const leave = s.leaveEntries.find(l => l.id === id);
        if (!leave) return s;
        // Refund balance if the leave was approved. Holidays and LWOP
        // don't touch balances so there's nothing to refund.
        let users = s.users;
        const touchesBalance = leave.type === 'pto' || leave.type === 'sick';
        if (leave.status === 'approved' && touchesBalance) {
          users = users.map(u => u.id !== leave.userId ? u
            : leave.type === 'pto' ? { ...u, ptoBalance: u.ptoBalance + leave.hours }
            : { ...u, sickBalance: u.sickBalance + leave.hours });
        }
        return { ...s, users, leaveEntries: s.leaveEntries.filter(l => l.id !== id) };
      });
    },

    setBalances(userId, { ptoBalance, sickBalance }) {
      update(s => ({
        ...s,
        users: s.users.map(u => u.id === userId ? {
          ...u,
          ptoBalance: ptoBalance != null ? Number(ptoBalance) : u.ptoBalance,
          sickBalance: sickBalance != null ? Number(sickBalance) : u.sickBalance,
        } : u),
      }));
    },

    setSettings(patch) {
      update(s => ({ ...s, settings: { ...s.settings, ...patch } }));
    },

    // One-time bulk import for backfilling hours before the app existed.
    // Re-running replaces prior rows with the same importTag (idempotent).
    importHistoricalBatch({
      userId,
      entries,
      ptoBalance,
      sickBalance,
      approvePeriodStarts = [],
      approverName,
      approverTitle,
      importTag = 'hist-v1',
      replaceRangeStart = null,
      replaceRangeEnd = null,
    }) {
      update(s => {
        const TC = window.TC;
        const emp = s.users.find(u => u.id === userId);
        if (!emp) return s;

        // Drop prior import rows AND any other sessions in the backfill date
        // range so clock-in tests don't double up with imported days.
        let timeEntries = s.timeEntries.filter(e => {
          if (e.userId !== userId) return true;
          if (e.importTag === importTag) return false;
          if (replaceRangeStart && replaceRangeEnd
              && e.date >= replaceRangeStart && e.date <= replaceRangeEnd) {
            return false;
          }
          return true;
        });
        const newEntries = entries.map(e => {
          const weekId = TC.weekRange(TC.parseDate(e.date), 0).startIso;
          return {
            id: 't-' + TC.uid(),
            userId,
            date: e.date,
            clockIn: TC.dateAndTimeToIso(e.date, e.in),
            clockOut: TC.dateAndTimeToIso(e.date, e.out),
            breakMinutes: e.break != null ? e.break : 30,
            manuallyEdited: true,
            estimated: !!e.estimated,
            importTag,
            weekId,
          };
        });
        timeEntries = [...timeEntries, ...newEntries];

        let weekSubmissions = [...s.weekSubmissions];
        const touchedWeeks = new Set(newEntries.map(e => e.weekId));
        touchedWeeks.forEach(weekStart => {
          if (!weekSubmissions.find(w => w.weekStart === weekStart && w.userId === userId)) {
            weekSubmissions = [...weekSubmissions, {
              id: 'w-' + TC.uid(),
              userId,
              weekStart,
              weekEnd: TC.weekDays(weekStart)[6],
              status: 'draft',
              directorComment: '',
              submittedAt: null,
              decidedAt: null,
            }];
          }
        });

        let payPeriods = [...s.payPeriods];
        const signedAt = new Date().toISOString();
        approvePeriodStarts.forEach(periodStartIso => {
          const pp = payPeriodForDate(periodStartIso, s.settings);
          const existing = payPeriods.find(p => p.periodStart === pp.periodStart && p.userId === userId);
          const offline = {
            status: 'approved',
            signedViaReceipt: false,
            directorComment: 'Backfilled — approved via payroll before using Timecard app.',
            decidedAt: signedAt,
            signedName: approverName || 'Katrina Steffek',
            signedTitle: approverTitle || 'Approver',
            signedAt,
            offline: true,
            accrued: { pto: 0, sick: 0, when: signedAt },
          };
          if (existing) {
            payPeriods = payPeriods.map(p => p.id === existing.id ? { ...p, ...offline } : p);
          } else {
            payPeriods = [...payPeriods, {
              id: 'pp-' + TC.uid(),
              userId,
              periodStart: pp.periodStart,
              periodEnd: pp.periodEnd,
              ...offline,
            }];
          }
          const weekStarts = payPeriodWeekStarts(pp.periodStart, pp.periodEnd);
          weekSubmissions = weekSubmissions.map(w =>
            (weekStarts.includes(w.weekStart) && w.userId === userId)
              ? { ...w, status: 'approved', decidedAt: signedAt, directorComment: offline.directorComment }
              : w
          );
        });

        let users = s.users.map(u => u.id !== userId ? u : {
          ...u,
          ptoBalance: ptoBalance != null ? Number(ptoBalance) : u.ptoBalance,
          sickBalance: sickBalance != null ? Number(sickBalance) : u.sickBalance,
        });

        // Clear a stuck open clock if it pointed at a removed entry.
        let activeClock = s.activeClock;
        let activeLunch = s.activeLunch;
        if (activeClock && activeClock.userId === userId) {
          const still = timeEntries.find(e => e.id === activeClock.entryId);
          if (!still) activeClock = null;
        }
        if (activeLunch && activeLunch.userId === userId && !activeClock) {
          activeLunch = null;
        }

        return { ...s, users, timeEntries, weekSubmissions, payPeriods, activeClock, activeLunch };
      });
    },

    // For testing only — wipes all logged data. Not surfaced in normal UI;
    // expose via console: `window.__tc.actions.factoryReset()`.
    factoryReset() {
      update(() => emptyState());
    },

    // Replace local state wholesale. Used when (a) uploading local data
    // to a fresh cloud row, or (b) downloading cloud data into a fresh
    // device. Does NOT skip cloud save — call this when you mean to push.
    replaceAll(newState) {
      update(() => ({ ...emptyState(), ...newState }));
    },
  };
}

Object.assign(window, {
  StoreContext, StoreProvider, useStore,
  currentUser, employee, director, payroll,
  entriesForWeek, leavesForWeek, weekSubmission, isDayLocked, isDaySoftLocked, dayLockMessage, isWeekLocked, weekTotals,
  payPeriodForDate, payPeriodRecord, payPeriodWeeks, payPeriodWeekStarts,
  payPeriodReady, payPeriodTotals, payPeriodAssumptionHours, payPeriodBreakdown, payPeriodDayRows,
  payPeriodTimeOffTotal, payPeriodTimeOffParts, buildPayPeriodEmailSummary,
  payPeriodSubmitDeadline,
  buildApprovalRequest, buildApprovalReceipt,
  encodePayload, decodePayload,
  approvalRequestUrl, approvalReceiptUrl, readHashPayload,
  buildGmailComposeUrl, buildMailtoUrl,
});
