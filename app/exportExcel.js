// app/exportExcel.js — branded pay-period Excel export.
// Uses HTML Excel format (Excel opens it with full CSS colors/fonts).
// SpreadsheetML styles are often stripped by Sheets / Excel Online.

(function () {
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function caps(s) {
    return String(s).toUpperCase().replace(/I/g, 'i');
  }

  function fmtNum(n) {
    return (Number(n) || 0).toFixed(2);
  }

  function buildPayPeriodHtml(state, payPeriod) {
    const TC = window.TC;
    const user = state.users.find(u => u.id === payPeriod.userId) || {};
    const dir = state.users.find(u => u.role === 'director') || {};
    const pp = window.payPeriodForDate(payPeriod.periodStart, state.settings);
    const totals = window.payPeriodTotals(state, payPeriod.periodStart, payPeriod.userId);
    const signedName = payPeriod.signedName || dir.name || 'Director';
    const signedTitle = payPeriod.signedTitle || dir.title || 'Director';
    const signedAt = payPeriod.signedAt || payPeriod.decidedAt;
    const signedAtLabel = signedAt
      ? new Date(signedAt).toLocaleString(undefined, {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })
      : '—';
    const payDateLabel = TC.parseDate(pp.payDate).toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    const exportedAt = new Date().toLocaleString();
    const status = payPeriod.status === 'approved'
      ? 'APPROVED · SIGNED OFF'
      : (payPeriod.status || 'pending').toUpperCase();

    const dayRows = [];
    const start = TC.parseDate(pp.periodStart);
    const end = TC.parseDate(pp.periodEnd);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateIso = TC.isoDate(d);
      const dayLabel = d.toLocaleDateString(undefined, { weekday: 'short' });
      const entries = state.timeEntries.filter(e => e.userId === payPeriod.userId && e.date === dateIso);
      const leaves = state.leaveEntries.filter(l => l.userId === payPeriod.userId && l.date === dateIso);
      const ptoH = leaves.filter(l => l.type === 'pto').reduce((a, l) => a + l.hours, 0);
      const sickH = leaves.filter(l => l.type === 'sick').reduce((a, l) => a + l.hours, 0);
      const holH = leaves.filter(l => l.type === 'holiday').reduce((a, l) => a + l.hours, 0);
      const lwopH = leaves.filter(l => l.type === 'lwop').reduce((a, l) => a + l.hours, 0);

      if (entries.length === 0 && leaves.length === 0) continue;

      if (entries.length === 0) {
        dayRows.push({
          dateIso, dayLabel,
          clockIn: '—', clockOut: '—', breakMin: '',
          work: 0, pto: ptoH, sick: sickH, holiday: holH, lwop: lwopH,
          total: ptoH + sickH + holH,
          notes: leaves.map(l => l.name || l.type).join('; '),
        });
      } else {
        entries.forEach((e, idx) => {
          const hrs = TC.entryHours(e);
          const notes = [];
          if (e.manuallyEdited) notes.push('Edited');
          if (e.estimated) notes.push('Estimate');
          dayRows.push({
            dateIso: idx === 0 ? dateIso : '',
            dayLabel: idx === 0 ? dayLabel : '',
            clockIn: e.clockIn ? TC.fmtTime(e.clockIn) : '—',
            clockOut: e.clockOut ? TC.fmtTime(e.clockOut) : '—',
            breakMin: e.breakMinutes || 0,
            work: hrs,
            pto: idx === 0 ? ptoH : '',
            sick: idx === 0 ? sickH : '',
            holiday: idx === 0 ? holH : '',
            lwop: idx === 0 ? lwopH : '',
            total: idx === 0 ? hrs + ptoH + sickH + holH : hrs,
            notes: notes.join(', '),
          });
        });
      }
    }

    const detailHtml = dayRows.map(r => `
      <tr>
        <td class="cell">${escapeHtml(r.dateIso)}</td>
        <td class="cell">${escapeHtml(r.dayLabel)}</td>
        <td class="cell">${escapeHtml(r.clockIn)}</td>
        <td class="cell">${escapeHtml(r.clockOut)}</td>
        <td class="num">${r.breakMin === '' ? '' : escapeHtml(r.breakMin)}</td>
        <td class="num">${fmtNum(r.work)}</td>
        <td class="num">${r.pto === '' ? '' : fmtNum(r.pto)}</td>
        <td class="num">${r.sick === '' ? '' : fmtNum(r.sick)}</td>
        <td class="num">${r.holiday === '' ? '' : fmtNum(r.holiday)}</td>
        <td class="num">${r.lwop === '' ? '' : fmtNum(r.lwop)}</td>
        <td class="total">${fmtNum(r.total)}</td>
        <td class="cell">${escapeHtml(r.notes)}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8" />
<!--[if gte mso 9]><xml>
 <x:ExcelWorkbook>
  <x:ExcelWorksheets>
   <x:ExcelWorksheet>
    <x:Name>${escapeHtml(pp.label.replace(/[–—]/g, '-'))}</x:Name>
    <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
   </x:ExcelWorksheet>
  </x:ExcelWorksheets>
 </x:ExcelWorkbook>
</xml><![endif]-->
<style>
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #003E56;
    font-size: 11pt;
    margin: 18px;
  }
  .org {
    font-size: 16pt;
    font-weight: 700;
    color: #1FBDD6;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .subtitle {
    font-size: 9pt;
    color: #6B6F75;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 12px;
  }
  .badge {
    display: inline-block;
    background: #1FBDD6;
    color: #FFFFFF;
    font-weight: 700;
    font-size: 10pt;
    padding: 6px 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .meta {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 16px;
    background: #FAECE5;
  }
  .meta td {
    padding: 8px 10px;
    border: 1px solid #f0d8c8;
    vertical-align: top;
  }
  .meta .lbl {
    font-size: 8pt;
    font-weight: 700;
    color: #6B6F75;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .meta .val {
    font-size: 11pt;
    font-weight: 700;
    color: #003E56;
  }
  .totals {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 18px;
  }
  .totals th {
    background: #003E56;
    color: #FFFFFF;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 8px;
    border: 1px solid #003E56;
  }
  .totals td {
    text-align: center;
    font-weight: 700;
    font-size: 14pt;
    padding: 10px 8px;
    border: 1px solid #003E56;
    background: #FAECE5;
    color: #003E56;
  }
  .totals td.grand {
    background: #003E56;
    color: #FFFFFF;
    font-size: 16pt;
  }
  table.days {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 18px;
  }
  table.days th {
    background: #FAECE5;
    color: #6B6F75;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    text-align: left;
    padding: 8px;
    border-bottom: 2px solid #003E56;
  }
  table.days td.cell {
    padding: 7px 8px;
    border-bottom: 1px solid #E5E7EB;
    color: #003E56;
    font-size: 10pt;
  }
  table.days td.num,
  table.days td.total {
    padding: 7px 8px;
    border-bottom: 1px solid #E5E7EB;
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: #003E56;
    font-size: 10pt;
  }
  table.days td.total { font-weight: 700; }
  .sig {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
    border-top: 2px solid #003E56;
  }
  .sig td { padding: 10px 8px 4px; vertical-align: top; }
  .sig .lbl {
    font-size: 8pt;
    font-weight: 700;
    color: #6B6F75;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .sig .mark {
    font-family: 'Brush Script MT', 'Apple Chancery', cursive;
    font-size: 16pt;
    color: #1FBDD6;
  }
  .sig .name {
    font-weight: 700;
    color: #003E56;
    border-bottom: 1px solid #003E56;
    padding-bottom: 4px;
    display: inline-block;
    min-width: 220px;
  }
  .footer {
    margin-top: 22px;
    padding-top: 10px;
    border-top: 1px solid #E5E7EB;
    font-size: 8pt;
    color: #6B6F75;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .note {
    margin-top: 12px;
    padding: 8px 12px;
    background: #FAECE5;
    border-left: 3px solid #1FBDD6;
    color: #003E56;
    font-size: 10pt;
  }
</style>
</head>
<body>
  <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
    <tr>
      <td>
        <div class="org">The Representation Project</div>
        <div class="subtitle">${escapeHtml(caps('Timecard · Pay Period Receipt'))}</div>
      </td>
      <td style="text-align:right; vertical-align:top;">
        <span class="badge">✓ ${escapeHtml(status)}</span>
      </td>
    </tr>
  </table>

  <table class="meta">
    <tr>
      <td>
        <div class="lbl">${escapeHtml(caps('Employee'))}</div>
        <div class="val">${escapeHtml(user.name || '—')}</div>
        <div style="font-size:9pt;color:#6B6F75;margin-top:2px;">${escapeHtml(user.title || '')}${user.email ? ' · ' + escapeHtml(user.email) : ''}</div>
      </td>
      <td>
        <div class="lbl">${escapeHtml(caps('Pay Date'))}</div>
        <div class="val">${escapeHtml(payDateLabel)}</div>
      </td>
    </tr>
    <tr>
      <td>
        <div class="lbl">${escapeHtml(caps('Period Dates'))}</div>
        <div class="val">${escapeHtml(TC.fmtRange(pp.periodStart, pp.periodEnd))}</div>
      </td>
      <td>
        <div class="lbl">${escapeHtml(caps('Schedule'))}</div>
        <div class="val">Semi-monthly</div>
      </td>
    </tr>
  </table>

  <table class="totals">
    <tr>
      <th>${escapeHtml(caps('Total Hours'))}</th>
      <th>${escapeHtml(caps('Clocked'))}</th>
      <th>${escapeHtml(caps('PTO'))}</th>
      <th>${escapeHtml(caps('Sick'))}</th>
      <th>${escapeHtml(caps('Holiday'))}</th>
      <th>${escapeHtml(caps('LWOP'))}</th>
    </tr>
    <tr>
      <td class="grand">${fmtNum(totals.total)}</td>
      <td>${fmtNum(totals.work)}</td>
      <td>${fmtNum(totals.pto)}</td>
      <td>${fmtNum(totals.sick)}</td>
      <td>${fmtNum(totals.holiday || 0)}</td>
      <td>${fmtNum(totals.lwop || 0)}</td>
    </tr>
  </table>

  <table class="days">
    <thead>
      <tr>
        <th>${escapeHtml(caps('Date'))}</th>
        <th>${escapeHtml(caps('Day'))}</th>
        <th>${escapeHtml(caps('Clock In'))}</th>
        <th>${escapeHtml(caps('Clock Out'))}</th>
        <th>${escapeHtml(caps('Break'))}</th>
        <th>${escapeHtml(caps('Worked'))}</th>
        <th>${escapeHtml(caps('PTO'))}</th>
        <th>${escapeHtml(caps('Sick'))}</th>
        <th>${escapeHtml(caps('Holiday'))}</th>
        <th>${escapeHtml(caps('LWOP'))}</th>
        <th>${escapeHtml(caps('Daily Total'))}</th>
        <th>${escapeHtml(caps('Notes'))}</th>
      </tr>
    </thead>
    <tbody>
      ${detailHtml || '<tr><td class="cell" colspan="12">No hours logged in this pay period</td></tr>'}
    </tbody>
  </table>

  <table class="sig">
    <tr>
      <td>
        <div class="lbl">${escapeHtml(caps('Approved by supervisor'))}</div>
        <div class="mark">/s/ ${escapeHtml(signedName)}</div>
        <div class="name">${escapeHtml(signedName)}</div>
        <div style="font-size:9pt;color:#6B6F75;margin-top:4px;">${escapeHtml(signedTitle)}</div>
      </td>
      <td>
        <div class="lbl">${escapeHtml(caps('Approval timestamp'))}</div>
        <div class="val" style="font-weight:700;color:#003E56;margin-top:6px;">${escapeHtml(signedAtLabel)}</div>
      </td>
    </tr>
  </table>

  ${payPeriod.directorComment ? `
    <div class="note">
      <strong style="font-size:8pt;text-transform:uppercase;letter-spacing:0.06em;color:#6B6F75;">Note from supervisor</strong><br/>
      ${escapeHtml(payPeriod.directorComment)}
    </div>
  ` : ''}

  <div class="footer">
    The Representation Project · 5716 Folsom Blvd #155 · Sacramento CA 95819
    &nbsp;&nbsp;·&nbsp;&nbsp; Generated ${escapeHtml(exportedAt)}
  </div>
</body>
</html>`;
  }

  function downloadPayPeriodExcel(state, payPeriod) {
    if (!state || !payPeriod || !payPeriod.periodStart) {
      console.error('[Timecard] Excel export missing pay period');
      alert('Could not export this pay period. Try refreshing and downloading again.');
      return;
    }
    if (typeof window.payPeriodForDate !== 'function' || typeof window.payPeriodTotals !== 'function') {
      console.error('[Timecard] Excel export helpers not loaded');
      alert('Excel export is still loading. Wait a second and try again.');
      return;
    }

    const pp = window.payPeriodForDate(payPeriod.periodStart, state.settings);
    const html = buildPayPeriodHtml(state, payPeriod);
    // UTF-8 BOM helps Excel recognize encoding and keep branded styles.
    const blob = new Blob(['\ufeff', html], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TRP-Timecard-${pp.periodStart}-to-${pp.periodEnd}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  window.downloadPayPeriodExcel = downloadPayPeriodExcel;
})();
