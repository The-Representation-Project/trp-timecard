// app/History.jsx — Past weeks with status filters + CSV export

const { useState: useStateH, useMemo: useMemoH } = React;

function History() {
  const { state } = useStore();
  const user = currentUser(state);
  const targetUser = user;

  const [filter, setFilter] = useStateH('all');
  const [exportOpen, setExportOpen] = useStateH(false);

  const weeks = useMemoH(() => {
    return state.weekSubmissions
      .filter(w => w.userId === targetUser.id)
      .map(w => {
        const pp = payPeriodForDate(w.weekStart, state.settings);
        const ppRecord = payPeriodRecord(state, pp.periodStart, targetUser.id);
        return {
          ...w,
          totals: weekTotals(state, w.weekStart, targetUser.id),
          payPeriod: pp,
          payPeriodStatus: ppRecord ? ppRecord.status : 'pending',
        };
      })
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }, [state, targetUser.id]);

  const filtered = filter === 'all' ? weeks : weeks.filter(w => w.status === filter);

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'approved', label: 'Approved' },
    { key: 'changes_requested', label: 'Changes Requested' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">History</div>
          <h1>Past Weeks & Submissions</h1>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setExportOpen(true)}>↓ Export CSV</button>
        </div>
      </div>

      <div className="filter-row">
        <span className="eyebrow" style={{marginRight: 8}}>Filter:</span>
        {filters.map(f => (
          <button
            key={f.key}
            className={`chip ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card" style={{padding: 0, overflowX: 'auto'}}>
        {filtered.length === 0 ? (
          <div className="empty">
            <h3>No matching weeks</h3>
            <div>Try a different filter.</div>
          </div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Week</th>
                <th style={{textAlign: 'right'}}>Worked</th>
                <th style={{textAlign: 'right'}}>PTO</th>
                <th style={{textAlign: 'right'}}>Sick</th>
                <th style={{textAlign: 'right'}}>Holiday</th>
                <th style={{textAlign: 'right'}}>Total</th>
                <th>Week Status</th>
                <th>Pay Period</th>
                <th>Director Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(w => (
                <tr key={w.id}>
                  <td>
                    <strong style={{color: 'var(--trp-navy)'}}>{TC.fmtRange(w.weekStart, w.weekEnd)}</strong>
                    {w.submittedAt && <div className="tiny muted">Submitted {new Date(w.submittedAt).toLocaleDateString()}</div>}
                  </td>
                  <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(w.totals.workTotal)}</td>
                  <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(w.totals.ptoTotal)}</td>
                  <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(w.totals.sickTotal)}</td>
                  <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(w.totals.holidayTotal || 0)}</td>
                  <td className="tnum total" style={{textAlign: 'right', fontWeight: 700, color: 'var(--trp-navy)'}}>{TC.fmtHours(w.totals.total)}</td>
                  <td><Badge status={w.status} /></td>
                  <td>
                    {w.payPeriodStatus === 'approved' ? (
                      <span className="badge approved"><span className="dot" />Signed Off</span>
                    ) : (
                      <span className="tiny muted">{TC.fmtRange(w.payPeriod.periodStart, w.payPeriod.periodEnd)}</span>
                    )}
                  </td>
                  <td className="tiny muted">{w.directorComment || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {exportOpen && <ExportModal userId={targetUser.id} onClose={() => setExportOpen(false)} />}
    </div>
  );
}

function ExportModal({ userId, onClose }) {
  const { state } = useStore();
  const [mode, setMode] = useStateH('week'); // 'week' or 'range'
  // Default range: previous 4 weeks
  const today = new Date(2026, 4, 18);
  const monthAgo = new Date(today); monthAgo.setDate(monthAgo.getDate() - 28);
  const [startDate, setStartDate] = useStateH(TC.isoDate(monthAgo));
  const [endDate, setEndDate] = useStateH(TC.isoDate(today));
  const [selectedWeek, setSelectedWeek] = useStateH(TC.weekRange(today, 0).startIso);

  const weeks = state.weekSubmissions.filter(w => w.userId === userId)
    .map(w => w.weekStart).sort().reverse();

  function exportNow() {
    let start, end;
    if (mode === 'week') {
      start = selectedWeek;
      end = TC.weekDays(selectedWeek)[6];
    } else {
      start = startDate; end = endDate;
    }
    const rows = buildCsvRows(state, userId, start, end);
    const csv = TC.buildCsv(rows);
    TC.downloadCsv(`timecard-${start}-to-${end}.csv`, csv);
    onClose();
  }

  return (
    <Modal title="Export CSV" subtitle="Choose a week or a custom date range." onClose={onClose}>
      <label className="field">
        <span className="lbl">Scope</span>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8}}>
          <TypeButton active={mode === 'week'} onClick={() => setMode('week')} color="pacific">Single Week</TypeButton>
          <TypeButton active={mode === 'range'} onClick={() => setMode('range')} color="orange">Date Range</TypeButton>
        </div>
      </label>
      {mode === 'week' ? (
        <label className="field">
          <span className="lbl">Week</span>
          <select value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
            {weeks.map(w => (
              <option key={w} value={w}>{TC.fmtRange(w, TC.weekDays(w)[6])}</option>
            ))}
          </select>
        </label>
      ) : (
        <div className="field-row">
          <label className="field">
            <span className="lbl">Start Date</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </label>
          <label className="field">
            <span className="lbl">End Date</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </label>
        </div>
      )}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={exportNow}>↓ Download CSV</button>
      </div>
    </Modal>
  );
}

function buildCsvRows(state, userId, startIso, endIso) {
  const user = state.users.find(u => u.id === userId);
  const dir = state.users.find(u => u.role === 'director');
  const empName = user ? user.name : 'Employee';
  const empEmail = user ? user.email : '';
  const empTitle = user ? user.title : '';
  const dirName = dir ? dir.name : 'Director';
  const dirTitle = dir ? dir.title : 'Director';
  const exportedAt = new Date();

  // ----- Metadata header block -----
  const rows = [
    ['The Representation Project — Timecard Export'],
    ['Employee', empName, empEmail, empTitle],
    ['Supervisor', dirName, '', dirTitle],
    ['Date Range', startIso, 'to', endIso],
    ['Exported', exportedAt.toLocaleString()],
    [], // spacer
  ];

  // ----- Detail rows -----
  const headerRow = [
    'Date',
    'Day',
    'Clock In',
    'Clock Out',
    'Break Mins',
    'Worked Hours',
    'PTO Hours',
    'Sick Hours',
    'Holiday Hours',
    'Holiday Name',
    'Daily Total',
    'Manually Edited',
    'Week',
    'Week Status',
    'Approved By',
    'Approved At',
    'Supervisor Note',
    'Pay Period',
    'Pay Period Signed Off',
    'Pay Period Signed Off By',
    'Pay Period Signed Off At',
  ];
  rows.push(headerRow);

  let workedTotal = 0, ptoTotal = 0, sickTotal = 0, holidayTotal = 0;

  const start = TC.parseDate(startIso);
  const end = TC.parseDate(endIso);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateIso = TC.isoDate(d);
    const dayLabel = d.toLocaleDateString(undefined, { weekday: 'short' });
    const entries = state.timeEntries.filter(e => e.userId === userId && e.date === dateIso);
    const leaves = state.leaveEntries.filter(l => l.userId === userId && l.date === dateIso);
    const weekId = TC.weekRange(d, 0).startIso;
    const wk = state.weekSubmissions.find(w => w.weekStart === weekId && w.userId === userId);
    const status = wk ? wk.status : 'draft';
    const weekLabel = TC.fmtRange(weekId, TC.weekDays(weekId)[6]);
    const wkApprovedBy = wk && (wk.status === 'approved' || wk.status === 'rejected' || wk.status === 'changes_requested')
      ? dirName : '';
    const wkApprovedAt = wk && wk.decidedAt ? new Date(wk.decidedAt).toLocaleString() : '';
    const wkNote = wk ? (wk.directorComment || '') : '';

    const pp = payPeriodForDate(dateIso, state.settings);
    const ppRec = payPeriodRecord(state, pp.periodStart, userId);
    const ppLabel = TC.fmtRange(pp.periodStart, pp.periodEnd);
    const ppSigned = ppRec && ppRec.status === 'approved' ? 'Yes' : 'No';
    const ppSignedBy = ppRec && ppRec.status === 'approved'
      ? (ppRec.signedName || dirName) : '';
    const ppSignedAt = ppRec && ppRec.status === 'approved' && (ppRec.signedAt || ppRec.decidedAt)
      ? new Date(ppRec.signedAt || ppRec.decidedAt).toLocaleString() : '';

    const ptoHrs = leaves.filter(l => l.type === 'pto').reduce((a, l) => a + l.hours, 0);
    const sickHrs = leaves.filter(l => l.type === 'sick').reduce((a, l) => a + l.hours, 0);
    const holidayHrs = leaves.filter(l => l.type === 'holiday').reduce((a, l) => a + l.hours, 0);
    const holidayNames = leaves.filter(l => l.type === 'holiday').map(l => l.name).filter(Boolean).join('; ');

    if (entries.length === 0 && leaves.length === 0) continue;

    if (entries.length === 0) {
      const total = ptoHrs + sickHrs + holidayHrs;
      ptoTotal += ptoHrs; sickTotal += sickHrs; holidayTotal += holidayHrs;
      rows.push([
        dateIso, dayLabel, '', '', '',
        '0.00', ptoHrs.toFixed(2), sickHrs.toFixed(2), holidayHrs.toFixed(2), holidayNames, total.toFixed(2),
        '',
        weekLabel, status, wkApprovedBy, wkApprovedAt, wkNote,
        ppLabel, ppSigned, ppSignedBy, ppSignedAt,
      ]);
    } else {
      entries.forEach((e, idx) => {
        const hrs = TC.entryHours(e);
        workedTotal += hrs;
        const dailyPto = idx === 0 ? ptoHrs : 0;
        const dailySick = idx === 0 ? sickHrs : 0;
        const dailyHoliday = idx === 0 ? holidayHrs : 0;
        const dailyHolidayNames = idx === 0 ? holidayNames : '';
        if (idx === 0) { ptoTotal += ptoHrs; sickTotal += sickHrs; holidayTotal += holidayHrs; }
        const total = hrs + dailyPto + dailySick + dailyHoliday;
        rows.push([
          dateIso, dayLabel,
          e.clockIn ? new Date(e.clockIn).toLocaleTimeString() : '',
          e.clockOut ? new Date(e.clockOut).toLocaleTimeString() : '',
          e.breakMinutes || 0,
          hrs.toFixed(2),
          dailyPto.toFixed(2),
          dailySick.toFixed(2),
          dailyHoliday.toFixed(2),
          dailyHolidayNames,
          total.toFixed(2),
          e.manuallyEdited ? 'Yes' : '',
          weekLabel, status, wkApprovedBy, wkApprovedAt, wkNote,
          ppLabel, ppSigned, ppSignedBy, ppSignedAt,
        ]);
      });
    }
  }

  // ----- Totals row -----
  const grandTotal = workedTotal + ptoTotal + sickTotal + holidayTotal;
  rows.push([]);
  rows.push([
    'TOTALS', '', '', '', '',
    workedTotal.toFixed(2),
    ptoTotal.toFixed(2),
    sickTotal.toFixed(2),
    holidayTotal.toFixed(2),
    '',
    grandTotal.toFixed(2),
  ]);

  // ----- Approval summary -----
  // Look at every week in range — if all approved, surface the latest decision.
  const weekIdsInRange = new Set();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    weekIdsInRange.add(TC.weekRange(d, 0).startIso);
  }
  const weeksInRange = [...weekIdsInRange]
    .map(ws => state.weekSubmissions.find(w => w.weekStart === ws && w.userId === userId))
    .filter(Boolean);
  const allApproved = weeksInRange.length > 0 && weeksInRange.every(w => w.status === 'approved');
  const latestDecision = weeksInRange
    .filter(w => w.decidedAt)
    .sort((a, b) => (b.decidedAt || '').localeCompare(a.decidedAt || ''))[0];

  rows.push([]);
  if (allApproved && latestDecision) {
    rows.push(['Approval Status', 'All weeks in range approved by supervisor']);
    rows.push(['Approved By', dirName, dirTitle]);
    rows.push(['Most Recent Approval', new Date(latestDecision.decidedAt).toLocaleString()]);
  } else {
    rows.push(['Approval Status', 'Some weeks not yet approved — see Week Status column']);
  }

  return rows;
}

Object.assign(window, { History });
