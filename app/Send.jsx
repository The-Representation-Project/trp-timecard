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
  const today = new Date();
  const todayIso = TC.isoDate(today);
  const breakdown = payPeriodBreakdown(state, payPeriod.periodStart, payPeriod.userId, todayIso);
  const totals = breakdown;
  const dayRows = payPeriodDayRows(state, payPeriod.periodStart, payPeriod.userId);

  const payDateLabel = TC.parseDate(pp.payDate).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  const deadlineIso = payPeriodSubmitDeadline(pp.periodStart, state.settings);
  const deadlineLabel = TC.parseDate(deadlineIso).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });

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
          <PayPeriodTotalsSummary
            totals={totals}
            todayIso={todayIso}
            periodEnd={pp.periodEnd}
            variant="compact"
            align="right"
          />
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

      {totals.assumed > 0 && (
        <div className="comment-block warn" style={{marginBottom: 14}}>
          <span className="from" style={{color: 'var(--trp-orange-700)'}}>Early submission for approval deadline</span>
          Katrina will see the full {TC.fmtHours(totals.total)} hr pay period total above, with{' '}
          {TC.fmtHours(totals.confirmed)} hrs confirmed and{' '}
          <strong>{TC.fmtHours(totals.assumed)} hrs assumed</strong> (smaller, clearly labeled)
          for days still to come. You submit 2 days before pay date so she can approve before payroll runs.
        </div>
      )}

      <div style={{
        fontFamily: 'var(--font-display)', textTransform: 'uppercase',
        letterSpacing: 'var(--tracking-caps)', fontWeight: 700, fontSize: 11,
        color: 'var(--trp-stone-700)', marginBottom: 8,
      }}>
        Pay period days · {TC.fmtRange(pp.periodStart, pp.periodEnd)} only
      </div>
      <div className="tiny muted" style={{marginBottom: 10}}>
        Pay periods are approved as a whole — not week by week. Only days inside this period are shown.
      </div>

      <table className="mini-table">
        <thead>
          <tr>
            <th>Day</th>
            <th style={{textAlign: 'right'}}>Clocked</th>
            <th style={{textAlign: 'right'}}>PTO</th>
            <th style={{textAlign: 'right'}}>Sick</th>
            <th style={{textAlign: 'right'}}>Holiday</th>
            <th style={{textAlign: 'right'}}>LWOP</th>
            <th style={{textAlign: 'right'}}>Total</th>
          </tr>
        </thead>
        <tbody>
          {dayRows.map(d => (
            <tr key={d.dateIso}>
              <td style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontWeight: 700, fontSize: 11, color: 'var(--trp-navy)'}}>
                {TC.fmtDayShort(d.dateIso)}
              </td>
              <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(d.work)}</td>
              <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(d.pto)}</td>
              <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(d.sick)}</td>
              <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(d.holiday || 0)}</td>
              <td className="tnum" style={{textAlign: 'right', color: (d.lwop || 0) > 0 ? 'var(--trp-stone-700)' : undefined}}>{TC.fmtHours(d.lwop || 0)}</td>
              <td className="tnum" style={{textAlign: 'right', fontWeight: 700, color: 'var(--trp-navy)'}}>{TC.fmtHours(d.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{fontWeight: 700, color: 'var(--trp-navy)'}}>Pay period total</td>
            <td className="tnum" style={{textAlign: 'right', fontWeight: 700}}>{TC.fmtHours(totals.work)}</td>
            <td className="tnum" style={{textAlign: 'right', fontWeight: 700}}>{TC.fmtHours(totals.pto)}</td>
            <td className="tnum" style={{textAlign: 'right', fontWeight: 700}}>{TC.fmtHours(totals.sick)}</td>
            <td className="tnum" style={{textAlign: 'right', fontWeight: 700}}>{TC.fmtHours(totals.holiday || 0)}</td>
            <td className="tnum" style={{textAlign: 'right', fontWeight: 700, color: (totals.lwop || 0) > 0 ? 'var(--trp-stone-700)' : undefined}}>{TC.fmtHours(totals.lwop || 0)}</td>
            <td className="tnum" style={{textAlign: 'right', fontWeight: 700, color: 'var(--trp-navy)'}}>{TC.fmtHours(totals.total)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="actions">
        {!isAwaiting && (
          <>
            <button className="btn" style={{background: 'var(--trp-coral)'}} onClick={onSend}>
              ✉ Submit Pay Period for Approval
            </button>
            <button
              className="btn ghost"
              onClick={() => window.downloadPayPeriodExcel(state, payPeriod)}
              title="Download branded Excel timecard for this pay period"
            >
              ↓ Download Excel
            </button>
          </>
        )}
        {isAwaiting && (
          <>
            <button
              className="btn ghost"
              onClick={() => setConfirmCancel(true)}
              title="Pull this pay period back so you can edit hours on Timesheet"
            >
              🔓 Unlock for editing
            </button>
            <button className="btn ghost" onClick={onSend}>↻ Resend approval link</button>
            <PasteApprovalLinkButton />
            <div className="tiny muted" style={{marginLeft: 'auto', alignSelf: 'center', maxWidth: 280, textAlign: 'right'}}>
              Katrina signed? Paste the approval link from her email to update your records.
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
            title="Pull this pay period back so you can edit on Timesheet"
          >
            🔓 Unlock for editing
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
          title="Unlock for editing?"
          subtitle={`${pp.label} · ${TC.fmtRange(pp.periodStart, pp.periodEnd)}`}
          onClose={() => setConfirmCancel(false)}
          maxWidth={460}
        >
          <div className="cert-box" style={{borderLeftColor: 'var(--trp-coral)'}}>
            <strong style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontSize: 10, display: 'block', marginBottom: 4}}>
              This will…
            </strong>
            Move <strong>{pp.label}</strong> back to draft so you can edit hours
            on Timesheet and re-send when ready. Any old approval link Katrina
            has will stop working once you send a new one.{' '}
            <strong>Nothing is emailed to Katrina.</strong> If she already
            signed, wait for her receipt link instead of unlocking.
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
              🔓 Yes, unlock for editing
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
  const todayIso = TC.isoDate(new Date());
  const breakdown = payPeriodBreakdown(state, periodStartIso, emp.id, todayIso);
  const totals = breakdown;

  const [copied, setCopied] = useStateSend(false);
  const [opened, setOpened] = useStateSend(false);
  const [attested, setAttested] = useStateSend(false);

  const link = approvalRequestUrl(state, periodStartIso);

  const deadlineIso = payPeriodSubmitDeadline(pp.periodStart, state.settings);
  const deadlineLabel = TC.parseDate(deadlineIso).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  const payDateLabel = TC.parseDate(pp.payDate).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const subject = `Timecard approval needed · ${emp.name} · ${pp.label}`;

  const summaryBlock = buildPayPeriodEmailSummary(totals, {
    todayIso,
    periodEnd: pp.periodEnd,
    payDateLabel,
  });

  const body =
    `Hi ${appr.name.split(/\s+|-/)[0]},\n\n` +
    `My timecard for ${pp.label} (${TC.fmtRange(pp.periodStart, pp.periodEnd)}) is ready for your approval.\n\n` +
    `${summaryBlock}\n\n` +
    `Pay date: ${payDateLabel}\n` +
    `Approval needed by: ${deadlineLabel}\n\n` +
    `Click below to review and sign. The page will generate a signed PDF for payroll and a one-click link to send back to me so my records update.\n\n` +
    `${link}\n\n` +
    `Thanks,\n${emp.name}`;

  const gmailUrl = buildGmailComposeUrl({ to: appr.email, subject, body });
  const mailto = buildMailtoUrl({ to: appr.email, subject, body });

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function openEmail(via) {
    setOpened(true);
    navigator.clipboard.writeText(link).catch(() => {});
    if (via === 'gmail') {
      window.open(gmailUrl, '_blank', 'noopener');
    } else {
      window.location.href = mailto;
    }
  }

  function confirmEmailSent() {
    actions.submitAllWeeksInPeriod(periodStartIso, emp.id);
    actions.markPayPeriodSent(periodStartIso, emp.id);
    onClose();
  }

  return (
    <Modal
      title="Send approval request to Katrina"
      subtitle={`${pp.label} · ${TC.fmtRange(pp.periodStart, pp.periodEnd)} · ${TC.fmtHours(totals.total)} hrs${totals.assumed > 0 ? ` (${TC.fmtHours(totals.assumed)} assumed)` : ''}`}
      onClose={onClose}
      maxWidth={620}
    >
      <div className="cert-box" style={{borderLeftColor: 'var(--trp-coral)'}}>
        <strong style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontSize: 10, display: 'block', marginBottom: 4}}>
          How this works
        </strong>
        Click <strong>Open Gmail</strong> (or your default mail app) to compose
        the message to <strong>{appr.email}</strong> with the approval link.
        Nothing is marked as sent until you confirm below — you can still edit
        hours on Timesheet until then.
      </div>

      <PayPeriodTotalsSummary
        totals={totals}
        todayIso={todayIso}
        periodEnd={pp.periodEnd}
        variant="full"
      />

      <div className="cert-box" style={{borderLeftColor: 'var(--trp-navy)', marginBottom: 16}}>
        <strong style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontSize: 10, display: 'block', marginBottom: 4}}>
          Your attestation
        </strong>
        I, <strong>{emp.name}</strong>, certify that the hours shown for {pp.label}{' '}
        ({TC.fmtRange(pp.periodStart, pp.periodEnd)}) are complete and accurate to the best
        of my knowledge{totals.assumed > 0 ? ', including estimated hours for days not yet worked' : ''}.
      </div>

      <label className="checkbox-row" style={{marginBottom: 16, alignItems: 'flex-start'}}>
        <input
          type="checkbox"
          checked={attested}
          onChange={e => setAttested(e.target.checked)}
          style={{marginTop: 3, flexShrink: 0}}
        />
        <span>I attest these hours are accurate and I am ready to send this pay period to Katrina for approval.</span>
      </label>

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
          <span className="from" style={{color: 'var(--trp-pacific-700)'}}>Email opened — hours still editable</span>
          Hit Send in your email client when you're ready. Then click{' '}
          <strong>I've sent the email</strong> below so the app knows it's with
          Katrina. If nothing opened, copy the link and paste it into a new
          email to {appr.email}.
        </div>
      )}

      {totals.assumed > 0 && (
        <div className="comment-block warn" style={{margin: '0 0 14px'}}>
          <span className="from" style={{color: 'var(--trp-orange-700)'}}>Early submission — assumed hours included</span>
          The email and approval page show the full {TC.fmtHours(totals.total)} hr pay period total, with{' '}
          {TC.fmtHours(totals.confirmed)} hrs confirmed and {TC.fmtHours(totals.assumed)} hrs assumed
          clearly separated for Katrina.
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
        {!opened ? (
          <>
            <button
              className="btn"
              onClick={() => openEmail('default')}
              disabled={!attested}
              style={{background: 'var(--trp-stone-700)'}}
            >
              ✉ Default mail app
            </button>
            <button
              className="btn"
              onClick={() => openEmail('gmail')}
              disabled={!attested}
              style={{background: 'var(--trp-coral)'}}
            >
              ✉ Open Gmail
            </button>
          </>
        ) : (
          <button
            className="btn"
            onClick={confirmEmailSent}
            disabled={!attested}
            style={{background: 'var(--trp-pacific-blue)'}}
          >
            ✓ I've sent the email
          </button>
        )}
      </div>
    </Modal>
  );
}

Object.assign(window, { PayPeriodSendCard, SendForApprovalModal, PasteApprovalLinkButton });

function PasteApprovalLinkButton() {
  const { actions } = useStore();
  const [open, setOpen] = useStateSend(false);
  const [text, setText] = useStateSend('');
  const [error, setError] = useStateSend('');

  function apply() {
    const result = actions.importApprovalReceiptFromText(text);
    if (!result.ok) {
      setError(result.error || 'Could not apply that link.');
      return;
    }
    setOpen(false);
    setText('');
    setError('');
    alert('Approval recorded for ' + result.receipt.periodStart + ' → ' + result.receipt.periodEnd + '. Signed by ' + result.receipt.signedName + '.');
  }

  return (
    <>
      <button className="btn" style={{background: 'var(--trp-pacific-blue)'}} onClick={() => setOpen(true)}>
        ✓ Paste Katrina's approval link
      </button>
      {open && (
        <Modal
          title="Record Katrina's approval"
          subtitle="Paste the link from her “Approved: …” email (the long URL with #receipt=). This updates your Timecard — her signing alone does not."
          onClose={() => { setOpen(false); setError(''); }}
          maxWidth={560}
        >
          <div className="cert-box" style={{borderLeftColor: 'var(--trp-pacific-blue)', background: 'var(--trp-pacific-50)'}}>
            <strong style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontSize: 10, display: 'block', marginBottom: 4}}>
              How this works
            </strong>
            Katrina signs on her page, then emails you a receipt link. Your app only updates when that link is opened (or pasted here). The signed PDF alone does not change Timecard status.
          </div>
          <label className="field">
            <span className="lbl">Approval link or email text containing #receipt=</span>
            <textarea
              rows={4}
              value={text}
              onChange={e => { setText(e.target.value); setError(''); }}
              placeholder="https://…/Timecard.html#receipt=…"
              autoFocus
            />
          </label>
          {error && <div className="comment-block warn" style={{marginBottom: 12}}>{error}</div>}
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn" onClick={apply} disabled={!text.trim()} style={{background: 'var(--trp-pacific-blue)'}}>
              Record approval
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
