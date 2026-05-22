// app/Timesheet.jsx — Weekly view: per-day rows, manual edits, submit.
// Single-user. Also handles partial-submit-with-estimates so Erika can
// submit by the 13th/28th deadline with the last 2-3 days pre-filled.

const { useState: useStateTS } = React;

function Timesheet() {
  const { state, actions } = useStore();
  const user = currentUser(state);

  const [weekStart, setWeekStart] = useStateTS(() => TC.weekRange(new Date(), 0).startIso);
  const [editing, setEditing] = useStateTS(null); // entry id, or { new: dateIso }

  const now = useLiveClock();

  const days = TC.weekDays(weekStart);
  const totals = weekTotals(state, weekStart, user.id, now);
  const submission = weekSubmission(state, weekStart, user.id);
  const locked = isWeekLocked(state, weekStart, user.id);

  const todayIso = TC.isoDate(new Date(now));
  const todayWeekStart = TC.weekRange(new Date(now), 0).startIso;
  function shiftWeek(delta) {
    const d = TC.parseDate(weekStart);
    d.setDate(d.getDate() + 7 * delta);
    setWeekStart(TC.weekRange(d, 0).startIso);
  }

  function entriesForDay(d) { return state.timeEntries.filter(e => e.userId === user.id && e.date === d); }
  function leaveForDay(d) { return state.leaveEntries.filter(l => l.userId === user.id && l.date === d); }

  // Are any days in this week beyond today? (Drives the partial-submit hint.)
  const hasUpcomingDays = days.some(d => d > todayIso);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Weekly timesheet</div>
          <h1>Your Timesheet</h1>
        </div>
      </div>

      <div className="week-nav">
        <button onClick={() => shiftWeek(-1)} aria-label="Previous week">‹</button>
        <div className="range">{TC.fmtRange(weekStart, days[6])}</div>
        <button onClick={() => shiftWeek(1)} aria-label="Next week">›</button>
        {weekStart !== todayWeekStart && (
          <button className="btn ghost small" onClick={() => setWeekStart(todayWeekStart)}>This week</button>
        )}
      </div>

      <WeekStatusBanner totals={totals} submission={submission} />

      {submission && submission.directorComment && submission.status === 'approved' && (
        <div className="comment-block">
          <span className="from">Approver note</span>
          {submission.directorComment}
        </div>
      )}

      <div className="card" style={{padding: 0, overflowX: 'auto'}}>
        <table className="ts-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Sessions</th>
              <th style={{textAlign: 'right'}}>Worked</th>
              <th style={{textAlign: 'right'}}>PTO</th>
              <th style={{textAlign: 'right'}}>Sick</th>
              <th style={{textAlign: 'right'}}>Total</th>
              {!locked && <th></th>}
            </tr>
          </thead>
          <tbody>
            {days.map((d, idx) => {
              const dayTotal = totals.perDay[idx];
              const ents = entriesForDay(d);
              const lv = leaveForDay(d);
              const isToday = d === todayIso;
              const isFuture = d > todayIso;
              return (
                <tr key={d} className={isToday ? 'today' : ''} style={isFuture ? {opacity: 0.7} : undefined}>
                  <td className="day">
                    {TC.fmtDayShort(d)}
                    {isToday && <div className="tiny muted" style={{textTransform: 'none', letterSpacing: 0, fontWeight: 400, marginTop: 2}}>Today</div>}
                    {isFuture && <div className="tiny" style={{textTransform: 'none', letterSpacing: 0, fontWeight: 400, marginTop: 2, color: 'var(--trp-orange-700)'}}>Upcoming</div>}
                  </td>
                  <td>
                    {ents.length === 0 && lv.length === 0 && (
                      <span className="muted tiny">No sessions</span>
                    )}
                    {ents.map(e => (
                      <SessionRow key={e.id} entry={e} now={now} locked={locked} onEdit={() => setEditing(e.id)} onDelete={() => actions.deleteEntry(e.id)} />
                    ))}
                    {lv.map(l => (
                      <div key={l.id} className="tiny" style={{margin: '4px 0'}}>
                        <strong style={{textTransform: 'uppercase', fontFamily: 'var(--font-display)', letterSpacing: 'var(--tracking-caps)', fontSize: 11, color: l.type === 'pto' ? 'var(--trp-orange-700)' : 'var(--trp-pacific-700)'}}>
                          {l.type === 'pto' ? 'PTO' : 'Sick'}
                        </strong>
                        {' · '}{TC.fmtHours(l.hours)} hrs
                      </div>
                    ))}
                  </td>
                  <td className="hrs" style={{textAlign: 'right'}}>{TC.fmtHours(dayTotal.work)}</td>
                  <td className="hrs" style={{textAlign: 'right'}}>{TC.fmtHours(dayTotal.pto)}</td>
                  <td className="hrs" style={{textAlign: 'right'}}>{TC.fmtHours(dayTotal.sick)}</td>
                  <td className="hrs total" style={{textAlign: 'right'}}>{TC.fmtHours(dayTotal.total)}</td>
                  {!locked && (
                    <td style={{textAlign: 'right'}}>
                      <button className="btn ghost small" onClick={() => setEditing({ new: d })}>+ Add</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td></td>
              <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(totals.workTotal)}</td>
              <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(totals.ptoTotal)}</td>
              <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(totals.sickTotal)}</td>
              <td className="tnum total-val" style={{textAlign: 'right'}}>{TC.fmtHours(totals.total)}</td>
              {!locked && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>

      {!locked && hasUpcomingDays && (
        <div className="comment-block" style={{marginTop: 16, borderLeftColor: 'var(--trp-orange)'}}>
          <span className="from" style={{color: 'var(--trp-orange-700)'}}>Submitting the pay period early?</span>
          If you'll need to send the pay period to Katrina before the week is
          over, click <strong>+ Add</strong> on each upcoming row and tick{' '}
          <strong>Estimated hours</strong>. Estimates are flagged on the
          signed PDF.
        </div>
      )}

      {!locked && (
        <div className="comment-block" style={{marginTop: 12, borderLeftColor: 'var(--trp-coral)'}}>
          <span className="from" style={{color: 'var(--trp-coral-700)'}}>Ready to send?</span>
          When this pay period is ready for Katrina's approval, head to the{' '}
          <strong>Home</strong> tab — the <em>Submit Pay Period for Approval</em>{' '}
          card there sends everything in one step.
        </div>
      )}

      {locked && (
        <div className="comment-block" style={{marginTop: 16}}>
          <span className="from">Locked</span>
          This week is {submission && submission.status === 'submitted' ? 'awaiting Katrina\'s approval' : 'approved and locked'}.
        </div>
      )}

      {editing && (
        <EntryEditor
          entryId={typeof editing === 'string' ? editing : null}
          newDate={typeof editing === 'object' ? editing.new : null}
          userId={user.id}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function SessionRow({ entry, now, locked, onEdit, onDelete }) {
  const open = !entry.clockOut;
  // An "abandoned" open session = clocked in on a prior day and never
  // clocked out. Surface a clear warning + always allow edit/delete so
  // the user can fix it.
  const todayIso = TC.isoDate(new Date(now));
  const abandoned = open && entry.date < todayIso;
  return (
    <div className="tiny" style={{margin: '4px 0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap'}}>
      <span className="tnum">{TC.fmtTime(entry.clockIn)} → {open ? '…' : TC.fmtTime(entry.clockOut)}</span>
      {entry.breakMinutes > 0 && <span className="muted">break {entry.breakMinutes}m</span>}
      {!abandoned && (
        <span className="tnum" style={{fontWeight: 700, color: 'var(--trp-navy)'}}>{TC.fmtHours(TC.entryHours(entry, now))}h</span>
      )}
      {entry.estimated
        ? <span className="manual-flag" style={{background: 'var(--trp-orange-100)', color: 'var(--trp-orange-700)'}}>Estimate</span>
        : entry.manuallyEdited ? <span className="manual-flag">Edited</span> : null}
      {open && !abandoned && <Badge live />}
      {abandoned && (
        <span className="manual-flag" style={{
          background: 'var(--trp-coral-100)', color: 'var(--trp-coral-700)',
          fontWeight: 700,
        }}>
          ⚠ No clock-out — edit to set end time
        </span>
      )}
      {!locked && (
        <>
          <button className="btn ghost small" onClick={onEdit}>Edit</button>
          <button className="btn ghost small" onClick={onDelete} style={{color: 'var(--trp-coral-700)'}}>Delete</button>
        </>
      )}
    </div>
  );
}

function EntryEditor({ entryId, newDate, userId, onClose }) {
  const { state, actions } = useStore();
  const existing = entryId ? state.timeEntries.find(e => e.id === entryId) : null;
  const [date, setDate] = useStateTS(existing ? existing.date : newDate);
  // For NEW sessions, leave fields blank — the user fills in only what
  // actually happened. (No auto-9-to-5 with a 30-min break.) For
  // existing entries, prefill with whatever's already saved.
  const [clockIn, setClockIn] = useStateTS(existing && existing.clockIn ? TC.isoToTimeInput(existing.clockIn) : '');
  const [clockOut, setClockOut] = useStateTS(existing && existing.clockOut ? TC.isoToTimeInput(existing.clockOut) : '');
  const [breakMinutes, setBreakMinutes] = useStateTS(existing ? String(existing.breakMinutes ?? '') : '');
  const [estimated, setEstimated] = useStateTS(() => {
    if (existing) return !!existing.estimated;
    return newDate && newDate > TC.isoDate(new Date());
  });

  function save() {
    if (!clockIn) {
      alert('Please enter a Clock In time.');
      return;
    }
    const clockInIso = TC.dateAndTimeToIso(date, clockIn);
    const clockOutIso = clockOut ? TC.dateAndTimeToIso(date, clockOut) : null;
    const breakNum = breakMinutes === '' ? 0 : (Number(breakMinutes) || 0);
    if (existing) {
      actions.updateEntry(existing.id, {
        date,
        clockIn: clockInIso,
        clockOut: clockOutIso,
        breakMinutes: breakNum,
        estimated: !!estimated,
      });
    } else {
      actions.addManualEntry(userId, {
        date,
        clockIn,
        clockOut: clockOut || null,
        breakMinutes: breakNum,
        estimated: !!estimated,
      });
    }
    onClose();
  }

  let preview = 0;
  let hasPreview = false;
  if (date && clockIn && clockOut) {
    const fakeEntry = {
      clockIn: TC.dateAndTimeToIso(date, clockIn),
      clockOut: TC.dateAndTimeToIso(date, clockOut),
      breakMinutes: breakMinutes === '' ? 0 : (Number(breakMinutes) || 0),
    };
    preview = TC.entryHours(fakeEntry);
    hasPreview = true;
  }

  const isFuture = date && date > TC.isoDate(new Date());

  return (
    <Modal
      title={existing ? 'Edit session' : 'Add session'}
      subtitle={existing
        ? 'Changes here are flagged as manually edited so your approver can see.'
        : isFuture
          ? 'Logging an expected/upcoming day? Check "Estimated" so it shows clearly in the signed PDF.'
          : 'Fill in only what happened — leave Clock Out and Break blank if you didn\'t clock out or take an unpaid break.'}
      onClose={onClose}
    >
      <label className="field">
        <span className="lbl">Date</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="lbl">Clock In</span>
          <input type="time" value={clockIn} onChange={e => setClockIn(e.target.value)} />
        </label>
        <label className="field">
          <span className="lbl">Clock Out</span>
          <input type="time" value={clockOut} onChange={e => setClockOut(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="lbl">Unpaid Break (minutes)</span>
        <input
          type="number"
          min="0"
          max="480"
          placeholder={existing ? '' : 'Leave blank if none'}
          value={breakMinutes}
          onChange={e => setBreakMinutes(e.target.value)}
        />
      </label>
      <label className="checkbox-row" style={{marginBottom: 12, alignItems: 'flex-start'}}>
        <input type="checkbox" checked={estimated} onChange={e => setEstimated(e.target.checked)} style={{marginTop: 3}} />
        <span>
          <strong>Estimated hours</strong>
          <div className="tiny muted" style={{marginTop: 2}}>
            Use for days that haven't happened yet so you can submit before the deadline. Flagged clearly on the signed PDF.
          </div>
        </span>
      </label>
      <div style={{
        background: 'var(--trp-cream-100)', padding: '12px 14px',
        borderRadius: 'var(--radius-sm)', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', marginTop: 4
      }}>
        <span style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontSize: 11, fontWeight: 700, color: 'var(--trp-navy)'}}>Total Hours</span>
        <span className="tnum" style={{fontSize: 22, fontWeight: 700, color: hasPreview ? 'var(--trp-navy)' : 'var(--trp-stone-500)', fontFamily: 'var(--font-display)'}}>
          {hasPreview ? TC.fmtHours(preview) : (clockIn && !clockOut ? 'Open — no clock-out yet' : '—')}
        </span>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={save}>{existing ? 'Save changes' : 'Add session'}</button>
      </div>
    </Modal>
  );
}

Object.assign(window, { Timesheet, EntryEditor });
