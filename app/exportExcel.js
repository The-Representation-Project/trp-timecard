// app/exportExcel.js — branded pay-period Excel export (SpreadsheetML).
// Matches TRP PDF receipt styling: Pacific Blue headers, cream accents, totals grid.

(function () {
  function escapeXml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function caps(s) {
    return String(s).toUpperCase().replace(/I/g, 'i');
  }

  function cell(value, styleId, type) {
    const t = type || (typeof value === 'number' ? 'Number' : 'String');
    const v = value == null ? '' : value;
    return `<Cell ss:StyleID="${styleId}"><Data ss:Type="${t}">${escapeXml(v)}</Data></Cell>`;
  }

  function row(cells, height) {
    const h = height ? ` ss:Height="${height}"` : '';
    return `<Row${h}>${cells.join('')}</Row>`;
  }

  function buildPayPeriodRows(state, payPeriod) {
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
    const status = payPeriod.status === 'approved' ? 'APPROVED · SIGNED OFF' : (payPeriod.status || 'pending').toUpperCase();

    const rows = [];

    // Title block
    rows.push(row([cell('The Representation Project', 'Org'), cell('', 'Blank'), cell('', 'Blank'), cell('', 'Blank'), cell('', 'Blank'), cell('', 'Blank'), cell(status, 'Badge')], 28));
    rows.push(row([cell(caps('Timecard · Pay Period Receipt'), 'Subtitle')]));
    rows.push(row([cell('', 'Blank')]));

    rows.push(row([
      cell(caps('Employee'), 'Label'), cell(user.name || '—', 'Value'),
      cell(caps('Pay Date'), 'Label'), cell(payDateLabel, 'Value'),
    ]));
    rows.push(row([
      cell(caps('Title'), 'Label'), cell(user.title || '', 'Value'),
      cell(caps('Email'), 'Label'), cell(user.email || '', 'Value'),
    ]));
    rows.push(row([
      cell(caps('Period'), 'Label'), cell(TC.fmtRange(pp.periodStart, pp.periodEnd), 'Value'),
      cell(caps('Schedule'), 'Label'), cell('Semi-monthly', 'Value'),
    ]));
    rows.push(row([cell('', 'Blank')]));

    // Totals strip
    rows.push(row([
      cell(caps('Total Hours'), 'TotalsLabel'),
      cell(caps('Clocked'), 'TotalsLabel'),
      cell(caps('PTO'), 'TotalsLabel'),
      cell(caps('Sick'), 'TotalsLabel'),
      cell(caps('Holiday'), 'TotalsLabel'),
      cell(caps('LWOP'), 'TotalsLabel'),
    ]));
    rows.push(row([
      cell(totals.total, 'TotalsGrand', 'Number'),
      cell(totals.work, 'TotalsNum', 'Number'),
      cell(totals.pto, 'TotalsNum', 'Number'),
      cell(totals.sick, 'TotalsNum', 'Number'),
      cell(totals.holiday || 0, 'TotalsNum', 'Number'),
      cell(totals.lwop || 0, 'TotalsNum', 'Number'),
    ]));
    rows.push(row([cell('', 'Blank')]));

    // Daily detail header
    rows.push(row([
      cell(caps('Date'), 'TableHead'),
      cell(caps('Day'), 'TableHead'),
      cell(caps('Clock In'), 'TableHead'),
      cell(caps('Clock Out'), 'TableHead'),
      cell(caps('Break (min)'), 'TableHead'),
      cell(caps('Worked'), 'TableHead'),
      cell(caps('PTO'), 'TableHead'),
      cell(caps('Sick'), 'TableHead'),
      cell(caps('Holiday'), 'TableHead'),
      cell(caps('LWOP'), 'TableHead'),
      cell(caps('Daily Total'), 'TableHead'),
      cell(caps('Notes'), 'TableHead'),
    ]));

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
        const dailyTotal = ptoH + sickH + holH;
        rows.push(row([
          cell(dateIso, 'TableCell'),
          cell(dayLabel, 'TableCell'),
          cell('—', 'TableCell'),
          cell('—', 'TableCell'),
          cell('', 'TableCell'),
          cell(0, 'TableNum', 'Number'),
          cell(ptoH, 'TableNum', 'Number'),
          cell(sickH, 'TableNum', 'Number'),
          cell(holH, 'TableNum', 'Number'),
          cell(lwopH, 'TableNum', 'Number'),
          cell(dailyTotal, 'TableTotal', 'Number'),
          cell(leaves.map(l => l.name || l.type).join('; '), 'TableCell'),
        ]));
      } else {
        entries.forEach((e, idx) => {
          const hrs = TC.entryHours(e);
          const notes = [];
          if (e.manuallyEdited) notes.push('Edited');
          if (e.estimated) notes.push('Estimate');
          rows.push(row([
            cell(idx === 0 ? dateIso : '', 'TableCell'),
            cell(idx === 0 ? dayLabel : '', 'TableCell'),
            cell(e.clockIn ? TC.fmtTime(e.clockIn) : '—', 'TableCell'),
            cell(e.clockOut ? TC.fmtTime(e.clockOut) : '—', 'TableCell'),
            cell(e.breakMinutes || 0, 'TableNum', 'Number'),
            cell(hrs, 'TableNum', 'Number'),
            cell(idx === 0 ? ptoH : '', idx === 0 ? 'TableNum' : 'TableCell', idx === 0 ? 'Number' : undefined),
            cell(idx === 0 ? sickH : '', idx === 0 ? 'TableNum' : 'TableCell', idx === 0 ? 'Number' : undefined),
            cell(idx === 0 ? holH : '', idx === 0 ? 'TableNum' : 'TableCell', idx === 0 ? 'Number' : undefined),
            cell(idx === 0 ? lwopH : '', idx === 0 ? 'TableNum' : 'TableCell', idx === 0 ? 'Number' : undefined),
            cell(idx === 0 ? hrs + ptoH + sickH + holH : hrs, 'TableTotal', 'Number'),
            cell(notes.join(', '), 'TableCell'),
          ]));
        });
      }
    }

    rows.push(row([cell('', 'Blank')]));

    // Signature block
    rows.push(row([cell(caps('Approved by supervisor'), 'Label'), cell('', 'Blank'), cell(caps('Approval timestamp'), 'Label')]));
    rows.push(row([cell('/s/ ' + signedName, 'Signature'), cell('', 'Blank'), cell(signedAtLabel, 'Value')]));
    rows.push(row([cell(signedName + ' · ' + signedTitle, 'Value')]));
    if (payPeriod.directorComment) {
      rows.push(row([cell('', 'Blank')]));
      rows.push(row([cell(caps('Note from supervisor'), 'Label')]));
      rows.push(row([cell(payPeriod.directorComment, 'Value')]));
    }

    rows.push(row([cell('', 'Blank')]));
    rows.push(row([cell('The Representation Project · 5716 Folsom Blvd #155 · Sacramento CA 95819', 'Footer'), cell('', 'Blank'), cell('Generated ' + exportedAt, 'Footer')]));

    return { rows, pp, user };
  }

  function buildSpreadsheetXml(state, payPeriod) {
    const { rows, pp } = buildPayPeriodRows(state, payPeriod);

    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Styles>
    <Style ss:ID="Default"><Font ss:FontName="Lato" ss:Size="11" ss:Color="#003E56"/></Style>
    <Style ss:ID="Org"><Font ss:FontName="Arial" ss:Size="14" ss:Bold="1" ss:Color="#1FBDD6"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Subtitle"><Font ss:FontName="Arial" ss:Size="10" ss:Color="#6B6F75"/></Style>
    <Style ss:ID="Badge"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1FBDD6" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>
    <Style ss:ID="Label"><Font ss:FontName="Arial" ss:Size="9" ss:Bold="1" ss:Color="#6B6F75"/></Style>
    <Style ss:ID="Value"><Font ss:FontName="Lato" ss:Size="11" ss:Color="#003E56"/></Style>
    <Style ss:ID="TotalsLabel"><Font ss:FontName="Arial" ss:Size="9" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#003E56" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>
    <Style ss:ID="TotalsGrand"><Font ss:FontName="Arial" ss:Size="16" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#003E56" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/><NumberFormat ss:Format="0.00"/></Style>
    <Style ss:ID="TotalsNum"><Font ss:FontName="Arial" ss:Size="12" ss:Bold="1" ss:Color="#003E56"/><Interior ss:Color="#FAECE5" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/><NumberFormat ss:Format="0.00"/></Style>
    <Style ss:ID="TableHead"><Font ss:FontName="Arial" ss:Size="9" ss:Bold="1" ss:Color="#6B6F75"/><Interior ss:Color="#FAECE5" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#003E56"/></Borders></Style>
    <Style ss:ID="TableCell"><Font ss:FontName="Lato" ss:Size="10" ss:Color="#003E56"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders></Style>
    <Style ss:ID="TableNum"><Font ss:FontName="Lato" ss:Size="10" ss:Color="#003E56"/><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="0.00"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders></Style>
    <Style ss:ID="TableTotal"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#003E56"/><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="0.00"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders></Style>
    <Style ss:ID="Signature"><Font ss:FontName="Brush Script MT" ss:Size="14" ss:Color="#1FBDD6"/></Style>
    <Style ss:ID="Footer"><Font ss:FontName="Arial" ss:Size="8" ss:Color="#6B6F75"/></Style>
    <Style ss:ID="Blank"><Font ss:FontName="Lato" ss:Size="10"/></Style>
  </Styles>
  <Worksheet ss:Name="${escapeXml(pp.label)}">
    <Table>
      <Column ss:Width="90"/>
      <Column ss:Width="50"/>
      <Column ss:Width="70"/>
      <Column ss:Width="70"/>
      <Column ss:Width="55"/>
      <Column ss:Width="55"/>
      <Column ss:Width="45"/>
      <Column ss:Width="45"/>
      <Column ss:Width="55"/>
      <Column ss:Width="45"/>
      <Column ss:Width="60"/>
      <Column ss:Width="100"/>
      ${rows.join('\n      ')}
    </Table>
  </Worksheet>
</Workbook>`;
  }

  function downloadPayPeriodExcel(state, payPeriod) {
    const pp = window.payPeriodForDate(payPeriod.periodStart, state.settings);
    const xml = buildSpreadsheetXml(state, payPeriod);
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timecard-${pp.periodStart}-to-${pp.periodEnd}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  window.downloadPayPeriodExcel = downloadPayPeriodExcel;
})();
