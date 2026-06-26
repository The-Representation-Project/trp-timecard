// app/Home.jsx — Single-user employee home.
//   - Clock in/out + today/week stats
//   - PTO/sick balances + this-week status
//   - Most recently approved pay period (signed receipt)
//   - Ready-to-send OR awaiting-approval pay period card

function useLiveClock() {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function ClockCard({ user, onManualAdd }) {
  const { state, actions } = useStore();
  const now = useLiveClock();
  const active = state.activeClock && state.activeClock.userId === user.id;
  const activeEntry = active ? state.timeEntries.find(e => e.id === state.activeClock.entryId) : null;
  const onLunch = state.activeLunch && state.activeLunch.userId === user.id;
  const [mode, setMode] = React.useState('day');

  React.useEffect(() => { if (onLunch) setMode('lunch'); }, [onLunch]);

  const today = new Date(now);
  const dateLabel = today.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const clockLabel = today.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  const todayIso = TC.isoDate(today);
  const locked = isDayLocked(state, todayIso, user.id);

  let elapsed = 0;
  if (active && activeEntry) elapsed = now - new Date(activeEntry.clockIn).getTime();
  const lunchElapsed = onLunch ? now - new Date(state.activeLunch.lunchStartIso).getTime() : 0;

  let btnLabel, btnAction, btnClass = '', btnDisabled = false;
  if (mode === 'lunch') {
    if (onLunch) { btnLabel = 'End Lunch'; btnAction = () => actions.endLunch(user.id); btnClass = 'out'; }
    else if (active) { btnLabel = 'Start Lunch'; btnAction = () => actions.startLunch(user.id); }
    else { btnLabel = 'Start Lunch'; btnAction = null; btnDisabled = true; }
  } else {
    if (active) { btnLabel = 'Clock Out'; btnAction = () => actions.clockOut(user.id); btnClass = 'out'; }
    else { btnLabel = 'Clock In'; btnAction = () => actions.clockIn(user.id); }
  }
  if (locked) btnDisabled = true;

  function handleClick() { if (!btnDisabled && btnAction) btnAction(); }

  let statusLabel;
  if (onLunch) statusLabel = 'You are on lunch';
  else if (active) statusLabel = 'You are clocked in';
  else if (locked) statusLabel = 'This pay period was signed by Katrina — locked';
  else statusLabel = 'Ready to clock in';

  let timerMs, timerSubLabel;
  if (onLunch) { timerMs = lunchElapsed; timerSubLabel = 'Lunch break'; }
  else if (active) {
    timerMs = elapsed;
    timerSubLabel = `On the clock · ${activeEntry && activeEntry.breakMinutes ? `${activeEntry.breakMinutes} min break so far` : 'no break yet'}`;
  } else { timerMs = 0; timerSubLabel = null; }

  return (
    <div className="clock-card">
      <div className="meta">{dateLabel} · {clockLabel}</div>
      <div className="label">{statusLabel}</div>

      <div style={{
        display: 'inline-flex', background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.14)', borderRadius: 'var(--radius-sm)',
        padding: 3, marginBottom: 18, gap: 2,
      }}>
        {[{ v: 'day', label: 'Day Shift' }, { v: 'lunch', label: 'Lunch Break' }].map(o => {
          const isActive = mode === o.v;
          const showLunchBadge = o.v === 'lunch' && onLunch;
          return (
            <button key={o.v} type="button" onClick={() => setMode(o.v)}
              style={{
                padding: '8px 14px', fontFamily: 'var(--font-display)',
                textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)',
                fontSize: 11, fontWeight: 700,
                color: isActive ? 'var(--trp-navy)' : 'rgba(255,255,255,0.7)',
                background: isActive ? 'white' : 'transparent',
                border: 'none', borderRadius: 'calc(var(--radius-sm) - 1px)',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, lineHeight: 1,
              }}>
              {o.label}
              {showLunchBadge && <span style={{
                width: 6, height: 6, borderRadius: '50%', background: 'var(--trp-coral)',
                animation: 'pulse 1.8s ease-in-out infinite', display: 'inline-block',
              }} />}
            </button>
          );
        })}
      </div>

      <div className={`timer ${active || onLunch ? '' : 'idle'}`} style={onLunch ? { color: 'var(--trp-orange)' } : undefined}>
        {TC.fmtDuration(timerMs)}
      </div>
      {timerSubLabel && (
        <div style={{
          color: onLunch ? 'var(--trp-orange-100)' : 'var(--trp-pacific-300)',
          fontSize: 12, fontFamily: 'var(--font-display)', textTransform: 'uppercase',
          letterSpacing: 'var(--tracking-caps)', fontWeight: 700,
          marginBottom: 16, marginTop: -16,
        }}>{timerSubLabel}</div>
      )}

      <div className="row">
        <button
          className={`clock-btn ${btnClass}`} onClick={handleClick} disabled={btnDisabled}
          style={mode === 'lunch' && !onLunch ? { background: 'var(--trp-orange)', color: 'var(--trp-navy)' } : undefined}
        >
          {btnLabel}
        </button>
        {active && activeEntry && (
          <div style={{color: 'var(--trp-pacific-300)', fontSize: 13}}>
            <div style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontWeight: 700, fontSize: 11, marginBottom: 4}}>Started</div>
            <div className="tnum" style={{fontSize: 16, color: 'white'}}>{TC.fmtTime(activeEntry.clockIn)}</div>
          </div>
        )}
          {!active && !onLunch && (
          <Badge live={false} status={'submitted'}>{locked ? 'Period locked' : 'Idle'}</Badge>
        )}
        {active && !onLunch && <Badge live />}
        {onLunch && (
          <span className="badge" style={{background: 'var(--trp-orange)', color: 'var(--trp-navy)'}}>
            <span className="dot" />On Lunch
          </span>
        )}
        <button
          className="btn ghost" onClick={onManualAdd} disabled={locked}
          style={{
            color: 'var(--trp-pacific-300)', marginLeft: 'auto',
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.04)',
          }}
          title="Add a session manually if you forgot to clock in or out"
        >
          ✎ Forgot to Clock In/Out?
        </button>
      </div>
    </div>
  );
}

function Home() {
  const { state } = useStore();
  const user = currentUser(state);
  const now = useLiveClock();
  const [manualEditing, setManualEditing] = React.useState(null);
  const [sendingPeriod, setSendingPeriod] = React.useState(null); // periodStartIso

  const today = new Date(now);
  const todayIso = TC.isoDate(today);
  const weekStart = TC.weekRange(today, 0).startIso;
  const week = weekTotals(state, weekStart, user.id, now);
  const todayEntries = state.timeEntries.filter(e => e.userId === user.id && e.date === todayIso);
  const todayHours = todayEntries.reduce((a, e) => a + TC.entryHours(e, now), 0);
  const todayLeave = state.leaveEntries.filter(l => l.userId === user.id && l.date === todayIso);
  const todayLeaveHours = todayLeave.reduce((a, l) => a + l.hours, 0);
  const submission = weekSubmission(state, weekStart, user.id);

  // Most recently approved pay period
  const recentApprovedPP = [...state.payPeriods]
    .filter(p => p.userId === user.id && p.status === 'approved' && p.signedViaReceipt && p.decidedAt)
    .sort((a, b) => (b.decidedAt || '').localeCompare(a.decidedAt || ''))[0];

  // Pay periods waiting on Erika to send to Katrina, or sitting with Katrina.
  // We surface BOTH any payPeriod record marked awaiting_approval AND any
  // period with logged data whose end date has passed (or where the user
  // is approaching the submission deadline).
  const awaitingPP = state.payPeriods.find(
    p => p.userId === user.id && p.status === 'awaiting_approval'
  );

  let readyPeriod = null;
  {
    // Walk every period that has any logged data, oldest first. Skip the
    // one currently sitting with the approver (it's already shown via
    // awaitingPP). The first qualifying period becomes the call-to-action.
    const candidatePeriodStarts = new Set();
    state.timeEntries.filter(e => e.userId === user.id).forEach(e => {
      candidatePeriodStarts.add(payPeriodForDate(e.date, state.settings).periodStart);
    });
    state.leaveEntries.filter(l => l.userId === user.id).forEach(l => {
      candidatePeriodStarts.add(payPeriodForDate(l.date, state.settings).periodStart);
    });
    // Always include the current pay period as a candidate, even if no
    // hours are logged yet — so the user can preview "next up" while an
    // older one sits awaiting.
    candidatePeriodStarts.add(payPeriodForDate(todayIso, state.settings).periodStart);
    for (const ps of [...candidatePeriodStarts].sort()) {
      if (awaitingPP && ps === awaitingPP.periodStart) continue;
      const rec = payPeriodRecord(state, ps, user.id);
      if (rec && rec.status === 'approved' && rec.signedViaReceipt) continue;
      const pp = payPeriodForDate(ps, state.settings);
      const totals = payPeriodTotals(state, ps, user.id);
      const isCurrent = ps === payPeriodForDate(todayIso, state.settings).periodStart;
      if (totals.total === 0 && !isCurrent) continue;
      const periodEnded = todayIso > pp.periodEnd;
      const deadlineIso = payPeriodSubmitDeadline(ps, state.settings);
      const daysToDeadline = Math.ceil((TC.parseDate(deadlineIso) - TC.parseDate(todayIso)) / 86400000);
      const nearDeadline = daysToDeadline <= 3;
      // Surface the card if:
      //   - the period is over (ready to send)
      //   - we're within 3 days of the deadline (nudge)
      //   - it's the current period AND has any logged hours (so the
      //     "Submit for approval" card appears the moment work starts
      //     in a fresh period — right after the previous one is approved)
      if (periodEnded || nearDeadline || (isCurrent && totals.total > 0)) {
        readyPeriod = rec || {
          id: 'virtual-' + ps,
          userId: user.id,
          periodStart: pp.periodStart,
          periodEnd: pp.periodEnd,
          status: 'pending',
        };
        break;
      }
    }
  }

  // Stale active clock = we're still "clocked in" against an entry that
  // started on a previous day (forgot to clock out). Surface a banner
  // that lets the user fix it without having to dig into the timesheet.
  const staleActiveEntry = (() => {
    if (!state.activeClock || state.activeClock.userId !== user.id) return null;
    const e = state.timeEntries.find(x => x.id === state.activeClock.entryId);
    if (!e) return null;
    if (e.date >= todayIso) return null;
    return e;
  })();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Welcome back</div>
          <h1>{user.name.split(/\s+|-/)[0]}, here's your day</h1>
        </div>
        <div className="muted tiny">{today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      </div>

      {staleActiveEntry && (
        <StaleClockBanner entry={staleActiveEntry} onEdit={() => setManualEditing(staleActiveEntry.id)} />
      )}

      {awaitingPP && (
        <div style={{marginBottom: 24}}>
          <UnlockPeriodBanner payPeriod={awaitingPP} />
        </div>
      )}

      {recentApprovedPP && (
        <div style={{marginBottom: 24}}>
          <PayPeriodApprovedCard payPeriod={recentApprovedPP} state={state} />
        </div>
      )}

      {awaitingPP && (
        <div style={{marginBottom: 24}}>
          <PayPeriodSendCard
            payPeriod={awaitingPP}
            state={state}
            onSend={() => setSendingPeriod(awaitingPP.periodStart)}
          />
        </div>
      )}
      {readyPeriod && (
        <div style={{marginBottom: 24}}>
          {awaitingPP && (
            <div style={{
              fontFamily: 'var(--font-display)', textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps)', fontWeight: 700, fontSize: 11,
              color: 'var(--trp-stone-700)', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{height: 1, background: 'var(--border-soft)', flex: 1}} />
              Next pay period
              <span style={{height: 1, background: 'var(--border-soft)', flex: 1}} />
            </div>
          )}
          <PayPeriodSendCard
            payPeriod={readyPeriod}
            state={state}
            onSend={() => setSendingPeriod(readyPeriod.periodStart)}
          />
        </div>
      )}

      <div className="grid grid-2 mb-5">
        <ClockCard user={user} onManualAdd={() => setManualEditing({ new: todayIso })} />
        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          <div className="stat orange">
            <div className="eyebrow">Today</div>
            <div className="value">{TC.fmtHours(todayHours)}<span style={{fontSize: 16, marginLeft: 4, opacity: 0.5}}>hrs</span></div>
            <div className="sub">
              {todayEntries.length} session{todayEntries.length === 1 ? '' : 's'}
              {todayLeaveHours > 0 && ` · +${TC.fmtHours(todayLeaveHours)} leave`}
            </div>
          </div>
          <div className="stat">
            <div className="eyebrow">This Week</div>
            <div className="value">{TC.fmtHours(week.total)}<span style={{fontSize: 16, marginLeft: 4, opacity: 0.5}}>/ 40</span></div>
            <div className="sub">
              {TC.fmtHours(week.workTotal)} worked
              {week.ptoTotal > 0 && ` · ${TC.fmtHours(week.ptoTotal)} PTO`}
              {week.sickTotal > 0 && ` · ${TC.fmtHours(week.sickTotal)} sick`}
              {week.holidayTotal > 0 && ` · ${TC.fmtHours(week.holidayTotal)} holiday`}
            </div>
          </div>
        </div>
      </div>

      <div className="stat-grid mb-5">
        <div className="stat">
          <div className="eyebrow">PTO Balance</div>
          <div className="value">{TC.fmtHours(user.ptoBalance)}<span style={{fontSize: 16, marginLeft: 4, opacity: 0.5}}>hrs</span></div>
          <div className="sub">≈ {(user.ptoBalance / 8).toFixed(1)} days</div>
        </div>
        <div className="stat cream">
          <div className="eyebrow">Sick Balance</div>
          <div className="value">{TC.fmtHours(user.sickBalance)}<span style={{fontSize: 16, marginLeft: 4, opacity: 0.5}}>hrs</span></div>
          <div className="sub">≈ {(user.sickBalance / 8).toFixed(1)} days</div>
        </div>
        <WeekStatusMini totals={week} submission={submission} />
      </div>

      {manualEditing && (
        <EntryEditor
          entryId={null}
          newDate={manualEditing.new}
          userId={user.id}
          onClose={() => setManualEditing(null)}
        />
      )}

      <div className="card">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8}}>
          <h3 className="card-title" style={{margin: 0}}>Today's sessions</h3>
          <button className="btn ghost small" onClick={() => setManualEditing({ new: todayIso })}>+ Add session manually</button>
        </div>
        {todayEntries.length === 0 && todayLeave.length === 0 ? (
          <div className="muted tiny">No sessions clocked yet today. Hit Clock In to get started — or add one manually if you forgot.</div>
        ) : (
          <table className="ts-table">
            <thead>
              <tr><th>Type</th><th>Start</th><th>End</th><th>Break</th><th>Hours</th><th></th></tr>
            </thead>
            <tbody>
              {todayEntries.map(e => (
                <tr key={e.id}>
                  <td>Work {e.manuallyEdited && <span className="manual-flag">Edited</span>}</td>
                  <td className="tnum">{TC.fmtTime(e.clockIn)}</td>
                  <td className="tnum">{e.clockOut ? TC.fmtTime(e.clockOut) : <Badge live />}</td>
                  <td className="tnum">{e.breakMinutes} min</td>
                  <td className="tnum total">{TC.fmtHours(TC.entryHours(e, now))}</td>
                  <td style={{textAlign: 'right'}}>
                    <button className="btn ghost small" onClick={() => setManualEditing(e.id)}>Edit</button>
                  </td>
                </tr>
              ))}
              {todayLeave.map(l => {
                const label = l.type === 'pto' ? 'PTO' : l.type === 'sick' ? 'Sick' : l.type === 'lwop' ? 'LWOP' : 'Holiday';
                return (
                  <tr key={l.id}>
                    <td>{label}{l.name && <span className="tiny muted" style={{marginLeft: 8}}>{l.name}</span>} <Badge status={l.status} /></td>
                    <td>—</td><td>—</td><td>—</td>
                    <td className="tnum total">{TC.fmtHours(l.hours)}</td>
                    <td></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {sendingPeriod && (
        <SendForApprovalModal
          periodStartIso={sendingPeriod}
          onClose={() => setSendingPeriod(null)}
        />
      )}
    </div>
  );
}

function WeekStatusMini({ totals, submission }) {
  const t = totals.total;
  let cls = '', label = `${TC.fmtHours(40 - t)} to go`;
  if (t === 40) { cls = ''; label = 'On target'; }
  else if (t > 40) { cls = 'orange'; label = `${TC.fmtHours(t - 40)} over 40`; }
  const status = submission ? submission.status : 'draft';
  return (
    <div className={`stat ${cls}`}>
      <div className="eyebrow">Week status</div>
      <div className="value" style={{fontSize: 22, marginTop: 6, marginBottom: 8}}>
        <Badge status={status} />
      </div>
      <div className="sub">{label}</div>
    </div>
  );
}

Object.assign(window, { Home });

function UnlockPeriodBanner({ payPeriod }) {
  const { state, actions } = useStore();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const pp = payPeriodForDate(payPeriod.periodStart, state.settings);
  const sentLabel = payPeriod.sentToApproverAt
    ? new Date(payPeriod.sentToApproverAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null;

  return (
    <>
      <div style={{
        padding: '16px 18px',
        background: 'linear-gradient(135deg, var(--trp-pacific-50) 0%, white 100%)',
        border: '1px solid var(--trp-pacific-blue)',
        borderLeft: '6px solid var(--trp-pacific-blue)',
        borderRadius: 'var(--radius-md)',
        display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap',
      }}>
        <div style={{flex: '1 1 280px', minWidth: 0}}>
          <div style={{
            fontFamily: 'var(--font-display)', textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps)', fontSize: 11, fontWeight: 700,
            color: 'var(--trp-pacific-700)', marginBottom: 4,
          }}>
            {pp.label} marked sent to Katrina
          </div>
          <div style={{fontWeight: 700, color: 'var(--trp-navy)', fontSize: 15, lineHeight: 1.35}}>
            Your hours stay fully editable until she signs. Clear this only if you
            didn't send yet or want to re-send later.
          </div>
          {sentLabel && (
            <div className="tiny muted" style={{marginTop: 6}}>Marked sent {sentLabel}</div>
          )}
        </div>
        <button
          className="btn ghost"
          style={{flexShrink: 0}}
          onClick={() => setConfirmOpen(true)}
        >
          Clear sent status
        </button>
      </div>

      <Confirm
        open={confirmOpen}
        title="Clear sent status?"
        message={`Move ${pp.label} (${TC.fmtRange(pp.periodStart, pp.periodEnd)}) back to draft in the app. Your hours stay editable either way — this only clears the "sent to Katrina" flag.`}
        confirmLabel="Yes, clear sent status"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          actions.cancelPayPeriodSend(payPeriod.periodStart, payPeriod.userId);
          setConfirmOpen(false);
        }}
      />
    </>
  );
}

function StaleClockBanner({ entry, onEdit }) {
  const { actions } = useStore();
  const startedLabel = new Date(entry.clockIn).toLocaleString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const daysAgo = Math.max(1, Math.floor((Date.now() - new Date(entry.clockIn).getTime()) / 86400000));

  function closeOutAtEndOfDay() {
    // Default fix: stamp clockOut at clockIn + 8h (capped at 23:59 of the
    // same day) so the entry stays on the day it started.
    const inDate = new Date(entry.clockIn);
    let out = new Date(inDate.getTime() + 8 * 3600 * 1000);
    const sameDay = out.toDateString() === inDate.toDateString();
    if (!sameDay) {
      out = new Date(inDate);
      out.setHours(23, 59, 0, 0);
    }
    actions.updateEntry(entry.id, { clockOut: out.toISOString() });
  }

  function discard() {
    if (!confirm('Discard this open session entirely? The clock-in will be deleted.')) return;
    actions.deleteEntry(entry.id);
  }

  return (
    <div style={{
      marginBottom: 24,
      padding: '18px 20px',
      background: 'linear-gradient(135deg, var(--trp-coral-100) 0%, white 100%)',
      border: '1px solid var(--trp-coral)',
      borderLeft: '6px solid var(--trp-coral)',
      borderRadius: 'var(--radius-md)',
      display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap',
    }}>
      <div style={{
        flexShrink: 0, width: 44, height: 44, borderRadius: '50%',
        background: 'var(--trp-coral)', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 700,
      }}>⚠</div>
      <div style={{flex: '1 1 320px', minWidth: 0}}>
        <div style={{
          fontFamily: 'var(--font-display)', textTransform: 'uppercase',
          letterSpacing: 'var(--tracking-caps)', fontSize: 11, fontWeight: 700,
          color: 'var(--trp-coral-700)', marginBottom: 4,
        }}>
          Forgot to clock out · {daysAgo} day{daysAgo === 1 ? '' : 's'} ago
        </div>
        <div style={{fontWeight: 700, color: 'var(--trp-navy)', fontSize: 16, marginBottom: 4}}>
          You're still clocked in from {startedLabel}
        </div>
        <div className="tiny muted" style={{marginBottom: 12}}>
          The timer kept running. Set the correct clock-out time before
          you can clock in fresh today.
        </div>
        <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
          <button className="btn" onClick={onEdit} style={{background: 'var(--trp-coral)'}}>
            ✎ Set clock-out time
          </button>
          <button className="btn ghost" onClick={closeOutAtEndOfDay}>
            Close at end of day (clock-in + 8h)
          </button>
          <button
            className="btn ghost"
            onClick={discard}
            style={{color: 'var(--trp-coral-700)'}}
          >
            Discard this session
          </button>
        </div>
      </div>
    </div>
  );
}
