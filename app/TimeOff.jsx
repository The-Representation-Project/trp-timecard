// app/TimeOff.jsx — PTO and Sick time entry, balances, history.
// Single-user app: leave is logged + deducted from balance immediately
// (no separate approval — Katrina signs off the whole pay period).

const { useState: useStateTO } = React;

function TimeOff() {
  const { state, actions } = useStore();
  const user = currentUser(state);

  const [showRequest, setShowRequest] = useStateTO(false);
  const [showBalanceEdit, setShowBalanceEdit] = useStateTO(false);

  const leaves = state.leaveEntries
    .filter(l => l.userId === user.id)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Time Off</div>
          <h1>PTO & Sick Time</h1>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={() => setShowBalanceEdit(true)}>⚙ Balances & Accrual</button>
          <button className="btn" onClick={() => setShowRequest(true)}>+ Log Time Off</button>
        </div>
      </div>

      <div className="grid grid-3 mb-5">
        <div className="stat orange">
          <div className="eyebrow">PTO Balance</div>
          <div className="value">{TC.fmtHours(user.ptoBalance)}<span style={{fontSize: 16, opacity: 0.5}}>hrs</span></div>
          <div className="sub">≈ {(user.ptoBalance / 8).toFixed(1)} business days</div>
        </div>
        <div className="stat cream">
          <div className="eyebrow">Sick Balance</div>
          <div className="value">{TC.fmtHours(user.sickBalance)}<span style={{fontSize: 16, opacity: 0.5}}>hrs</span></div>
          <div className="sub">≈ {(user.sickBalance / 8).toFixed(1)} business days</div>
        </div>
        <div className="stat">
          <div className="eyebrow">Accrual</div>
          <div className="value" style={{fontSize: 22, marginTop: 6, marginBottom: 8}}>
            {state.settings.accrualEnabled ? 'On' : 'Off'}
          </div>
          <div className="sub">
            {state.settings.accrualEnabled
              ? `+${(state.settings.ptoAccrualPerHour || 0).toFixed(4)} PTO/hr · +${(state.settings.sickAccrualPerHour || 0).toFixed(4)} sick/hr`
              : 'Balances stay fixed unless you adjust manually.'}
          </div>
        </div>
      </div>

      <div className="comment-block" style={{margin: '0 0 18px', borderLeftColor: 'var(--trp-pacific-blue)', background: 'var(--trp-pacific-50)'}}>
        <span className="from" style={{color: 'var(--trp-pacific-700)'}}>How leave works here</span>
        Logging PTO or sick time deducts from your balance and counts toward
        the day's hours on your timesheet immediately. Katrina sees the totals
        when she signs off the pay period — no separate approval step. When a
        pay period is approved, accrual is added back based on hours worked.
      </div>

      <div className="card">
        <h3 className="card-title">Your time off log</h3>
        {leaves.length === 0 ? (
          <div className="empty">
            <h3>No leave logged yet</h3>
            <div>Log your first PTO or sick day above.</div>
          </div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th style={{textAlign: 'right'}}>Hours</th>
                <th>Logged</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leaves.map(l => {
                const dateLocked = isWeekLocked(state, TC.weekRange(TC.parseDate(l.date), 0).startIso, l.userId);
                return (
                  <tr key={l.id}>
                    <td><strong style={{color: 'var(--trp-navy)'}}>{TC.fmtDayShort(l.date)}</strong></td>
                    <td>
                      <span style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontWeight: 700, fontSize: 11, color: l.type === 'pto' ? 'var(--trp-orange-700)' : 'var(--trp-pacific-700)'}}>
                        {l.type === 'pto' ? 'PTO' : 'Sick'}
                      </span>
                    </td>
                    <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(l.hours)}</td>
                    <td className="tiny muted">{l.requestedAt ? new Date(l.requestedAt).toLocaleDateString() : '—'}</td>
                    <td style={{textAlign: 'right'}}>
                      {!dateLocked && (
                        <button
                          className="btn ghost small"
                          onClick={() => {
                            if (confirm(`Remove ${l.type === 'pto' ? 'PTO' : 'sick'} on ${TC.fmtDayShort(l.date)}? Hours will refund to your balance.`)) {
                              actions.deleteLeave(l.id);
                            }
                          }}
                          style={{color: 'var(--trp-coral-700)'}}
                        >
                          Remove
                        </button>
                      )}
                      {dateLocked && <span className="tiny muted">Week locked</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showRequest && <LeaveRequestModal user={user} onClose={() => setShowRequest(false)} />}
      {showBalanceEdit && <BalanceEditModal user={user} onClose={() => setShowBalanceEdit(false)} />}
    </div>
  );
}

function LeaveRequestModal({ user, onClose }) {
  const { actions } = useStore();
  const [type, setType] = useStateTO('pto');
  const today = TC.isoDate(new Date());
  const [startDate, setStartDate] = useStateTO(today);
  const [endDate, setEndDate] = useStateTO(today);
  const [hoursPerDay, setHoursPerDay] = useStateTO(8);
  const [override, setOverride] = useStateTO(false);

  const days = React.useMemo(() => {
    if (!startDate || !endDate) return [];
    const s = TC.parseDate(startDate);
    const e = TC.parseDate(endDate);
    if (e < s) return [];
    const out = [];
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day === 0 || day === 6) continue;
      out.push(TC.isoDate(d));
    }
    return out;
  }, [startDate, endDate]);

  const totalHours = days.length * Number(hoursPerDay || 0);
  const balance = type === 'pto' ? user.ptoBalance : user.sickBalance;
  const exceedsBalance = totalHours > balance;

  function submit() {
    days.forEach(d => {
      actions.addLeave(user.id, { date: d, type, hours: Number(hoursPerDay) || 0, override: override || !exceedsBalance });
    });
    onClose();
  }

  return (
    <Modal title="Log Time Off" subtitle="PTO and Sick hours count toward your weekly total alongside clocked time." onClose={onClose}>
      <label className="field">
        <span className="lbl">Type</span>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8}}>
          <TypeButton active={type === 'pto'} onClick={() => setType('pto')} color="orange">
            PTO
            <div className="tiny" style={{fontWeight: 400, marginTop: 2, opacity: 0.8}}>Vacation / personal</div>
          </TypeButton>
          <TypeButton active={type === 'sick'} onClick={() => setType('sick')} color="pacific">
            Sick
            <div className="tiny" style={{fontWeight: 400, marginTop: 2, opacity: 0.8}}>Illness / care</div>
          </TypeButton>
        </div>
      </label>
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
      <label className="field">
        <span className="lbl">Hours Per Day</span>
        <input type="number" min="0" max="24" step="0.5" value={hoursPerDay} onChange={e => setHoursPerDay(e.target.value)} />
      </label>

      <div style={{
        background: 'var(--trp-cream-100)', padding: '14px 16px',
        borderRadius: 'var(--radius-sm)', marginTop: 4
      }}>
        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 4}}>
          <span style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontSize: 11, fontWeight: 700, color: 'var(--trp-navy)'}}>Total to deduct</span>
          <span className="tnum" style={{fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--trp-navy)'}}>{TC.fmtHours(totalHours)} hrs</span>
        </div>
        <div className="tiny muted">
          {days.length} weekday{days.length === 1 ? '' : 's'} · weekends excluded automatically · current {type === 'pto' ? 'PTO' : 'Sick'} balance: {TC.fmtHours(balance)} hrs
        </div>
      </div>

      {exceedsBalance && (
        <div className="comment-block warn" style={{marginTop: 12}}>
          <span className="from">Exceeds Available Balance</span>
          You're logging {TC.fmtHours(totalHours)} hrs but only have {TC.fmtHours(balance)} available.
          <label className="checkbox-row" style={{marginTop: 8, color: 'var(--trp-coral-700)'}}>
            <input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} />
            Log anyway — I understand this will push my balance to zero.
          </label>
        </div>
      )}

      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={submit} disabled={days.length === 0 || (exceedsBalance && !override)}>
          Log Time Off
        </button>
      </div>
    </Modal>
  );
}

function TypeButton({ active, onClick, color, children }) {
  const colorMap = {
    orange: { bg: 'var(--trp-orange-100)', border: 'var(--trp-orange)', text: 'var(--trp-orange-700)' },
    pacific: { bg: 'var(--trp-pacific-100)', border: 'var(--trp-pacific-blue)', text: 'var(--trp-pacific-900)' },
  };
  const c = colorMap[color] || colorMap.pacific;
  return (
    <button type="button" onClick={onClick}
      style={{
        padding: '14px 16px', textAlign: 'left',
        background: active ? c.bg : 'white',
        border: `2px solid ${active ? c.border : 'var(--border-soft)'}`,
        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        fontFamily: 'var(--font-display)', textTransform: 'uppercase',
        letterSpacing: 'var(--tracking-caps)', fontSize: 13, fontWeight: 700,
        color: active ? c.text : 'var(--trp-stone-700)',
        transition: 'all 120ms ease',
      }}>
      {children}
    </button>
  );
}

function BalanceEditModal({ user, onClose }) {
  const { state, actions } = useStore();
  const [pto, setPto] = useStateTO(user.ptoBalance);
  const [sick, setSick] = useStateTO(user.sickBalance);
  const [accrualEnabled, setAccrualEnabled] = useStateTO(state.settings.accrualEnabled);
  const [ptoRate, setPtoRate] = useStateTO(state.settings.ptoAccrualPerHour || 0);
  const [sickRate, setSickRate] = useStateTO(state.settings.sickAccrualPerHour || 0);

  function save() {
    actions.setBalances(user.id, { ptoBalance: Number(pto), sickBalance: Number(sick) });
    actions.setSettings({
      accrualEnabled,
      ptoAccrualPerHour: Number(ptoRate) || 0,
      sickAccrualPerHour: Number(sickRate) || 0,
    });
    onClose();
  }

  // Quick yearly estimate at standard 2080 hr full-time.
  const ptoYr = (Number(ptoRate) || 0) * 2080;
  const sickYr = (Number(sickRate) || 0) * 2080;

  return (
    <Modal title="Balances & Accrual" subtitle="Override your current balance or change the per-hour accrual rate." onClose={onClose}>
      <div className="field-row">
        <label className="field">
          <span className="lbl">PTO Balance (hrs)</span>
          <input type="number" min="0" step="0.01" value={pto} onChange={e => setPto(e.target.value)} />
        </label>
        <label className="field">
          <span className="lbl">Sick Balance (hrs)</span>
          <input type="number" min="0" step="0.01" value={sick} onChange={e => setSick(e.target.value)} />
        </label>
      </div>
      <label className="checkbox-row" style={{marginBottom: 12}}>
        <input type="checkbox" checked={accrualEnabled} onChange={e => setAccrualEnabled(e.target.checked)} />
        Accrue PTO and sick when a pay period is approved
      </label>
      {accrualEnabled && (
        <>
          <div className="field-row">
            <label className="field">
              <span className="lbl">PTO accrued per hour worked</span>
              <input type="number" min="0" step="0.0001" value={ptoRate} onChange={e => setPtoRate(e.target.value)} />
            </label>
            <label className="field">
              <span className="lbl">Sick accrued per hour worked</span>
              <input type="number" min="0" step="0.0001" value={sickRate} onChange={e => setSickRate(e.target.value)} />
            </label>
          </div>
          <div style={{
            background: 'var(--trp-cream-50)', padding: '10px 14px',
            borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--fg-2)',
            border: '1px dashed var(--border-soft)', marginBottom: 4,
          }}>
            <strong style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontSize: 10, color: 'var(--trp-stone-700)'}}>
              Yearly estimate (2,080 hr full-time)
            </strong>
            <div className="tnum" style={{marginTop: 4, color: 'var(--trp-navy)'}}>
              PTO ≈ {ptoYr.toFixed(1)} hrs/yr ({(ptoYr / 8).toFixed(1)} days) ·
              Sick ≈ {sickYr.toFixed(1)} hrs/yr ({(sickYr / 8).toFixed(1)} days)
            </div>
          </div>
        </>
      )}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={save}>Save</button>
      </div>
    </Modal>
  );
}

Object.assign(window, { TimeOff });
