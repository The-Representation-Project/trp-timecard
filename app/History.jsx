// app/History.jsx — Pay-period archive (PDF + branded Excel) + past weeks

const { useState: useStateH, useMemo: useMemoH } = React;

/** Every pay period that has hours or a stored record for this user. */
function listUserPayPeriods(state, userId) {
  const seen = new Map();
  const touch = (dateIso) => {
    if (!dateIso) return;
    const pp = payPeriodForDate(dateIso, state.settings);
    if (!seen.has(pp.periodStart)) seen.set(pp.periodStart, pp);
  };
  (state.payPeriods || []).filter(p => p.userId === userId).forEach(p => touch(p.periodStart));
  (state.weekSubmissions || []).filter(w => w.userId === userId).forEach(w => touch(w.weekStart));
  (state.timeEntries || []).filter(e => e.userId === userId).forEach(e => touch(e.date));
  (state.leaveEntries || []).filter(l => l.userId === userId).forEach(l => touch(l.date));

  return [...seen.values()]
    .map(pp => {
      const record = payPeriodRecord(state, pp.periodStart, userId);
      const totals = payPeriodTotals(state, pp.periodStart, userId);
      return {
        ...pp,
        record: record || null,
        status: record ? record.status : 'pending',
        totals,
        isApproved: !!(record && record.status === 'approved'),
      };
    })
    .filter(p => p.totals.total > 0 || p.record)
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart));
}

function downloadPeriodPdf(state, userId, periodStart) {
  if (typeof window.printPayPeriodReceipt !== 'function') {
    alert('PDF export is still loading. Wait a second and try again.');
    return;
  }
  const pp = payPeriodForDate(periodStart, state.settings);
  const rec = payPeriodRecord(state, periodStart, userId);
  const dir = state.users.find(u => u.role === 'director') || {};
  const payPeriod = rec || {
    userId,
    periodStart: pp.periodStart,
    periodEnd: pp.periodEnd,
    status: 'approved',
    signedName: dir.name || 'Director',
    signedTitle: dir.title || 'Director',
    decidedAt: new Date().toISOString(),
  };
  window.printPayPeriodReceipt(state, payPeriod);
}

function downloadPeriodExcel(state, userId, periodStart) {
  const pp = payPeriodForDate(periodStart, state.settings);
  const rec = payPeriodRecord(state, periodStart, userId);
  if (rec && typeof window.downloadPayPeriodExcel === 'function') {
    window.downloadPayPeriodExcel(state, { ...rec, userId, periodStart: pp.periodStart });
    return;
  }
  if (typeof window.downloadRangeExcel !== 'function') {
    alert('Excel export is still loading. Wait a second and try again.');
    return;
  }
  window.downloadRangeExcel(state, userId, pp.periodStart, pp.periodEnd);
}

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

function PayPeriodArchive({ userId }) {
  const { state } = useStore();
  const periods = useMemoH(
    () => listUserPayPeriods(state, userId),
    [state, userId]
  );

  if (periods.length === 0) {
    return (
      <div className="card" style={{marginBottom: 24}}>
        <div className="empty">
          <h3>No pay periods yet</h3>
          <div>Once you log hours, every pay period will appear here for PDF and Excel download.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{padding: 0, overflowX: 'auto', marginBottom: 28}}>
      <table className="history-table">
        <thead>
          <tr>
            <th>Pay Period</th>
            <th style={{textAlign: 'right'}}>Clocked</th>
            <th style={{textAlign: 'right'}}>PTO</th>
            <th style={{textAlign: 'right'}}>Sick</th>
            <th style={{textAlign: 'right'}}>Holiday</th>
            <th style={{textAlign: 'right'}}>Total</th>
            <th>Status</th>
            <th>Signed</th>
            <th>Downloads</th>
          </tr>
        </thead>
        <tbody>
          {periods.map(p => {
            const signedAt = p.record && (p.record.signedAt || p.record.decidedAt);
            const signedLabel = signedAt
              ? new Date(signedAt).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', year: 'numeric',
                })
              : '—';
            const signedBy = p.record && p.isApproved
              ? (p.record.signedName || 'Director')
              : '';
            return (
              <tr key={p.periodStart}>
                <td>
                  <strong style={{color: 'var(--trp-navy)'}}>
                    {p.label} · {TC.parseDate(p.periodStart).getFullYear()}
                  </strong>
                  <div className="tiny muted">{TC.fmtRange(p.periodStart, p.periodEnd)}</div>
                </td>
                <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(p.totals.work)}</td>
                <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(p.totals.pto)}</td>
                <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(p.totals.sick)}</td>
                <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(p.totals.holiday || 0)}</td>
                <td className="tnum total" style={{textAlign: 'right', fontWeight: 700, color: 'var(--trp-navy)'}}>
                  {TC.fmtHours(p.totals.total)}
                </td>
                <td>
                  {p.isApproved ? (
                    <span className="badge approved"><span className="dot" />Signed Off</span>
                  ) : p.status === 'awaiting_approval' ? (
                    <span className="badge submitted"><span className="dot" />Awaiting</span>
                  ) : (
                    <span className="badge draft"><span className="dot" />Open</span>
                  )}
                </td>
                <td>
                  {p.isApproved ? (
                    <>
                      <div style={{fontWeight: 600, color: 'var(--trp-navy)', fontSize: 13}}>{signedBy}</div>
                      <div className="tiny muted">{signedLabel}</div>
                    </>
                  ) : (
                    <span className="tiny muted">—</span>
                  )}
                </td>
                <td>
                  <div style={{display: 'flex', gap: 6, flexWrap: 'wrap'}}>
                    <button
                      type="button"
                      className="btn small"
                      disabled={!p.isApproved}
                      title={p.isApproved ? 'Open print dialog → Save as PDF' : 'Available after approval'}
                      onClick={() => downloadPeriodPdf(state, userId, p.periodStart)}
                    >
                      ↓ PDF
                    </button>
                    <button
                      type="button"
                      className="btn ghost small"
                      onClick={() => downloadPeriodExcel(state, userId, p.periodStart)}
                    >
                      ↓ Excel
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
          <h1>Pay Periods & Past Weeks</h1>
        </div>
        <div className="actions">
          <ImportHistoricalPanel />
          <button className="btn" onClick={() => setExportOpen(true)}>↓ Export</button>
        </div>
      </div>

      <div style={{marginBottom: 10}}>
        <div className="eyebrow" style={{marginBottom: 6}}>Pay period archive</div>
        <p className="tiny muted" style={{margin: '0 0 12px', maxWidth: 560}}>
          Download the signed PDF or TRP-branded Excel for any pay period. PDF is available once the period is signed off.
        </p>
      </div>
      <PayPeriodArchive userId={targetUser.id} />

      <div className="eyebrow" style={{marginBottom: 10}}>Week detail</div>
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

  const periods = useMemoH(
    () => listUserPayPeriods(state, userId),
    [state, userId]
  );

  const [selectedPeriod, setSelectedPeriod] = useStateH(
    () => (periods[0] && periods[0].periodStart) || payPeriodForDate(TC.isoDate(today), state.settings).periodStart
  );

  const selectedMeta = periods.find(p => p.periodStart === selectedPeriod);
  const canPdf = mode === 'period' && selectedMeta && selectedMeta.isApproved;

  function exportExcel() {
    let start, end;
    if (mode === 'period') {
      downloadPeriodExcel(state, userId, selectedPeriod);
      onClose();
      return;
    }
    if (mode === 'week') {
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

  function exportPdf() {
    if (!canPdf) return;
    downloadPeriodPdf(state, userId, selectedPeriod);
    onClose();
  }

  return (
    <Modal title="Export" subtitle="TRP-branded Excel — same design as pay-period receipts. PDF for signed-off periods." onClose={onClose}>
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
            {(periods.length ? periods : [{
              periodStart: selectedPeriod,
              periodEnd: payPeriodForDate(selectedPeriod, state.settings).periodEnd,
              label: payPeriodForDate(selectedPeriod, state.settings).label,
            }]).map(p => (
              <option key={p.periodStart} value={p.periodStart}>
                {p.label} · {TC.fmtRange(p.periodStart, p.periodEnd)}
                {p.isApproved ? ' · signed off' : ''}
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
        {mode === 'period' && (
          <button className="btn ghost" disabled={!canPdf} onClick={exportPdf} title={canPdf ? '' : 'Available after approval'}>
            ↓ Download PDF
          </button>
        )}
        <button className="btn" onClick={exportExcel}>↓ Download Excel</button>
      </div>
    </Modal>
  );
}

Object.assign(window, { History });
