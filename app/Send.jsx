// app/Send.jsx — Replaces the old Director queue. Single-user Erika app:
// once a pay period's weeks are all submitted, this card prompts her to
// email the approval request to Katrina. It also shows the "Send to
// Approver" modal that builds the mailto link.

const { useState: useStateSend } = React;

// ----- Ready-to-send card --------------------------------------------------
//
// Surfaced on Home when a pay period has at least one submitted week and
// every week containing data is ready (status = submitted or approved).

function PayPeriodSendCard({ payPeriod, state, onSend }) {
  const { actions } = useStore();
  const [showOffline, setShowOffline] = useStateSend(false);
  const [confirmCancel, setConfirmCancel] = useStateSend(false);
  const pp = payPeriodForDate(payPeriod.periodStart, state.settings);
  const totals = payPeriodTotals(state, payPeriod.periodStart, payPeriod.userId);
  const weekStarts = payPeriodWeekStarts(pp.periodStart, pp.periodEnd);
  const childWeeks = weekStarts
    .map(ws => ({ ws, sub: weekSubmission(state, ws, payPeriod.userId), tot: weekTotals(state, ws, payPeriod.userId) }))
    .filter(x => x.tot.total > 0);

  const payDateLabel = TC.parseDate(pp.payDate).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  const deadlineIso = payPeriodSubmitDeadline(pp.periodStart, state.settings);
  const deadlineLabel = TC.parseDate(deadlineIso).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  const today = new Date();
  const todayIso = TC.isoDate(today);
  const daysToDeadline = Math.ceil((TC.parseDate(deadlineIso) - TC.parseDate(todayIso)) / 86400000);

  let deadlineCopy, deadlineColor;
  if (daysToDeadline > 1) { deadlineCopy = `Deadline in ${daysToDeadline} days`; deadlineColor = 'var(--trp-pacific-700)'; }
  else if (daysToDeadline === 1) { deadlineCopy = 'Deadline tomorrow'; deadlineColor = 'var(--trp-orange-700)'; }
  else if (daysToDeadline === 0) { deadlineCopy = 'Deadline today'; deadlineColor = 'var(--trp-coral-700)'; }
  else { deadlineCopy = `${Math.abs(daysToDeadline)} day${Math.abs(daysToDeadline) === 1 ? '' : 's'} past deadline`; deadlineColor = 'var(--trp-coral-700)'; }

  const isAwaiting = payPeriod.status === 'awaiting_approval';

  return (
    <div className="queue-card" style={{
      borderLeftColor: isAwaiting ? 'var(--trp-pacific-blue)' : 'var(--trp-coral)',
      background: 'linear-gradient(135deg, var(--trp-cream-50) 0%, white 100%)',
    }}>
      <div className="top">
        <div>
          <div className="eyebrow" style={{color: isAwaiting ? 'var(--trp-pacific-700)' : 'var(--trp-coral-700)', marginBottom: 4}}>
            {isAwaiting ? 'Awaiting Approval · Sent to Katrina' : 'Ready to Send for Approval'}
          </div>
          <h3 className="title">{pp.label} · {TC.parseDate(pp.periodStart).getFullYear()}</h3>
          <div className="subtitle">
            {TC.fmtRange(pp.periodStart, pp.periodEnd)} · Pay date {payDateLabel}
          </div>
        </div>
        <div style={{textAlign: 'right'}}>
          <div style={{fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 40, color: 'var(--trp-navy)', lineHeight: 1, fontVariantNumeric: 'tabular-nums'}}>
            {TC.fmtHours(totals.total)}
          </div>
          <div className="tiny muted" style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontWeight: 700, fontSize: 10, marginTop: 2}}>
            Hours Worked
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '12px 16px',
        background: isAwaiting ? 'var(--trp-pacific-50)' : 'var(--trp-coral-100)',
        border: `1px solid ${isAwaiting ? 'var(--trp-pacific-100)' : 'var(--trp-coral)'}`,
        borderRadius: 'var(--radius-sm)',
        marginBottom: 14, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontSize: 10, fontWeight: 700, color: 'var(--trp-stone-700)', marginBottom: 2}}>
            Submit by
          </div>
          <div style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontSize: 14, fontWeight: 700, color: 'var(--trp-navy)'}}>
            {deadlineLabel} <span style={{color: deadlineColor, fontSize: 11, marginLeft: 6}}>{deadlineCopy}</span>
          </div>
        </div>
        {isAwaiting && payPeriod.sentToApproverAt && (
          <div className="tiny muted" style={{textAlign: 'right'}}>
            Sent {new Date(payPeriod.sentToApproverAt).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}
          </div>
        )}
      </div>

      <table className="mini-table">
        <thead>
          <tr>
            <th>Week</th>
            <th style={{textAlign: 'right'}}>Clocked</th>
            <th style={{textAlign: 'right'}}>PTO</th>
            <th style={{textAlign: 'right'}}>Sick</th>
            <th style={{textAlign: 'right'}}>Holiday</th>
            <th style={{textAlign: 'right'}}>LWOP</th>
            <th style={{textAlign: 'right'}}>Total</th>
          </tr>
        </thead>
        <tbody>
          {childWeeks.map(({ ws, tot }) => (
            <tr key={ws}>
              <td style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontWeight: 700, fontSize: 11, color: 'var(--trp-navy)'}}>
                {TC.fmtRange(ws, TC.weekDays(ws)[6])}
              </td>
              <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(tot.workTotal)}</td>
              <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(tot.ptoTotal)}</td>
              <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(tot.sickTotal)}</td>
              <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(tot.holidayTotal || 0)}</td>
              <td className="tnum" style={{textAlign: 'right', color: (tot.lwopTotal || 0) > 0 ? 'var(--trp-stone-700)' : undefined}}>{TC.fmtHours(tot.lwopTotal || 0)}</td>
              <td className="tnum" style={{textAlign: 'right', fontWeight: 700, color: 'var(--trp-navy)'}}>{TC.fmtHours(tot.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="actions">
        {!isAwaiting && (
          <button className="btn" style={{background: 'var(--trp-coral)'}} onClick={onSend}>
            ✉ Submit Pay Period for Approval
          </button>
        )}
        {isAwaiting && (
          <>
            <button className="btn ghost" onClick={onSend}>↻ Resend approval link</button>
            <div className="tiny muted" style={{marginLeft: 'auto', alignSelf: 'center', maxWidth: 280, textAlign: 'right'}}>
              Waiting on Katrina's signature. The receipt link she emails back will auto-record the approval here.
            </div>
          </>
        )}
      </div>

      {isAwaiting && (
        <div style={{
          marginTop: 12, paddingTop: 12,
          borderTop: '1px dashed var(--border-soft)',
          display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)', textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps)', fontWeight: 700, fontSize: 10,
            color: 'var(--trp-stone-700)',
          }}>
            Sent by mistake?
          </div>
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            style={{
              background: 'transparent', border: 'none', padding: 0,
              color: 'var(--trp-coral-700)', cursor: 'pointer',
              fontFamily: 'var(--font-display)', textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps)', fontWeight: 700, fontSize: 10,
              textDecoration: 'underline',
            }}
            title="Pull this pay period back so you can edit or re-send it"
          >
            ✕ Cancel approval request
          </button>
          <span style={{color: 'var(--border-strong)', fontSize: 10}}>·</span>
          <button
            type="button"
            onClick={() => setShowOffline(true)}
            style={{
              background: 'transparent', border: 'none', padding: 0,
              color: 'var(--trp-stone-700)', cursor: 'pointer',
              fontFamily: 'var(--font-display)', textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps)', fontWeight: 700, fontSize: 10,
              textDecoration: 'underline',
            }}
            title="Stamp this period as approved without going through Katrina — for historical / backfilled records"
          >
            ✓ Mark as approved offline instead
          </button>
        </div>
      )}

      {!isAwaiting && (
        <div style={{marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border-soft)'}}>
          <button
            type="button"
            onClick={() => setShowOffline(true)}
            style={{
              background: 'transparent', border: 'none', padding: 0,
              color: 'var(--trp-stone-700)', cursor: 'pointer',
              fontFamily: 'var(--font-display)', textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps)', fontWeight: 700, fontSize: 10,
            }}
          >
            Already approved offline? → Backfill record
          </button>
        </div>
      )}

      {confirmCancel && (
        <Modal
          title="Cancel approval request?"
          subtitle={`${pp.label} · ${TC.fmtRange(pp.periodStart, pp.periodEnd)}`}
          onClose={() => setConfirmCancel(false)}
          maxWidth={460}
        >
          <div className="cert-box" style={{borderLeftColor: 'var(--trp-coral)'}}>
            <strong style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontSize: 10, display: 'block', marginBottom: 4}}>
              This will…
            </strong>
            Move <strong>{pp.label}</strong> back to draft so you can edit the
            hours or re-send it. Any approval link Katrina already has will
            stop working once you re-send a new one. <strong>Nothing is
            emailed to Katrina</strong> — if she already signed, just wait for
            her receipt link instead of cancelling.
          </div>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setConfirmCancel(false)}>Keep waiting</button>
            <button
              className="btn"
              style={{background: 'var(--trp-coral)'}}
              onClick={() => {
                actions.cancelPayPeriodSend(pp.periodStart, payPeriod.userId);
                setConfirmCancel(false);
              }}
            >
              ✕ Yes, cancel approval request
            </button>
          </div>
        </Modal>
      )}

      {showOffline && (
        <OfflineApprovalModal
          periodStartIso={pp.periodStart}
          onClose={() => setShowOffline(false)}
        />
      )}
    </div>
  );
}

// ----- Offline / backfill approval ---------------------------------------
//
// For pay periods that were already approved by the supervisor BEFORE the
// app existed — Erika has the historical hours logged for her own records
// but doesn't need to re-route them through Katrina. Just stamps the
// period as approved without accruing PTO/sick (which already happened).

function OfflineApprovalModal({ periodStartIso, onClose }) {
  const { state, actions } = useStore();
  const emp = employee(state);
  const appr = director(state);
  const pp = payPeriodForDate(periodStartIso, state.settings);
  const totals = payPeriodTotals(state, periodStartIso, emp.id);

  // Default approval date = pay date of the period.
  const [signedAt, setSignedAt] = useStateSend(pp.payDate);
  const [signedName, setSignedName] = useStateSend(appr.name);
  const [signedTitle, setSignedTitle] = useStateSend(appr.title);
  const [comment, setComment] = useStateSend('Backfilled record — pay period was approved offline prior to using this app.');

  function save() {
    actions.markPayPeriodApprovedOffline(periodStartIso, emp.id, {
      signedName: signedName.trim(),
      signedTitle: signedTitle.trim(),
      // Stamp at noon of the chosen day so timezone math doesn't sneak it
      // into the previous calendar day.
      signedAt: new Date(signedAt + 'T12:00:00').toISOString(),
      comment: comment.trim(),
    });
    onClose();
  }

  return (
    <Modal
      title="Backfill approval (offline)"
      subtitle={`${pp.label} · ${TC.fmtRange(pp.periodStart, pp.periodEnd)} · ${TC.fmtHours(totals.total)} hrs`}
      onClose={onClose}
    >
      <div className="cert-box" style={{borderLeftColor: 'var(--trp-stone-500)', background: 'var(--trp-cream-100)'}}>
        <strong style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontSize: 10, display: 'block', marginBottom: 4}}>
          For historical pay periods only
        </strong>
        Use this when a period was already approved by your supervisor
        through the old process and you just want a record in the app.
        Nothing emails to Katrina, no signature is collected, and{' '}
        <strong>no PTO/sick accrual is added</strong> (since the period
        already ran payroll). The PDF receipt will be marked "offline /
        backfilled" so it's not confused with a fresh approval.
      </div>

      <div className="field-row">
        <label className="field">
          <span className="lbl">Approval date</span>
          <input type="date" value={signedAt} onChange={e => setSignedAt(e.target.value)} />
        </label>
        <label className="field">
          <span className="lbl">Approver name</span>
          <input type="text" value={signedName} onChange={e => setSignedName(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span className="lbl">Approver title</span>
        <input type="text" value={signedTitle} onChange={e => setSignedTitle(e.target.value)} />
      </label>
      <label className="field">
        <span className="lbl">Note</span>
        <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} />
      </label>

      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={save} style={{background: 'var(--trp-stone-700)'}}>
          Record as Approved (Offline)
        </button>
      </div>
    </Modal>
  );
}

// ----- Send modal: builds + previews the mailto + copyable link ----------

function SendForApprovalModal({ periodStartIso, onClose }) {
  const { state, actions } = useStore();
  const emp = employee(state);
  const appr = director(state);
  const pp = payPeriodForDate(periodStartIso, state.settings);
  const totals = payPeriodTotals(state, periodStartIso, emp.id);

  const [copied, setCopied] = useStateSend(false);
  const [opened, setOpened] = useStateSend(false);

  const link = approvalRequestUrl(state, periodStartIso);

  // Gmail compose URL — opens Gmail in a new tab with subject/body
  // prefilled. We use this instead of mailto: because Erika lives in
  // Gmail and a raw mailto: link won't trigger the Gmail tab unless the
  // browser is specifically configured (most aren't).
  function gmailComposeUrl(to, subject, body) {
    return 'https://mail.google.com/mail/?view=cm&fs=1' +
      `&to=${encodeURIComponent(to)}` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
  }

  const deadlineIso = payPeriodSubmitDeadline(pp.periodStart, state.settings);
  const deadlineLabel = TC.parseDate(deadlineIso).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  const payDateLabel = TC.parseDate(pp.payDate).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const subject = `Timecard approval needed · ${emp.name} · ${pp.label}`;

  // Count anything dated AFTER today in this period — those hours are
  // "assumptions" Erika is attesting to so she can submit before payroll
  // runs on the 27th. Surface them explicitly so Katrina knows.
  const todayIso = TC.isoDate(new Date());
  let assumedHrs = 0;
  state.timeEntries.forEach(e => {
    if (e.userId === emp.id && e.date > todayIso && e.date >= pp.periodStart && e.date <= pp.periodEnd) {
      assumedHrs += TC.entryHours(e);
    }
  });
  state.leaveEntries.forEach(l => {
    if (l.userId === emp.id && l.date > todayIso && l.date >= pp.periodStart && l.date <= pp.periodEnd) {
      assumedHrs += l.hours;
    }
  });
  const hasAssumptions = assumedHrs > 0;
  const assumptionLine = hasAssumptions
    ? `\nThis includes ${TC.fmtHours(assumedHrs)} hrs of assumed time for upcoming days (${TC.fmtDayShort(todayIso)} → ${TC.fmtDayShort(pp.periodEnd)}) — payroll runs before the period closes, so I'm attesting to those hours now and will adjust if anything changes.\n`
    : '';

  const body =
    `Hi ${appr.name.split(/\s+|-/)[0]},\n\n` +
    `My timecard for ${pp.label} (${TC.fmtRange(pp.periodStart, pp.periodEnd)}) is ready for your approval.\n\n` +
    `Hours Worked: ${TC.fmtHours(totals.total)} hrs (${TC.fmtHours(totals.work)} clocked, ${TC.fmtHours(totals.pto)} PTO, ${TC.fmtHours(totals.sick)} sick${(totals.holiday || 0) > 0 ? `, ${TC.fmtHours(totals.holiday)} holiday` : ''}${(totals.lwop || 0) > 0 ? `, ${TC.fmtHours(totals.lwop)} LWOP` : ''})\n` +
    assumptionLine +
    `Pay date: ${payDateLabel}\n` +
    `Approval needed by: ${deadlineLabel}\n\n` +
    `Click below to review and sign. The page will generate a signed PDF for payroll and a one-click link to send back to me so my records update.\n\n` +
    `${link}\n\n` +
    `Thanks,\n${emp.name}`;

  const mailto = `mailto:${encodeURIComponent(appr.email)}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;
  const gmailUrl = gmailComposeUrl(appr.email, subject, body);

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function send(via) {
    // Submit any draft weeks first, then mark sent. (Both happen before
    // we open the email so the local record matches what's en route.)
    actions.submitAllWeeksInPeriod(periodStartIso, emp.id);
    actions.markPayPeriodSent(periodStartIso, emp.id);
    setOpened(true);
    // Always stash the link on the clipboard — if the email window fails
    // to open or strips the URL, the user can paste it in directly.
    navigator.clipboard.writeText(link).catch(() => {});
    if (via === 'gmail') {
      window.open(gmailUrl, '_blank', 'noopener');
    } else {
      window.location.href = mailto;
    }
  }

  return (
    <Modal
      title="Send approval request to Katrina"
      subtitle={`${pp.label} · ${TC.fmtRange(pp.periodStart, pp.periodEnd)} · ${TC.fmtHours(totals.total)} hrs`}
      onClose={onClose}
      maxWidth={620}
    >
      <div className="cert-box" style={{borderLeftColor: 'var(--trp-coral)'}}>
        <strong style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontSize: 10, display: 'block', marginBottom: 4}}>
          How this works
        </strong>
        Clicking <strong>Send</strong> opens your email app with a message to{' '}
        <strong>{appr.email}</strong> already written, including a one-click
        approval link. Katrina opens the link, reviews the hours, types her
        name to sign, and emails back a receipt link that automatically marks
        this period as approved in your Timecard.
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        marginBottom: 16, padding: '12px 14px',
        background: 'var(--trp-cream-100)', borderRadius: 'var(--radius-sm)',
      }}>
        <div>
          <div className="eyebrow" style={{color: 'var(--trp-stone-700)'}}>To</div>
          <div style={{fontWeight: 700, color: 'var(--trp-navy)'}}>{appr.name}</div>
          <div className="tiny muted">{appr.email}</div>
        </div>
        <div>
          <div className="eyebrow" style={{color: 'var(--trp-stone-700)'}}>Subject</div>
          <div style={{fontSize: 13, color: 'var(--trp-navy)', fontWeight: 700, lineHeight: 1.3}}>{subject}</div>
        </div>
      </div>

      <details style={{marginBottom: 16}}>
        <summary style={{cursor: 'pointer', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontSize: 11, fontWeight: 700, color: 'var(--trp-stone-700)', marginBottom: 8}}>
          Preview email body
        </summary>
        <pre style={{
          background: 'var(--trp-cream-50)', padding: 12,
          borderRadius: 'var(--radius-sm)', fontFamily: 'ui-monospace, monospace',
          fontSize: 11, color: 'var(--fg-2)', whiteSpace: 'pre-wrap',
          maxHeight: 200, overflow: 'auto', border: '1px solid var(--border-soft)',
        }}>{body}</pre>
      </details>

      {opened && (
        <div className="comment-block" style={{margin: '0 0 14px', borderLeftColor: 'var(--trp-pacific-blue)', background: 'var(--trp-pacific-50)'}}>
          <span className="from" style={{color: 'var(--trp-pacific-700)'}}>Email app opened</span>
          Hit Send in your email client to deliver the approval request. If
          nothing opened, use the copy-link button below and paste it into a
          new email to {appr.email}.
        </div>
      )}

      <div style={{display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap'}}>
        <button className="btn ghost small" onClick={copyLink}>
          {copied ? '✓ Link copied' : '⧉ Copy approval link'}
        </button>
        <span className="tiny muted">in case your email app doesn't open automatically</span>
      </div>

      <div className="modal-actions" style={{flexWrap: 'wrap'}}>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={() => send('default')} style={{background: 'var(--trp-stone-700)'}}>
          ✉ Default mail app
        </button>
        <button className="btn" onClick={() => send('gmail')} style={{background: 'var(--trp-coral)'}}>
          ✉ Open Gmail
        </button>
      </div>
    </Modal>
  );
}

Object.assign(window, { PayPeriodSendCard, SendForApprovalModal });
