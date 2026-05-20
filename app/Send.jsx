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
            total hours
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
            <th style={{textAlign: 'right'}}>Worked</th>
            <th style={{textAlign: 'right'}}>PTO</th>
            <th style={{textAlign: 'right'}}>Sick</th>
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
              <td className="tnum" style={{textAlign: 'right', fontWeight: 700, color: 'var(--trp-navy)'}}>{TC.fmtHours(tot.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="actions">
        {!isAwaiting && (
          <button className="btn" style={{background: 'var(--trp-coral)'}} onClick={onSend}>
            ✉ Send to Katrina for Approval
          </button>
        )}
        {isAwaiting && (
          <>
            <button className="btn ghost" onClick={onSend}>↻ Resend approval link</button>
            <div className="tiny muted" style={{marginLeft: 'auto', alignSelf: 'center'}}>
              Waiting on Katrina's signature. The receipt link she emails back will auto-record the approval here.
            </div>
          </>
        )}
      </div>
    </div>
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

  const deadlineIso = payPeriodSubmitDeadline(pp.periodStart, state.settings);
  const deadlineLabel = TC.parseDate(deadlineIso).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  const payDateLabel = TC.parseDate(pp.payDate).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const subject = `Timecard approval needed · ${emp.name} · ${pp.label}`;
  const body =
    `Hi ${appr.name.split(/\s+|-/)[0]},\n\n` +
    `My timecard for ${pp.label} (${TC.fmtRange(pp.periodStart, pp.periodEnd)}) is ready for your approval.\n\n` +
    `Total: ${TC.fmtHours(totals.total)} hrs (${TC.fmtHours(totals.work)} worked, ${TC.fmtHours(totals.pto)} PTO, ${TC.fmtHours(totals.sick)} sick)\n` +
    `Pay date: ${payDateLabel}\n` +
    `Approval needed by: ${deadlineLabel}\n\n` +
    `Click below to review and sign. The page will generate a signed PDF for payroll and a one-click link to send back to me so my records update.\n\n` +
    `${link}\n\n` +
    `Thanks,\n${emp.name}`;

  const mailto = `mailto:${encodeURIComponent(appr.email)}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function send() {
    // Mark locally first, THEN open mail client. (Most clients steal focus
    // for a moment — better to commit state before that happens.)
    actions.markPayPeriodSent(periodStartIso, emp.id);
    setOpened(true);
    window.location.href = mailto;
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

      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={send} style={{background: 'var(--trp-coral)'}}>
          ✉ Open email to Katrina
        </button>
      </div>
    </Modal>
  );
}

Object.assign(window, { PayPeriodSendCard, SendForApprovalModal });
