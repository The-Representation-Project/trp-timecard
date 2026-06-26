// app/printReceipt.js — branded printable receipt for a signed-off pay period.
// Renders into a hidden iframe so all relative asset paths still resolve, then
// triggers the browser's print dialog (which lets the user "Save as PDF").

(function () {
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildReceiptHtml(state, payPeriod) {
    const TC = window.TC;
    const user = state.users.find(u => u.id === payPeriod.userId) || {};
    const dir = state.users.find(u => u.role === 'director') || {};
    const pp = window.payPeriodForDate(payPeriod.periodStart, state.settings);
    const totals = window.payPeriodTotals(state, payPeriod.periodStart, payPeriod.userId);
    const weekStarts = window.payPeriodWeekStarts(pp.periodStart, pp.periodEnd);
    const childWeeks = weekStarts
      .map(ws => ({ ws, sub: window.weekSubmission(state, ws, payPeriod.userId), tot: window.weekTotals(state, ws, payPeriod.userId) }))
      .filter(x => x.tot.total > 0);

    const decidedAt = payPeriod.decidedAt ? new Date(payPeriod.decidedAt) : null;
    const decidedLabel = decidedAt ? decidedAt.toLocaleString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    }) : '—';
    const signedName = payPeriod.signedName || dir.name || 'Director';
    const signedTitle = payPeriod.signedTitle || dir.title || 'Director';
    const signedAt = payPeriod.signedAt || payPeriod.decidedAt;
    const signedAtLabel = signedAt ? new Date(signedAt).toLocaleString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    }) : decidedLabel;
    const payDateLabel = TC.parseDate(pp.payDate).toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    const exportedAt = new Date().toLocaleString();

    const status = payPeriod.status === 'approved' ? 'APPROVED · SiGNED OFF' : payPeriod.status.toUpperCase();

    // Replace every uppercase 'I' with lowercase 'i' on caps headlines
    // (matching TRP's signature rule). The print doc doesn't load trp-headline-i.js,
    // so we hand-lowercase here.
    function caps(s) { return String(s).toUpperCase().replace(/I/g, 'i'); }

    const childRows = childWeeks.map(w => `
      <tr>
        <td class="day">${escapeHtml(TC.fmtRange(w.ws, TC.weekDays(w.ws)[6]))}</td>
        <td class="num">${w.tot.workTotal.toFixed(2)}</td>
        <td class="num">${w.tot.ptoTotal.toFixed(2)}</td>
        <td class="num">${w.tot.sickTotal.toFixed(2)}</td>
        <td class="num">${(w.tot.holidayTotal || 0).toFixed(2)}</td>
        <td class="num">${(w.tot.lwopTotal || 0).toFixed(2)}</td>
        <td class="num total">${w.tot.total.toFixed(2)}</td>
      </tr>
    `).join('');

    // Logo: use absolute URL so iframe srcdoc resolves correctly.
    const logoUrl = new URL('assets/TRP-Icon-Blue.png', window.location.href).href;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Pay Period Receipt · ${escapeHtml(user.name || 'Employee')} · ${escapeHtml(pp.label)}</title>
<style>
  @page { size: letter; margin: 0.6in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif;
    color: #003E56;
    background: white;
    font-size: 12px;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .display {
    font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid #003E56;
    padding-bottom: 14px;
    margin-bottom: 22px;
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { height: 44px; width: auto; }
  .brand .org {
    font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #1FBDD6;
    font-size: 12px;
    line-height: 1.2;
  }
  .brand .org .small { color: #003E56; font-size: 10px; display: block; margin-top: 3px; }

  .receipt-stamp {
    text-align: right;
  }
  .receipt-stamp .label {
    font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 10px;
    color: #003E56;
    opacity: 0.7;
  }
  .receipt-stamp .badge {
    display: inline-block;
    margin-top: 4px;
    padding: 6px 12px;
    background: #1FBDD6;
    color: white;
    font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 11px;
    border-radius: 4px;
  }

  h1 {
    font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 24px;
    margin: 0 0 4px;
    color: #003E56;
    line-height: 1.1;
  }
  .subtitle {
    font-size: 12px;
    color: #6B6F75;
    margin-bottom: 22px;
  }

  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px 22px;
    padding: 14px 16px;
    background: #FAECE5;
    border: 1px solid #f0d8c8;
    border-radius: 4px;
    margin-bottom: 20px;
  }
  .meta-grid .lbl {
    font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 9px;
    color: #6B6F75;
    margin-bottom: 3px;
  }
  .meta-grid .val { font-size: 13px; color: #003E56; font-weight: 700; }
  .meta-grid .val .small { display: block; font-weight: 400; color: #6B6F75; font-size: 11px; margin-top: 1px; }

  .totals {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr 1fr;
    gap: 0;
    border: 1px solid #003E56;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 22px;
  }
  .totals > div {
    padding: 14px 16px;
    border-right: 1px solid rgba(0, 62, 86, 0.15);
  }
  .totals > div:last-child { border-right: none; }
  .totals .grand { background: #003E56; color: white; }
  .totals .lbl {
    font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 9px;
    opacity: 0.7;
    margin-bottom: 4px;
  }
  .totals .val {
    font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    font-size: 22px;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .totals .val .unit { font-size: 11px; margin-left: 3px; opacity: 0.6; }

  table.weeks {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 22px;
    font-size: 12px;
  }
  table.weeks th {
    font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 9px;
    color: #6B6F75;
    text-align: left;
    padding: 8px 8px;
    border-bottom: 2px solid #003E56;
    background: #FAECE5;
  }
  table.weeks th.num { text-align: right; }
  table.weeks td {
    padding: 10px 8px;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: middle;
  }
  table.weeks td.day {
    font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 11px;
    color: #003E56;
  }
  table.weeks td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.weeks td.num.total { font-weight: 700; color: #003E56; }

  .signature {
    border-top: 2px solid #003E56;
    padding-top: 18px;
    margin-top: 12px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
  }
  .sigblock .lbl {
    font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 9px;
    color: #6B6F75;
    margin-bottom: 6px;
  }
  .sigblock .name {
    font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 14px;
    color: #003E56;
    border-bottom: 1px solid #003E56;
    padding-bottom: 6px;
    margin-bottom: 4px;
  }
  .sigblock .title { font-size: 11px; color: #6B6F75; }
  .sigblock .when {
    margin-top: 8px;
    font-size: 11px;
    color: #003E56;
  }
  .sigblock .when strong {
    font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 9px;
    color: #6B6F75;
    display: block;
    margin-bottom: 2px;
  }
  .sig-mark {
    font-family: 'Brush Script MT', 'Apple Chancery', cursive;
    font-size: 22px;
    color: #1FBDD6;
    padding: 0 0 4px;
    line-height: 1;
  }

  .note {
    margin-top: 18px;
    padding: 10px 14px;
    border-left: 3px solid #1FBDD6;
    background: #FAECE5;
    font-size: 11px;
    color: #003E56;
  }
  .note .from {
    font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 9px;
    color: #6B6F75;
    display: block;
    margin-bottom: 3px;
  }

  .footer {
    margin-top: 32px;
    padding-top: 14px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #6B6F75;
    font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  @media screen {
    body { padding: 24px; max-width: 800px; margin: 0 auto; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <img src="${escapeHtml(logoUrl)}" alt="The Representation Project" />
      <div class="org">
        The Representation Project
        <span class="small">${escapeHtml(caps('Timecard · Pay Period Receipt'))}</span>
      </div>
    </div>
    <div class="receipt-stamp">
      <div class="label">Status</div>
      <div class="badge">✓ ${escapeHtml(status)}</div>
    </div>
  </div>

  <h1>${escapeHtml(caps('Pay Period Receipt'))}</h1>
  <div class="subtitle">${escapeHtml(pp.label)} · ${escapeHtml(TC.parseDate(pp.periodStart).getFullYear())} &nbsp;·&nbsp; ${escapeHtml(TC.fmtRange(pp.periodStart, pp.periodEnd))}</div>

  <div class="meta-grid">
    <div>
      <div class="lbl">${escapeHtml(caps('Employee'))}</div>
      <div class="val">${escapeHtml(user.name || '—')}<span class="small">${escapeHtml(user.title || '')}${user.email ? ' · ' + escapeHtml(user.email) : ''}</span></div>
    </div>
    <div>
      <div class="lbl">${escapeHtml(caps('Pay Date'))}</div>
      <div class="val">${escapeHtml(payDateLabel)}</div>
    </div>
    <div>
      <div class="lbl">${escapeHtml(caps('Period Dates'))}</div>
      <div class="val">${escapeHtml(TC.fmtRange(pp.periodStart, pp.periodEnd))}</div>
    </div>
    <div>
      <div class="lbl">${escapeHtml(caps('Schedule'))}</div>
      <div class="val" style="font-size:12px;">${escapeHtml(caps((state.settings.payPeriodMode || 'semimonthly').replace(/_/g, ' ')))}</div>
    </div>
  </div>

  <div class="totals">
    <div class="grand">
      <div class="lbl">${escapeHtml(caps('Hours Worked'))}</div>
      <div class="val">${totals.total.toFixed(2)}<span class="unit">hrs</span></div>
    </div>
    <div>
      <div class="lbl">${escapeHtml(caps('Clocked in'))}</div>
      <div class="val">${totals.work.toFixed(2)}<span class="unit">hrs</span></div>
    </div>
    <div>
      <div class="lbl">${escapeHtml(caps('PTO'))}</div>
      <div class="val">${totals.pto.toFixed(2)}<span class="unit">hrs</span></div>
    </div>
    <div>
      <div class="lbl">${escapeHtml(caps('Sick'))}</div>
      <div class="val">${totals.sick.toFixed(2)}<span class="unit">hrs</span></div>
    </div>
    <div>
      <div class="lbl">${escapeHtml(caps('Holiday'))}</div>
      <div class="val">${(totals.holiday || 0).toFixed(2)}<span class="unit">hrs</span></div>
    </div>
    <div>
      <div class="lbl">${escapeHtml(caps('LWOP'))}</div>
      <div class="val">${(totals.lwop || 0).toFixed(2)}<span class="unit">hrs</span></div>
    </div>
  </div>

  <table class="weeks">
    <thead>
      <tr>
        <th>${escapeHtml(caps('Week'))}</th>
        <th class="num">${escapeHtml(caps('Clocked'))}</th>
        <th class="num">${escapeHtml(caps('PTO'))}</th>
        <th class="num">${escapeHtml(caps('Sick'))}</th>
        <th class="num">${escapeHtml(caps('Holiday'))}</th>
        <th class="num">${escapeHtml(caps('LWOP'))}</th>
        <th class="num">${escapeHtml(caps('Total'))}</th>
      </tr>
    </thead>
    <tbody>
      ${childRows}
    </tbody>
  </table>

  <div class="signature">
    <div class="sigblock">
      <div class="lbl">${escapeHtml(caps('Employee acknowledgment'))}</div>
      <div class="name">${escapeHtml(user.name || '—')}</div>
      <div class="title">${escapeHtml(user.title || '')}</div>
      <div class="when">
        <strong>${escapeHtml(caps('Submitted'))}</strong>
        Hours certified by employee for this period
      </div>
    </div>
    <div class="sigblock">
      <div class="lbl">${escapeHtml(caps('Approved by supervisor'))}</div>
      <div class="sig-mark">/s/ ${escapeHtml(signedName)}</div>
      <div class="name">${escapeHtml(signedName)}</div>
      <div class="title">${escapeHtml(signedTitle)}</div>
      <div class="when">
        <strong>${escapeHtml(caps('Approval Timestamp'))}</strong>
        ${escapeHtml(signedAtLabel)}
      </div>
    </div>
  </div>

  ${payPeriod.directorComment ? `
    <div class="note">
      <span class="from">${escapeHtml(caps('Note from ' + (dir.name || 'Supervisor')))}</span>
      ${escapeHtml(payPeriod.directorComment)}
    </div>
  ` : ''}

  <div class="footer">
    <div>The Representation Project · 5716 Folsom Blvd #155 · Sacramento CA 95819</div>
    <div>Generated ${escapeHtml(exportedAt)}</div>
  </div>
</body>
</html>`;
  }

  function printPayPeriodReceipt(state, payPeriod) {
    const html = buildReceiptHtml(state, payPeriod);
    // Hidden iframe so popups aren't blocked & relative URLs resolve.
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    // Wait for fonts / images to settle before printing.
    const fire = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error('Print failed', e);
      }
      // Remove after a moment so the print dialog has finished reading from it.
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1000);
    };

    if (iframe.contentWindow.document.readyState === 'complete') {
      setTimeout(fire, 250);
    } else {
      iframe.contentWindow.addEventListener('load', () => setTimeout(fire, 250));
    }
  }

  window.printPayPeriodReceipt = printPayPeriodReceipt;

  // ----- Approval-page variant ---------------------------------------------
  // Used by Approval.jsx (the standalone signing page Katrina sees). Built
  // from the URL-hash payload + signature rather than a full app state, so
  // it can run in the approval context where localStorage is untouched.

  function buildApprovalReceiptHtml(payload, signature) {
    const TC = window.TC;
    const { pp, employee, totals } = payload;
    const periodDays = payload.periodDays || [];
    const signedAt = signature.signedAt ? new Date(signature.signedAt) : new Date();
    const signedAtLabel = signedAt.toLocaleString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
    const payDateLabel = TC.parseDate(pp.payDate).toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    const exportedAt = new Date().toLocaleString();
    function caps(s) { return String(s).toUpperCase().replace(/I/g, 'i'); }

    const childRows = periodDays.map(d => `
      <tr>
        <td class="day">${escapeHtml(TC.fmtDayShort(d.dateIso))}</td>
        <td class="num">${(d.work || 0).toFixed(2)}</td>
        <td class="num">${(d.pto || 0).toFixed(2)}</td>
        <td class="num">${(d.sick || 0).toFixed(2)}</td>
        <td class="num">${(d.holiday || 0).toFixed(2)}</td>
        <td class="num">${(d.lwop || 0).toFixed(2)}</td>
        <td class="num total">${(d.total || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    const logoUrl = new URL('assets/TRP-Icon-Blue.png', window.location.href).href;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Pay Period Receipt · ${escapeHtml(employee.name)} · ${escapeHtml(pp.label)}</title>
<style>
  @page { size: letter; margin: 0.6in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif; color: #003E56; background: white; font-size: 12px; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #003E56; padding-bottom: 14px; margin-bottom: 22px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { height: 44px; width: auto; }
  .brand .org { font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #1FBDD6; font-size: 12px; line-height: 1.2; }
  .brand .org .small { color: #003E56; font-size: 10px; display: block; margin-top: 3px; }
  .receipt-stamp { text-align: right; }
  .receipt-stamp .label { font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; color: #003E56; opacity: 0.7; }
  .receipt-stamp .badge { display: inline-block; margin-top: 4px; padding: 6px 12px; background: #1FBDD6; color: white; font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; border-radius: 4px; }
  h1 { font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 24px; margin: 0 0 4px; color: #003E56; line-height: 1.1; }
  .subtitle { font-size: 12px; color: #6B6F75; margin-bottom: 22px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 22px; padding: 14px 16px; background: #FAECE5; border: 1px solid #f0d8c8; border-radius: 4px; margin-bottom: 20px; }
  .meta-grid .lbl { font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 9px; color: #6B6F75; margin-bottom: 3px; }
  .meta-grid .val { font-size: 13px; color: #003E56; font-weight: 700; }
  .meta-grid .val .small { display: block; font-weight: 400; color: #6B6F75; font-size: 11px; margin-top: 1px; }
  .totals { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 0; border: 1px solid #003E56; border-radius: 4px; overflow: hidden; margin-bottom: 22px; }
  .totals > div { padding: 14px 16px; border-right: 1px solid rgba(0, 62, 86, 0.15); }
  .totals > div:last-child { border-right: none; }
  .totals .grand { background: #003E56; color: white; }
  .totals .lbl { font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 9px; opacity: 0.7; margin-bottom: 4px; }
  .totals .val { font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif; font-weight: 700; font-size: 22px; font-variant-numeric: tabular-nums; line-height: 1; }
  .totals .val .unit { font-size: 11px; margin-left: 3px; opacity: 0.6; }
  table.weeks { width: 100%; border-collapse: collapse; margin-bottom: 22px; font-size: 12px; }
  table.weeks th { font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 9px; color: #6B6F75; text-align: left; padding: 8px 8px; border-bottom: 2px solid #003E56; background: #FAECE5; }
  table.weeks th.num { text-align: right; }
  table.weeks td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
  table.weeks td.day { font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; color: #003E56; }
  table.weeks td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.weeks td.num.total { font-weight: 700; color: #003E56; }
  .signature { border-top: 2px solid #003E56; padding-top: 18px; margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  .sigblock .lbl { font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 9px; color: #6B6F75; margin-bottom: 6px; }
  .sigblock .name { font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 14px; color: #003E56; border-bottom: 1px solid #003E56; padding-bottom: 6px; margin-bottom: 4px; }
  .sigblock .title { font-size: 11px; color: #6B6F75; }
  .sigblock .when { margin-top: 8px; font-size: 11px; color: #003E56; }
  .sigblock .when strong { font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 9px; color: #6B6F75; display: block; margin-bottom: 2px; }
  .sig-mark { font-family: 'Brush Script MT', 'Apple Chancery', cursive; font-size: 22px; color: #1FBDD6; padding: 0 0 4px; line-height: 1; }
  .note { margin-top: 18px; padding: 10px 14px; border-left: 3px solid #1FBDD6; background: #FAECE5; font-size: 11px; color: #003E56; }
  .note .from { font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 9px; color: #6B6F75; display: block; margin-bottom: 3px; }
  .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 9px; color: #6B6F75; font-family: 'LEMON MILK', 'Helvetica Neue', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.08em; }
  @media screen { body { padding: 24px; max-width: 800px; margin: 0 auto; } }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <img src="${escapeHtml(logoUrl)}" alt="The Representation Project" />
      <div class="org">
        The Representation Project
        <span class="small">${escapeHtml(caps('Timecard · Pay Period Receipt'))}</span>
      </div>
    </div>
    <div class="receipt-stamp">
      <div class="label">Status</div>
      <div class="badge">✓ ${escapeHtml(caps('Approved · Signed Off'))}</div>
    </div>
  </div>

  <h1>${escapeHtml(caps('Pay Period Receipt'))}</h1>
  <div class="subtitle">${escapeHtml(pp.label)} · ${escapeHtml(String(TC.parseDate(pp.periodStart).getFullYear()))} &nbsp;·&nbsp; ${escapeHtml(TC.fmtRange(pp.periodStart, pp.periodEnd))}</div>

  <div class="meta-grid">
    <div>
      <div class="lbl">${escapeHtml(caps('Employee'))}</div>
      <div class="val">${escapeHtml(employee.name)}<span class="small">${escapeHtml(employee.title || '')}${employee.email ? ' · ' + escapeHtml(employee.email) : ''}</span></div>
    </div>
    <div>
      <div class="lbl">${escapeHtml(caps('Pay Date'))}</div>
      <div class="val">${escapeHtml(payDateLabel)}</div>
    </div>
    <div>
      <div class="lbl">${escapeHtml(caps('Period Dates'))}</div>
      <div class="val">${escapeHtml(TC.fmtRange(pp.periodStart, pp.periodEnd))}</div>
    </div>
    <div>
      <div class="lbl">${escapeHtml(caps('Schedule'))}</div>
      <div class="val" style="font-size:12px;">${escapeHtml(caps('Semi-monthly'))}</div>
    </div>
  </div>

  <div class="totals">
    <div class="grand">
      <div class="lbl">${escapeHtml(caps('Hours Worked'))}</div>
      <div class="val">${(totals.total || 0).toFixed(2)}<span class="unit">hrs</span></div>
    </div>
    <div>
      <div class="lbl">${escapeHtml(caps('Clocked in'))}</div>
      <div class="val">${(totals.work || 0).toFixed(2)}<span class="unit">hrs</span></div>
    </div>
    <div>
      <div class="lbl">${escapeHtml(caps('PTO'))}</div>
      <div class="val">${(totals.pto || 0).toFixed(2)}<span class="unit">hrs</span></div>
    </div>
    <div>
      <div class="lbl">${escapeHtml(caps('Sick'))}</div>
      <div class="val">${(totals.sick || 0).toFixed(2)}<span class="unit">hrs</span></div>
    </div>
    <div>
      <div class="lbl">${escapeHtml(caps('Holiday'))}</div>
      <div class="val">${(totals.holiday || 0).toFixed(2)}<span class="unit">hrs</span></div>
    </div>
    <div>
      <div class="lbl">${escapeHtml(caps('LWOP'))}</div>
      <div class="val">${(totals.lwop || 0).toFixed(2)}<span class="unit">hrs</span></div>
    </div>
  </div>

  <table class="weeks">
    <thead>
      <tr>
        <th>${escapeHtml(caps('Day'))}</th>
        <th class="num">${escapeHtml(caps('Clocked'))}</th>
        <th class="num">${escapeHtml(caps('PTO'))}</th>
        <th class="num">${escapeHtml(caps('Sick'))}</th>
        <th class="num">${escapeHtml(caps('Holiday'))}</th>
        <th class="num">${escapeHtml(caps('LWOP'))}</th>
        <th class="num">${escapeHtml(caps('Total'))}</th>
      </tr>
    </thead>
    <tbody>${childRows}</tbody>
  </table>

  <div class="signature">
    <div class="sigblock">
      <div class="lbl">${escapeHtml(caps('Employee acknowledgment'))}</div>
      <div class="name">${escapeHtml(employee.name)}</div>
      <div class="title">${escapeHtml(employee.title || '')}</div>
      <div class="when">
        <strong>${escapeHtml(caps('Submitted'))}</strong>
        Hours certified by employee for this period
      </div>
    </div>
    <div class="sigblock">
      <div class="lbl">${escapeHtml(caps('Approved by supervisor'))}</div>
      <div class="sig-mark">/s/ ${escapeHtml(signature.signedName)}</div>
      <div class="name">${escapeHtml(signature.signedName)}</div>
      <div class="title">${escapeHtml(signature.signedTitle || '')}</div>
      <div class="when">
        <strong>${escapeHtml(caps('Approval Timestamp'))}</strong>
        ${escapeHtml(signedAtLabel)}
      </div>
    </div>
  </div>

  ${signature.comment ? `
    <div class="note">
      <span class="from">${escapeHtml(caps('Note from ' + signature.signedName))}</span>
      ${escapeHtml(signature.comment)}
    </div>
  ` : ''}

  <div class="footer">
    <div>The Representation Project · Timecard</div>
    <div>Generated ${escapeHtml(exportedAt)}</div>
  </div>
</body>
</html>`;
  }

  function printApprovalPDF(payload, signature) {
    const html = buildApprovalReceiptHtml(payload, signature);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0'; iframe.style.bottom = '0';
    iframe.style.width = '0'; iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();

    const fire = () => {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
      catch (e) { console.error('Print failed', e); }
      setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 1500);
    };
    if (iframe.contentWindow.document.readyState === 'complete') {
      setTimeout(fire, 250);
    } else {
      iframe.contentWindow.addEventListener('load', () => setTimeout(fire, 250));
    }
  }

  window.printApprovalPDF = printApprovalPDF;
})();
