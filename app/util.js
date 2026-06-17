// app/util.js — date, time, formatting, CSV helpers

const MS = 1000, MIN = 60 * MS, HR = 60 * MIN, DAY = 24 * HR;

function pad(n) { return String(n).padStart(2, '0'); }

// ISO date (YYYY-MM-DD) in *local* time for a Date.
function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Parse YYYY-MM-DD as local midnight.
function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Start of week (Sun) for a date.
function startOfWeek(d, weekStartDay = 0) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (x.getDay() - weekStartDay + 7) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function weekRange(d, weekStartDay = 0) {
  const s = startOfWeek(d, weekStartDay);
  const e = addDays(s, 6);
  return { start: s, end: e, startIso: isoDate(s), endIso: isoDate(e) };
}

function weekDays(weekStartIso) {
  const s = parseDate(weekStartIso);
  return Array.from({ length: 7 }, (_, i) => isoDate(addDays(s, i)));
}

// Format a Date as h:mm AM/PM
function fmtTime(d) {
  if (!d) return '—';
  const t = new Date(d);
  let h = t.getHours();
  const m = t.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${pad(m)} ${ap}`;
}

// Format milliseconds as H:MM
function fmtDuration(ms) {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${pad(m)}:${pad(s)}`;
}

function fmtHours(hours) {
  if (hours == null || isNaN(hours)) return '0.00';
  return hours.toFixed(2);
}

// Format date label like "Mon May 18"
function fmtDayShort(iso) {
  const d = parseDate(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtDayLong(iso) {
  const d = parseDate(iso);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtRange(startIso, endIso) {
  const s = parseDate(startIso);
  const e = parseDate(endIso);
  const sameMonth = s.getMonth() === e.getMonth();
  const sm = s.toLocaleDateString(undefined, { month: 'short' });
  const em = e.toLocaleDateString(undefined, { month: 'short' });
  return sameMonth
    ? `${sm} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`
    : `${sm} ${s.getDate()} – ${em} ${e.getDate()}, ${e.getFullYear()}`;
}

// Compute worked hours from a TimeEntry, capped at clock-out (or now if open).
// Estimated sessions without a clock-out count as an 8h day (minus break) so
// early pay-period submissions can include assumed days 14–15 on the 13th.
function entryHours(entry, now = Date.now()) {
  if (!entry.clockIn) return 0;
  const start = new Date(entry.clockIn).getTime();
  const breakMs = (entry.breakMinutes || 0) * MIN;
  if (entry.clockOut) {
    const end = new Date(entry.clockOut).getTime();
    return Math.max(0, end - start - breakMs) / HR;
  }
  if (entry.estimated) {
    return Math.max(0, 8 - breakMs / HR);
  }
  return Math.max(0, now - start - breakMs) / HR;
}

// Time input helpers: convert ISO -> "HH:MM" (local), and back to ISO given a date.
function isoToTimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function dateAndTimeToIso(dateIso, timeStr) {
  if (!dateIso || !timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const d = parseDate(dateIso);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// CSV building
function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function buildCsv(rows) {
  return rows.map(r => r.map(csvEscape).join(',')).join('\n');
}
function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

window.TC = {
  MS, MIN, HR, DAY, pad, isoDate, parseDate, startOfWeek, addDays,
  weekRange, weekDays, fmtTime, fmtDuration, fmtHours, fmtDayShort,
  fmtDayLong, fmtRange, entryHours, isoToTimeInput, dateAndTimeToIso,
  uid, csvEscape, buildCsv, downloadCsv,
};
