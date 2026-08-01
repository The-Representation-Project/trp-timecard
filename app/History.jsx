// app/History.jsx — Past weeks with status filters + branded Excel export

const { useState: useStateH, useMemo: useMemoH } = React;

function ImportHistoricalPanel() {
  const [open, setOpen] = useStateH(false);
  const [done, setDone] = useStateH(() => window.HistoricalImport && window.HistoricalImport.alreadyImported());

  if (!window.HistoricalImport) return null;

  const preview = window.HistoricalImport.summarize(window.HistoricalImport.buildErikaMayJuneEntries());

  function run() {
    if (!confirm(
      'Replace all hours from May 4 – June 15 with the correct schedule?\n\n' +
      'This removes duplicate sessions on those days (from import + clock-in tests) ' +
      'and re-applies one session per work day.\n\n' +
      '• M–F 8:00–4:30 from May 4\n' +
      '• Jun 2–5: 12.5 hr OT shifts (8:00 AM–9:00 PM)\n' +
      '• Sat Jun 13: 7:30 AM–8:00 PM (12 hrs)\n' +
      '• Jun 1–15 pay period total: 118 hrs\n' +
      '• PTO 10.93 · Sick 9.44\n' +
      '• May pay periods marked approved (offline)\n\n' +
      'Hours after June 15 are not touched.'
    )) return;

    const summary = window.HistoricalImport.runImport();
    if (summary) {
      setDone(true);
      setOpen(false);
      alert(
        'Import complete!\n\n' +
        summary.days + ' work days · ' + summary.total.toFixed(2) + ' total hrs\n' +
        'Jun 1–15 pay period: ' + summary.juneTotal.toFixed(2) + ' hrs\n\n' +
        'May pay periods marked approved (offline). Check Timesheet → week of Jun 2 to verify OT.'
      );
    }
  }

  return (
    <>
      <button className="btn ghost" onClick={() => setOpen(true)}>
        {done ? '↻ Fix / re-import hours' : '+ Import May–June hours'}
      </button>
      {open && (
        <Modal title="Import previous hours" subtitle="May 4 – June 15, 2026" onClose={() => setOpen(false)} maxWidth={560}>
          <div className="cert-box" style={{borderLeftColor: 'var(--trp-pacific-blue)', background: 'var(--trp-pacific-50)'}}>
            <strong style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontSize: 10, display: 'block', marginBottom: 6}}>
              What gets added
            </strong>
            <ul className="tiny" style={{margin: 0, paddingLeft: 18, lineHeight: 1.6}}>
              <li><strong>May 4–31:</strong> Mon–Fri, 8:00 AM–4:30 PM, 30 min lunch ({preview.total - preview.juneTotal > 0 ? (preview.total - preview.juneTotal).toFixed(0) : '160'} hrs)</li>
              <li><strong>Jun 1, 8–12, 15:</strong> same standard 8 hr day</li>
              <li><strong>Jun 2–5:</strong> 12.5 hr OT shifts (8:00 AM–9:00 PM, 30 min lunch)</li>
              <li><strong>Sat Jun 13:</strong> 7:30 AM–8:00 PM, 30 min lunch (12 hrs)</li>
              <li><strong>PTO balance → 10.93 hrs</strong> · <strong>Sick → 9.44 hrs</strong></li>
              <li><strong>May pay periods</strong> marked approved (offline backfill)</li>
            </ul>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            margin: '14px 0', padding: '12px 14px',
            background: 'var(--trp-cream-100)', borderRadius: 'var(--radius-sm)',
          }}>
            <div>
              <div className="eyebrow">All imported days</div>
              <div style={{fontWeight: 700, fontSize: 22, color: 'var(--trp-navy)'}}>{preview.total.toFixed(2)} hrs</div>
              <div className="tiny muted">{preview.days} sessions</div>
            </div>
            <div>
              <div className="eyebrow">Jun 1–15 pay period</div>
              <div style={{fontWeight: 700, fontSize: 22, color: 'var(--trp-navy)'}}>{preview.juneTotal.toFixed(2)} hrs</div>
              <div className="tiny muted">Jun 1–15 target: 118.00 hrs</div>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn" onClick={run}>Fix / import now</button>
          </div>
        </Modal>
      )}
    </>
  );
}

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
          <ImportHistoricalPanel />
          <button className="btn" onClick={() => setExportOpen(true)}>↓ Export Excel</button>
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
                <th style={{textAlign: 'right'}}>Clocked</th>
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
  const [mode, setMode] = useStateH('period'); // 'period' | 'week' | 'range'
  const today = new Date(2026, 4, 18);
  const monthAgo = new Date(today); monthAgo.setDate(monthAgo.getDate() - 28);
  const [startDate, setStartDate] = useStateH(TC.isoDate(monthAgo));
  const [endDate, setEndDate] = useStateH(TC.isoDate(today));
  const [selectedWeek, setSelectedWeek] = useStateH(TC.weekRange(today, 0).startIso);

  const weeks = state.weekSubmissions.filter(w => w.userId === userId)
    .map(w => w.weekStart).sort().reverse();

  const periods = useMemoH(() => {
    const seen = new Map();
    const add = (dateIso) => {
      if (!dateIso) return;
      const pp = payPeriodForDate(dateIso, state.settings);
      if (!seen.has(pp.periodStart)) seen.set(pp.periodStart, pp);
    };
    (state.payPeriods || []).filter(p => p.userId === userId).forEach(p => add(p.periodStart));
    (state.weekSubmissions || []).filter(w => w.userId === userId).forEach(w => add(w.weekStart));
    (state.timeEntries || []).filter(e => e.userId === userId).forEach(e => add(e.date));
    add(TC.isoDate(today));
    return [...seen.values()].sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  }, [state, userId]);

  const [selectedPeriod, setSelectedPeriod] = useStateH(
    () => (periods[0] && periods[0].periodStart) || payPeriodForDate(TC.isoDate(today), state.settings).periodStart
  );

  function exportNow() {
    let start, end;
    if (mode === 'period') {
      const pp = payPeriodForDate(selectedPeriod, state.settings);
      start = pp.periodStart;
      end = pp.periodEnd;
      const rec = payPeriodRecord(state, pp.periodStart, userId);
      if (rec && typeof window.downloadPayPeriodExcel === 'function') {
        window.downloadPayPeriodExcel(state, { ...rec, userId, periodStart: pp.periodStart });
        onClose();
        return;
      }
    } else if (mode === 'week') {
      start = selectedWeek;
      end = TC.weekDays(selectedWeek)[6];
    } else {
      start = startDate;
      end = endDate;
    }
    if (typeof window.downloadRangeExcel !== 'function') {
      alert('Excel export is still loading. Wait a second and try again.');
      return;
    }
    window.downloadRangeExcel(state, userId, start, end);
    onClose();
  }

  return (
    <Modal title="Export Excel" subtitle="TRP-branded spreadsheet — same look as pay-period downloads." onClose={onClose}>
      <label className="field">
        <span className="lbl">Scope</span>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8}}>
          <TypeButton active={mode === 'period'} onClick={() => setMode('period')} color="pacific">Pay Period</TypeButton>
          <TypeButton active={mode === 'week'} onClick={() => setMode('week')} color="pacific">Single Week</TypeButton>
          <TypeButton active={mode === 'range'} onClick={() => setMode('range')} color="orange">Date Range</TypeButton>
        </div>
      </label>
      {mode === 'period' ? (
        <label className="field">
          <span className="lbl">Pay Period</span>
          <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
            {periods.map(p => (
              <option key={p.periodStart} value={p.periodStart}>
                {p.label} · {TC.fmtRange(p.periodStart, p.periodEnd)}
              </option>
            ))}
          </select>
        </label>
      ) : mode === 'week' ? (
        <label className="field">
          <span className="lbl">Week</span>
          <select value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
            {(weeks.length ? weeks : [selectedWeek]).map(w => (
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
        <button className="btn" onClick={exportNow}>↓ Download Excel</button>
      </div>
    </Modal>
  );
}

Object.assign(window, { History });
