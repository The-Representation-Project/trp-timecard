// app/Approval.jsx — Standalone approval page Katrina sees when she clicks
// the link Erika emails her. Renders OUTSIDE the StoreProvider — never reads
// or writes localStorage; it works entirely from the URL-hash payload.
//
// Flow:
//   1. Katrina sees pay period summary, week breakdown, totals.
//   2. She types her full name to sign + checks the certification box.
//   3. She clicks "Sign & Generate". We:
//        a. Build the signed-receipt JSON.
//        b. Open the printable PDF (her browser's print dialog → Save as PDF).
//        c. Show "what to do next" panel with two big buttons:
//             • "Email approval back to Erika" — mailto with #receipt link
//             • "Download PDF again" — re-opens print dialog
//   4. She emails the PDF to payroll directly (or sends it back to Erika
//      who forwards). The mailto for Erika just notifies her app to mark
//      the period as approved.

const { useState: useStateAP } = React;

function ApprovalPage({ payload }) {
  const [phase, setPhase] = useStateAP('review'); // 'review' | 'signed'
  const [signature, setSignature] = useStateAP(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useStateAP(null); // null | 'saving' | 'ok' | 'error'
  const [cloudSyncError, setCloudSyncError] = useStateAP('');

  async function handleSign(sig) {
    setSignature(sig);
    setPhase('signed');
    const receipt = buildApprovalReceipt({
      periodStart: payload.pp.periodStart,
      periodEnd: payload.pp.periodEnd,
      signedName: sig.signedName,
      signedTitle: sig.signedTitle,
      signedAt: sig.signedAt,
      comment: sig.comment,
      totalHours: sig.totalHours,
    });
    const receiptLink = approvalReceiptUrl(receipt);

    // 1) Official path: write approval to cloud so Erika's app updates live.
    setCloudSyncStatus('saving');
    try {
      if (window.CloudSync && window.CloudSync.publishApproval) {
        const result = await window.CloudSync.publishApproval({
          cloud: payload.cloud,
          employeeEmail: payload.employee.email,
          periodStart: payload.pp.periodStart,
          periodEnd: payload.pp.periodEnd,
          receipt,
        });
        if (result && result.ok) {
          setCloudSyncStatus('ok');
        } else {
          setCloudSyncStatus('error');
          setCloudSyncError((result && (result.error || result.hint)) || 'Could not sync approval to cloud.');
        }
      } else {
        setCloudSyncStatus('error');
        setCloudSyncError('Cloud sync unavailable. Email the approval link so Erika can update Timecard.');
      }
    } catch (e) {
      setCloudSyncStatus('error');
      setCloudSyncError(e.message || String(e));
    }

    // 2) PDF still useful for payroll records (includes update link as backup).
    setTimeout(() => window.printApprovalPDF(payload, sig, receiptLink), 350);
  }

  return (
    <div className="approval-shell">
      <ApprovalTopbar payload={payload} />
      {phase === 'review' && (
        <ApprovalReviewPage payload={payload} onSign={handleSign} />
      )}
      {phase === 'signed' && signature && (
        <ApprovalSignedPage
          payload={payload}
          signature={signature}
          cloudSyncStatus={cloudSyncStatus}
          cloudSyncError={cloudSyncError}
        />
      )}
    </div>
  );
}

function ApprovalTopbar({ payload }) {
  return (
    <div className="approval-topbar">
      <div className="brand">
        <img src="assets/TRP-Icon-Blue.png" alt="The Representation Project" />
        <div className="brand-text">
          Timecard
          <span className="sub">The Representation Project · Approver View</span>
        </div>
      </div>
      <div className="approval-meta">
        <div className="eyebrow">Approving</div>
        <div className="approval-meta-emp">{payload.employee.name}</div>
        <div className="tiny muted">{payload.employee.title}</div>
      </div>
    </div>
  );
}

// ----- Review (pre-signature) ---------------------------------------------

function ApprovalReviewPage({ payload, onSign }) {
  const { pp, employee, approver, totals } = payload;
  const periodDays = payload.periodDays || legacyPeriodDaysFromWeeks(payload.weeks, pp);
  const assumed = totals.assumed || 0;
  const confirmed = totals.confirmed != null ? totals.confirmed : Math.max(0, totals.total - assumed);

  const payDateLabel = TC.parseDate(pp.payDate).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const periodLabel = TC.fmtRange(pp.periodStart, pp.periodEnd);
  const requestedLabel = payload.requestedAt
    ? new Date(payload.requestedAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : '—';

  return (
    <div className="page approval-page">
      <div className="approval-hero">
        <div>
          <div className="eyebrow">Pay Period Approval</div>
          <h1 style={{margin: '4px 0 6px'}}>{pp.label} · {TC.parseDate(pp.periodStart).getFullYear()}</h1>
          <div className="muted" style={{fontSize: 14}}>{periodLabel} &nbsp;·&nbsp; sent {requestedLabel}</div>
        </div>
        <div className="approval-totals">
          <PayPeriodTotalsSummary
            totals={totals}
            todayIso={TC.isoDate(new Date())}
            periodEnd={pp.periodEnd}
            variant="compact"
            align="right"
          />
        </div>
      </div>

      {assumed > 0 && (
        <div className="comment-block warn" style={{marginBottom: 20}}>
          <span className="from" style={{color: 'var(--trp-orange-700)'}}>Submitted early for approval deadline</span>
          {employee.name.split(/\s+|-/)[0]} sent this before the pay period ended ({TC.fmtDayShort(pp.periodEnd)}).
          The <strong>{TC.fmtHours(assumed)} assumed hrs</strong> below are estimates for days not yet worked —
          the {TC.fmtHours(confirmed)} confirmed hrs are already logged. Both roll up to the{' '}
          {TC.fmtHours(totals.total)} hr pay period total above.
        </div>
      )}

      <div className="card pay-date-card">
        <div>
          <div className="eyebrow" style={{color: 'var(--trp-coral-700)'}}>Pay Date</div>
          <div className="pay-date-val">{payDateLabel}</div>
        </div>
        <div className="muted tiny" style={{maxWidth: 280, textAlign: 'right'}}>
          Sign off below to send the signed timecard to payroll.
        </div>
      </div>

      <div className={(totals.lwop || 0) > 0 ? 'grid grid-5 mb-5' : 'grid grid-4 mb-5'}>
        <div className="stat">
          <div className="eyebrow">Clocked in</div>
          <div className="value">{TC.fmtHours(totals.work)}<span style={{fontSize: 16, opacity: 0.5}}>hrs</span></div>
        </div>
        <div className="stat orange">
          <div className="eyebrow">PTO</div>
          <div className="value">{TC.fmtHours(totals.pto)}<span style={{fontSize: 16, opacity: 0.5}}>hrs</span></div>
        </div>
        <div className="stat cream">
          <div className="eyebrow">Sick</div>
          <div className="value">{TC.fmtHours(totals.sick)}<span style={{fontSize: 16, opacity: 0.5}}>hrs</span></div>
        </div>
        <div className="stat" style={{background: 'var(--trp-coral-100)'}}>
          <div className="eyebrow" style={{color: 'var(--trp-coral-700)'}}>Holiday</div>
          <div className="value">{TC.fmtHours(totals.holiday || 0)}<span style={{fontSize: 16, opacity: 0.5}}>hrs</span></div>
        </div>
        {(totals.lwop || 0) > 0 && (
          <div className="stat" style={{background: 'var(--trp-stone-100, var(--trp-cream-100))'}}>
            <div className="eyebrow" style={{color: 'var(--trp-stone-700)'}}>LWOP (unpaid)</div>
            <div className="value">{TC.fmtHours(totals.lwop || 0)}<span style={{fontSize: 16, opacity: 0.5}}>hrs</span></div>
          </div>
        )}
      </div>

      <h3 className="card-title" style={{marginBottom: 4}}>Pay period days</h3>
      <div className="tiny muted" style={{marginBottom: 12}}>
        Only {TC.fmtRange(pp.periodStart, pp.periodEnd)} — pay periods are approved as a whole, not week by week.
      </div>
      <div className="card" style={{padding: 0, overflowX: 'auto', marginBottom: 24}}>
        <PayPeriodDaysTable periodDays={periodDays} />
      </div>

      <SignatureBlock approver={approver} employee={employee} pp={pp} totals={totals} onSign={onSign} />
    </div>
  );
}

function legacyPeriodDaysFromWeeks(weeks, pp) {
  if (!weeks || !weeks.length) return [];
  const TC = window.TC;
  const map = new Map();
  weeks.forEach(w => {
    (w.days || []).forEach(d => {
      if (pp && (d.d < pp.periodStart || d.d > pp.periodEnd)) return;
      const work = (d.sessions || []).reduce((a, s) => a + sessionHours(s), 0);
      const pto = (d.leaves || []).filter(l => l.t === 'pto').reduce((a, l) => a + l.h, 0);
      const sick = (d.leaves || []).filter(l => l.t === 'sick').reduce((a, l) => a + l.h, 0);
      const holiday = (d.leaves || []).filter(l => l.t === 'holiday').reduce((a, l) => a + l.h, 0);
      const lwop = (d.leaves || []).filter(l => l.t === 'lwop').reduce((a, l) => a + l.h, 0);
      map.set(d.d, {
        dateIso: d.d,
        work, pto, sick, holiday, lwop,
        total: work + pto + sick + holiday + lwop,
        sessions: d.sessions || [],
        leaves: d.leaves || [],
      });
    });
  });
  return [...map.values()].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
}

function PayPeriodDaysTable({ periodDays }) {
  if (!periodDays.length) {
    return <div className="empty" style={{padding: 20}}><h3>No hours in this pay period</h3></div>;
  }
  return (
    <table className="ts-table">
      <thead>
        <tr>
          <th>Day</th>
          <th>Sessions</th>
          <th style={{textAlign: 'right'}}>Clocked</th>
          <th style={{textAlign: 'right'}}>PTO</th>
          <th style={{textAlign: 'right'}}>Sick</th>
          <th style={{textAlign: 'right'}}>Holiday</th>
          <th style={{textAlign: 'right'}}>LWOP</th>
          <th style={{textAlign: 'right'}}>Total</th>
        </tr>
      </thead>
      <tbody>
        {periodDays.map(d => (
          <tr key={d.dateIso}>
            <td className="day">{TC.fmtDayShort(d.dateIso)}</td>
            <td className="tiny">
              {(d.sessions || []).map((s, i) => (
                <div key={i} style={{margin: '3px 0'}}>
                  <span className="tnum">{TC.fmtTime(s.in)} → {s.out ? TC.fmtTime(s.out) : '—'}</span>
                  {s.br > 0 && <span className="muted"> · break {s.br}m</span>}
                  {s.est ? <span className="manual-flag" style={{background: 'var(--trp-orange-100)', color: 'var(--trp-orange-700)'}}>Estimate</span> : null}
                  {s.ed ? <span className="manual-flag">Edited</span> : null}
                </div>
              ))}
              {(d.leaves || []).map((l, i) => (
                <div key={'l' + i} className="tiny" style={{margin: '3px 0'}}>
                  <strong>{l.t.toUpperCase()}</strong> · {TC.fmtHours(l.h)} hrs
                  {l.n && <span className="muted"> · {l.n}</span>}
                </div>
              ))}
            </td>
            <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(d.work)}</td>
            <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(d.pto)}</td>
            <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(d.sick)}</td>
            <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(d.holiday || 0)}</td>
            <td className="tnum" style={{textAlign: 'right', color: (d.lwop || 0) > 0 ? 'var(--trp-stone-700)' : undefined}}>{TC.fmtHours(d.lwop || 0)}</td>
            <td className="tnum total" style={{textAlign: 'right'}}>{TC.fmtHours(d.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function sessionHours(s) {
  if (!s.in) return 0;
  const start = new Date(s.in).getTime();
  const end = s.out ? new Date(s.out).getTime() : start;
  const breakMs = (s.br || 0) * 60000;
  return Math.max(0, end - start - breakMs) / 3_600_000;
}

// ----- Signature block ----------------------------------------------------

function SignatureBlock({ approver, employee, pp, totals, onSign }) {
  const [typedName, setTypedName] = useStateAP('');
  const [acknowledged, setAcknowledged] = useStateAP(false);
  const [comment, setComment] = useStateAP('');
  const [error, setError] = useStateAP('');

  const expected = approver.name.trim().toLowerCase();
  const matched = typedName.trim().toLowerCase() === expected;

  function submit() {
    if (!matched) { setError('Please type your full name exactly as shown to sign.'); return; }
    if (!acknowledged) { setError('You must acknowledge the certification to sign off.'); return; }
    const signedAt = new Date().toISOString();
    onSign({
      signedName: approver.name,
      signedTitle: approver.title,
      signedAt,
      comment: comment.trim(),
      periodStart: pp.periodStart,
      periodEnd: pp.periodEnd,
      totalHours: totals.total,
    });
  }

  return (
    <div className="card sign-card">
      <h3 className="card-title" style={{margin: 0, color: 'var(--trp-coral-700)'}}>
        ✍ Sign off pay period
      </h3>
      <p className="lead" style={{marginTop: 4, marginBottom: 18}}>
        Review the totals above, then sign below to send the signed timecard to payroll.
      </p>

      <div className="cert-box">
        <strong style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontSize: 10, display: 'block', marginBottom: 4}}>
          Certification
        </strong>
        By signing below, I, <strong>{approver.name}</strong>, certify that I have
        reviewed the hours reported by <strong>{employee.name}</strong> for the
        pay period {pp.label} ({TC.fmtRange(pp.periodStart, pp.periodEnd)}) and
        approve them for payroll. This action creates a permanent, timestamped
        record of approval.
      </div>

      <label className="field">
        <span className="lbl">Type your full name to sign · {approver.name}</span>
        <input
          type="text"
          value={typedName}
          onChange={e => { setTypedName(e.target.value); setError(''); }}
          placeholder={approver.name}
          autoFocus
          style={{
            fontFamily: matched ? "'Brush Script MT', 'Apple Chancery', cursive" : 'var(--font-body)',
            fontSize: matched ? 26 : 14,
            color: matched ? 'var(--trp-pacific-700)' : 'var(--fg-1)',
            borderColor: matched ? 'var(--trp-pacific-blue)' : undefined,
          }}
        />
        {matched && (
          <div className="tiny" style={{color: 'var(--trp-pacific-700)', marginTop: 4, fontWeight: 700}}>
            ✓ Signature verified
          </div>
        )}
      </label>

      <label className="checkbox-row" style={{marginBottom: 14, alignItems: 'flex-start'}}>
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={e => { setAcknowledged(e.target.checked); setError(''); }}
          style={{marginTop: 3, flexShrink: 0}}
        />
        <span>I understand my electronic signature carries the same legal weight as a handwritten signature and creates a permanent record.</span>
      </label>

      <label className="field">
        <span className="lbl">Optional note for the record</span>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="e.g. Approved for the May 1–15 payroll run."
          rows={2}
        />
      </label>

      {error && (
        <div className="comment-block warn" style={{margin: '8px 0 12px'}}>{error}</div>
      )}

      <div className="modal-actions">
        <button
          className="btn"
          onClick={submit}
          disabled={!matched || !acknowledged}
          style={{background: matched && acknowledged ? 'var(--trp-coral)' : undefined, fontSize: 14, padding: '14px 22px'}}
        >
          ✓ Sign &amp; Generate Signed PDF
        </button>
      </div>
    </div>
  );
}

// ----- Signed (post-signature) --------------------------------------------

function ApprovalSignedPage({ payload, signature, cloudSyncStatus, cloudSyncError }) {
  const receipt = buildApprovalReceipt({
    periodStart: payload.pp.periodStart,
    periodEnd: payload.pp.periodEnd,
    signedName: signature.signedName,
    signedTitle: signature.signedTitle,
    signedAt: signature.signedAt,
    comment: signature.comment,
    totalHours: signature.totalHours,
  });
  const receiptLink = approvalReceiptUrl(receipt);

  const signedAtLabel = new Date(signature.signedAt).toLocaleString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

  const payrollEmail = 'jesse@faithfearfinance.com';
  const subject = `Approved: ${payload.employee.name} timecard · ${payload.pp.label}`;
  const body =
    `Hi ${payload.employee.name.split(/\s+|-/)[0]},\n\n` +
    `Approved ${payload.pp.label} (${TC.fmtRange(payload.pp.periodStart, payload.pp.periodEnd)}) — ${TC.fmtHours(signature.totalHours)} hrs.\n\n` +
    `IMPORTANT: Click this link to update your Timecard app (the PDF alone does not update it):\n\n${receiptLink}\n\n` +
    `Jesse Barber (payroll) is CC'd for payroll records.\n\n` +
    `${signature.signedName}\n${signature.signedTitle}`;
  const gmailErika = buildGmailComposeUrl({
    to: payload.employee.email,
    cc: payrollEmail,
    subject,
    body,
  });
  const mailtoErika = buildMailtoUrl({
    to: payload.employee.email,
    cc: payrollEmail,
    subject,
    body,
  });

  return (
    <div className="page approval-page">
      <div className="signed-hero">
        <div className="signed-badge">✓ Signed</div>
        <h1 style={{margin: '12px 0 4px'}}>Timecard approved</h1>
        <p className="lead" style={{maxWidth: 560}}>
          You signed off on <strong>{payload.employee.name}</strong>'s pay period
          for <strong>{payload.pp.label}</strong> at {signedAtLabel}.
        </p>
        {cloudSyncStatus === 'saving' && (
          <div className="comment-block" style={{marginTop: 14, borderLeftColor: 'var(--trp-pacific-blue)', background: 'var(--trp-pacific-50)'}}>
            <span className="from" style={{color: 'var(--trp-pacific-700)'}}>Syncing official approval…</span>
            Writing Katrina's signature to cloud so Erika's Timecard updates automatically.
          </div>
        )}
        {cloudSyncStatus === 'ok' && (
          <div className="comment-block" style={{marginTop: 14, borderLeftColor: 'var(--trp-pacific-blue)', background: 'var(--trp-pacific-50)'}}>
            <span className="from" style={{color: 'var(--trp-pacific-700)'}}>Official approval synced</span>
            Erika's Timecard will update automatically — no link click required. Save the PDF for payroll if needed.
          </div>
        )}
        {cloudSyncStatus === 'error' && (
          <div className="comment-block warn" style={{marginTop: 14}}>
            <span className="from" style={{color: 'var(--trp-coral-700)'}}>Cloud sync failed — email the link</span>
            {cloudSyncError || 'Could not write the approval to cloud.'} Use Open Gmail below so Erika still gets the update link.
          </div>
        )}
      </div>

      <div className="signed-sig-block">
        <div>
          <div className="eyebrow">Electronically signed by</div>
          <div className="sig-mark">/s/ {signature.signedName}</div>
          <div style={{fontWeight: 700, color: 'var(--trp-navy)', fontSize: 14, marginTop: 4}}>
            {signature.signedName} <span style={{color: 'var(--fg-3)', fontWeight: 400}}>· {signature.signedTitle}</span>
          </div>
        </div>
        <div style={{textAlign: 'right'}}>
          <div className="eyebrow">Timestamp</div>
          <div style={{fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--trp-navy)', marginTop: 4}}>
            {signedAtLabel}
          </div>
        </div>
      </div>

      <div className="comment-block" style={{marginBottom: 20, borderLeftColor: cloudSyncStatus === 'ok' ? 'var(--trp-pacific-blue)' : 'var(--trp-coral)', background: cloudSyncStatus === 'ok' ? 'var(--trp-pacific-50)' : undefined}}>
        <span className="from" style={{color: cloudSyncStatus === 'ok' ? 'var(--trp-pacific-700)' : 'var(--trp-coral-700)'}}>
          {cloudSyncStatus === 'ok' ? 'Primary: cloud sync (automatic)' : 'Backup: email the approval link'}
        </span>
        {cloudSyncStatus === 'ok'
          ? 'Erika does not need to click anything. Optionally email Jesse the PDF for payroll records.'
          : 'Cloud sync did not complete. Open Gmail so Erika receives the #receipt= link — the PDF alone will not update Timecard.'}
      </div>

      <h3 className="card-title" style={{marginTop: 8, marginBottom: 12}}>What to do next</h3>
      <div className="next-grid">
        <NextStepCard
          num="1"
          color="coral"
          title={cloudSyncStatus === 'ok' ? 'Optional: email PDF to payroll' : 'Email approval link to Erika (required)'}
          desc={cloudSyncStatus === 'ok'
            ? 'Jesse is CC’d. Attach the signed PDF if payroll wants a file copy.'
            : 'Must include the #receipt= link so Erika’s Timecard updates. Jesse is CC’d.'}
          cta="Open Gmail"
          href={gmailErika}
          target="_blank"
        />
        <NextStepCard
          num="2"
          color="pacific"
          title="Save / re-print signed PDF"
          desc="Official signed PDF for payroll records."
          cta="Re-open PDF"
          onClick={() => window.printApprovalPDF(payload, signature, receiptLink)}
        />
        <NextStepCard
          num="3"
          color="cream"
          title="Done"
          desc={cloudSyncStatus === 'ok'
            ? 'Signature is on record in cloud. You can close this tab.'
            : 'If email truncates the link, use Copy link below.'}
          cta={cloudSyncStatus === 'ok' ? null : 'Copy link'}
          onClick={cloudSyncStatus === 'ok' ? null : () => {
            navigator.clipboard.writeText(receiptLink);
            alert('Approval link copied');
          }}
        />
      </div>

      <details style={{marginTop: 18}}>
        <summary style={{cursor: 'pointer', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontSize: 11, fontWeight: 700, color: 'var(--trp-stone-700)'}}>
          Not using Gmail? Other options
        </summary>
        <div style={{marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap'}}>
          <a className="btn ghost small" href={mailtoErika}>↗ Open default mail app</a>
          <button className="btn ghost small" onClick={() => {
            navigator.clipboard.writeText(receiptLink);
            alert('Approval link copied. Paste it into an email to ' + payload.employee.email);
          }}>⧉ Copy link only</button>
        </div>
      </details>

      <details style={{marginTop: 24}}>
        <summary style={{cursor: 'pointer', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontSize: 11, fontWeight: 700, color: 'var(--trp-stone-700)'}}>
          Advanced — copy the approval link manually
        </summary>
        <textarea
          readOnly
          rows={3}
          value={receiptLink}
          onClick={e => e.target.select()}
          style={{
            width: '100%', marginTop: 8, fontFamily: 'ui-monospace, monospace',
            fontSize: 11, padding: 8, border: '1px solid var(--border-soft)',
            borderRadius: 'var(--radius-sm)',
          }}
        />
      </details>
    </div>
  );
}

function NextStepCard({ num, color, title, desc, cta, href, target, onClick }) {
  const palette = {
    coral: { bg: 'var(--trp-coral-100)', border: 'var(--trp-coral)', accent: 'var(--trp-coral-700)' },
    pacific: { bg: 'var(--trp-pacific-50)', border: 'var(--trp-pacific-blue)', accent: 'var(--trp-pacific-700)' },
    cream: { bg: 'var(--trp-cream-100)', border: 'var(--trp-cream-200)', accent: 'var(--trp-stone-700)' },
  }[color];
  return (
    <div className="next-card" style={{background: palette.bg, borderColor: palette.border}}>
      <div className="num" style={{color: palette.accent}}>{num}</div>
      <div style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontWeight: 700, fontSize: 13, color: 'var(--trp-navy)', marginBottom: 6}}>
        {title}
      </div>
      <div style={{fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.45, marginBottom: cta ? 12 : 0}}>{desc}</div>
      {cta && href && (
        <a className="btn small" href={href} target={target} rel={target === '_blank' ? 'noopener' : undefined} style={{background: palette.accent, color: 'white', textDecoration: 'none', display: 'inline-block'}}>
          {cta}
        </a>
      )}
      {cta && onClick && (
        <button className="btn small" onClick={onClick} style={{background: palette.accent, color: 'white'}}>
          {cta}
        </button>
      )}
    </div>
  );
}

Object.assign(window, { ApprovalPage });
