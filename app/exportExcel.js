// app/exportExcel.js — branded Excel export (pay period + History date range).
// Uses HTML Excel format (Excel opens it with full CSS colors/fonts).

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

  function collectDayRows(state, userId, startIso, endIso) {
    const TC = window.TC;
    const dayRows = [];
    const start = TC.parseDate(startIso);
    const end = TC.parseDate(endIso);
    let work = 0, pto = 0, sick = 0, holiday = 0, lwop = 0, total = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateIso = TC.isoDate(d);
      const dayLabel = d.toLocaleDateString(undefined, { weekday: 'short' });
      const entries = state.timeEntries.filter(e => e.userId === userId && e.date === dateIso);
      const leaves = state.leaveEntries.filter(l => l.userId === userId && l.date === dateIso);
      const ptoH = leaves.filter(l => l.type === 'pto').reduce((a, l) => a + l.hours, 0);
      const sickH = leaves.filter(l => l.type === 'sick').reduce((a, l) => a + l.hours, 0);
      const holH = leaves.filter(l => l.type === 'holiday').reduce((a, l) => a + l.hours, 0);
      const lwopH = leaves.filter(l => l.type === 'lwop').reduce((a, l) => a + l.hours, 0);

      if (entries.length === 0 && leaves.length === 0) continue;

      if (entries.length === 0) {
        const dayTotal = ptoH + sickH + holH;
        pto += ptoH; sick += sickH; holiday += holH; lwop += lwopH; total += dayTotal;
        dayRows.push({
          dateIso, dayLabel,
          clockIn: '—', clockOut: '—', breakMin: '',
          work: 0, pto: ptoH, sick: sickH, holiday: holH, lwop: lwopH,
          total: dayTotal,
          notes: leaves.map(l => l.name || l.type).join('; '),
        });
      } else {
        entries.forEach((e, idx) => {
          const hrs = TC.entryHours(e);
          work += hrs;
          if (idx === 0) { pto += ptoH; sick += sickH; holiday += holH; lwop += lwopH; }
          const dayTotal = idx === 0 ? hrs + ptoH + sickH + holH : hrs;
          total += dayTotal;
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
            total: dayTotal,
            notes: notes.join(', '),
          });
        });
      }
    }

    return { dayRows, totals: { work, pto, sick, holiday, lwop, total } };
  }

  function excelStyles() {
    return `
  body { font-family: Arial, Helvetica, sans-serif; color: #003E56; font-size: 11pt; margin: 18px; }
  .org { font-size: 16pt; font-weight: 700; color: #1FBDD6; text-transform: uppercase; letter-spacing: 0.06em; }
  .subtitle { font-size: 9pt; color: #6B6F75; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; }
  .badge { display: inline-block; background: #1FBDD6; color: #FFFFFF; font-weight: 700; font-size: 10pt; padding: 6px 12px; text-transform: uppercase; letter-spacing: 0.06em; }
  .meta { width: 100%; border-collapse: collapse; margin: 12px 0 16px; background: #FAECE5; }
  .meta td { padding: 8px 10px; border: 1px solid #f0d8c8; vertical-align: top; }
  .meta .lbl { font-size: 8pt; font-weight: 700; color: #6B6F75; text-transform: uppercase; letter-spacing: 0.06em; }
  .meta .val { font-size: 11pt; font-weight: 700; color: #003E56; }
  .totals { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  .totals th { background: #003E56; color: #FFFFFF; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 8px; border: 1px solid #003E56; }
  .totals td { text-align: center; font-weight: 700; font-size: 14pt; padding: 10px 8px; border: 1px solid #003E56; background: #FAECE5; color: #003E56; }
  .totals td.grand { background: #003E56; color: #FFFFFF; font-size: 16pt; }
  table.days { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  table.days th { background: #FAECE5; color: #6B6F75; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; text-align: left; padding: 8px; border-bottom: 2px solid #003E56; }
  table.days td.cell { padding: 7px 8px; border-bottom: 1px solid #E5E7EB; color: #003E56; font-size: 10pt; }
  table.days td.num, table.days td.total { padding: 7px 8px; border-bottom: 1px solid #E5E7EB; text-align: right; color: #003E56; font-size: 10pt; }
  table.days td.total { font-weight: 700; }
  .sig { width: 100%; border-collapse: collapse; margin-top: 8px; border-top: 2px solid #003E56; }
  .sig td { padding: 10px 8px 4px; vertical-align: top; }
  .sig .lbl { font-size: 8pt; font-weight: 700; color: #6B6F75; text-transform: uppercase; letter-spacing: 0.06em; }
  .sig .mark { font-family: 'Brush Script MT', 'Apple Chancery', cursive; font-size: 16pt; color: #1FBDD6; }
  .sig .name { font-weight: 700; color: #003E56; border-bottom: 1px solid #003E56; padding-bottom: 4px; display: inline-block; min-width: 220px; }
  .footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #E5E7EB; font-size: 8pt; color: #6B6F75; text-transform: uppercase; letter-spacing: 0.06em; }
  .note { margin-top: 12px; padding: 8px 12px; background: #FAECE5; border-left: 3px solid #1FBDD6; color: #003E56; font-size: 10pt; }
`;
  }

  function buildBrandedHtml({
    sheetName,
    status,
    subtitle,
    user,
    rangeLabel,
    extras,
    totals,
    dayRows,
    signature,
    note,
  }) {
    const exportedAt = new Date().toLocaleString();
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

    const safeSheet = String(sheetName || 'Timecard').replace(/[–—:/\\?*\[\]]/g, '-').slice(0, 31);

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
    <x:Name>${escapeHtml(safeSheet)}</x:Name>
    <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
   </x:ExcelWorksheet>
  </x:ExcelWorksheets>
 </x:ExcelWorkbook>
</xml><![endif]-->
<style>${excelStyles()}</style>
</head>
<body>
  <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
    <tr>
      <td>
        <div class="org">The Representation Project</div>
        <div class="subtitle">${escapeHtml(caps(subtitle || 'Timecard Export'))}</div>
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
        <div class="lbl">${escapeHtml(caps('Date Range'))}</div>
        <div class="val">${escapeHtml(rangeLabel)}</div>
      </td>
    </tr>
    ${(extras || []).map(row => `
    <tr>
      <td>
        <div class="lbl">${escapeHtml(caps(row.leftLabel || ''))}</div>
        <div class="val">${escapeHtml(row.leftValue || '')}</div>
      </td>
      <td>
        <div class="lbl">${escapeHtml(caps(row.rightLabel || ''))}</div>
        <div class="val">${escapeHtml(row.rightValue || '')}</div>
      </td>
    </tr>`).join('')}
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
      ${detailHtml || '<tr><td class="cell" colspan="12">No hours logged in this range</td></tr>'}
    </tbody>
  </table>

  ${signature ? `
  <table class="sig">
    <tr>
      <td>
        <div class="lbl">${escapeHtml(caps('Approved by supervisor'))}</div>
        <div class="mark">/s/ ${escapeHtml(signature.name)}</div>
        <div class="name">${escapeHtml(signature.name)}</div>
        <div style="font-size:9pt;color:#6B6F75;margin-top:4px;">${escapeHtml(signature.title || '')}</div>
      </td>
      <td>
        <div class="lbl">${escapeHtml(caps('Approval timestamp'))}</div>
        <div class="val" style="font-weight:700;color:#003E56;margin-top:6px;">${escapeHtml(signature.when || '—')}</div>
      </td>
    </tr>
  </table>` : ''}

  ${note ? `
    <div class="note">
      <strong style="font-size:8pt;text-transform:uppercase;letter-spacing:0.06em;color:#6B6F75;">Note</strong><br/>
      ${escapeHtml(note)}
    </div>
  ` : ''}

  <div class="footer">
    The Representation Project · 5716 Folsom Blvd #155 · Sacramento CA 95819
    &nbsp;&nbsp;·&nbsp;&nbsp; Generated ${escapeHtml(exportedAt)}
  </div>
</body>
</html>`;
  }

  function triggerDownload(html, filename) {
    const blob = new Blob(['\ufeff', html], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function buildPayPeriodHtml(state, payPeriod) {
    const TC = window.TC;
    const user = state.users.find(u => u.id === payPeriod.userId) || {};
    const dir = state.users.find(u => u.role === 'director') || {};
    const pp = window.payPeriodForDate(payPeriod.periodStart, state.settings);
    const { dayRows, totals } = collectDayRows(state, payPeriod.userId, pp.periodStart, pp.periodEnd);
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
    const status = payPeriod.status === 'approved'
      ? 'APPROVED · SIGNED OFF'
      : (payPeriod.status || 'pending').toUpperCase();

    return buildBrandedHtml({
      sheetName: pp.label,
      status,
      subtitle: 'Timecard · Pay Period Receipt',
      user,
      rangeLabel: TC.fmtRange(pp.periodStart, pp.periodEnd),
      extras: [
        { leftLabel: 'Pay Date', leftValue: payDateLabel, rightLabel: 'Schedule', rightValue: 'Semi-monthly' },
      ],
      totals,
      dayRows,
      signature: { name: signedName, title: signedTitle, when: signedAtLabel },
      note: payPeriod.directorComment || '',
    });
  }

  function downloadPayPeriodExcel(state, payPeriod) {
    if (!state || !payPeriod || !payPeriod.periodStart) {
      console.error('[Timecard] Excel export missing pay period');
      alert('Could not export this pay period. Try refreshing and downloading again.');
      return;
    }
    if (typeof window.payPeriodForDate !== 'function') {
      alert('Excel export is still loading. Wait a second and try again.');
      return;
    }
    const pp = window.payPeriodForDate(payPeriod.periodStart, state.settings);
    const html = buildPayPeriodHtml(state, payPeriod);
    triggerDownload(html, `TRP-Timecard-${pp.periodStart}-to-${pp.periodEnd}.xls`);
  }

  // History / custom range — same TRP branding as pay-period export.
  function downloadRangeExcel(state, userId, startIso, endIso) {
    const TC = window.TC;
    if (!state || !userId || !startIso || !endIso) {
      alert('Could not export that date range.');
      return;
    }
    const user = state.users.find(u => u.id === userId) || {};
    const dir = state.users.find(u => u.role === 'director') || {};
    const { dayRows, totals } = collectDayRows(state, userId, startIso, endIso);

    let status = 'TIMECARD EXPORT';
    let signature = null;
    let note = '';
    let extras = [
      { leftLabel: 'Supervisor', leftValue: dir.name || '—', rightLabel: 'Schedule', rightValue: 'Semi-monthly' },
    ];

    if (typeof window.payPeriodForDate === 'function' && typeof window.payPeriodRecord === 'function') {
      const ppStart = window.payPeriodForDate(startIso, state.settings);
      const ppEnd = window.payPeriodForDate(endIso, state.settings);
      if (ppStart.periodStart === startIso && ppStart.periodEnd === endIso && ppStart.periodStart === ppEnd.periodStart) {
        const rec = window.payPeriodRecord(state, startIso, userId);
        if (rec && rec.status === 'approved') {
          status = rec.signedViaReceipt ? 'APPROVED · SIGNED OFF' : 'APPROVED';
          const signedAt = rec.signedAt || rec.decidedAt;
          signature = {
            name: rec.signedName || dir.name || 'Director',
            title: rec.signedTitle || dir.title || 'Director',
            when: signedAt
              ? new Date(signedAt).toLocaleString(undefined, {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                  hour: 'numeric', minute: '2-digit',
                })
              : '—',
          };
          note = rec.directorComment || '';
          extras = [
            {
              leftLabel: 'Pay Date',
              leftValue: TC.parseDate(ppStart.payDate).toLocaleDateString(undefined, {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              }),
              rightLabel: 'Pay Period',
              rightValue: ppStart.label,
            },
          ];
        } else {
          status = (rec && rec.status ? rec.status : 'PENDING').toUpperCase();
          extras = [
            {
              leftLabel: 'Pay Period',
              leftValue: ppStart.label,
              rightLabel: 'Pay Date',
              rightValue: TC.parseDate(ppStart.payDate).toLocaleDateString(undefined, {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              }),
            },
          ];
        }
      }
    }

    const html = buildBrandedHtml({
      sheetName: 'Timecard',
      status,
      subtitle: 'Timecard · Branded Export',
      user,
      rangeLabel: TC.fmtRange(startIso, endIso),
      extras,
      totals,
      dayRows,
      signature,
      note,
    });
    triggerDownload(html, `TRP-Timecard-${startIso}-to-${endIso}.xls`);
  }

  window.downloadPayPeriodExcel = downloadPayPeriodExcel;
  window.downloadRangeExcel = downloadRangeExcel;
})();
