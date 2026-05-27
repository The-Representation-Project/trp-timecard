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

  function handleSign(sig) {
    setSignature(sig);
    setPhase('signed');
    // Auto-open the print dialog so Katrina has the PDF immediately.
    setTimeout(() => window.printApprovalPDF(payload, sig), 350);
  }

  return (
    <div className="approval-shell">
      <ApprovalTopbar payload={payload} />
      {phase === 'review' && (
        <ApprovalReviewPage payload={payload} onSign={handleSign} />
      )}
      {phase === 'signed' && signature && (
        <ApprovalSignedPage payload={payload} signature={signature} />
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
  const { pp, employee, approver, weeks, totals } = payload;

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
          <div className="eyebrow">Total to approve</div>
          <div className="big-num">{TC.fmtHours(totals.total)}<span className="unit">hrs</span></div>
          <div className="tiny muted">across {weeks.length} week{weeks.length === 1 ? '' : 's'}</div>
        </div>
      </div>

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
          <div className="eyebrow">Worked</div>
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

      <h3 className="card-title" style={{marginBottom: 12}}>Week-by-week breakdown</h3>
      <div className="card" style={{padding: 0, overflowX: 'auto', marginBottom: 24}}>
        <table className="ts-table">
          <thead>
            <tr>
              <th>Week</th>
              <th style={{textAlign: 'right'}}>Worked</th>
              <th style={{textAlign: 'right'}}>PTO</th>
              <th style={{textAlign: 'right'}}>Sick</th>
              <th style={{textAlign: 'right'}}>Holiday</th>
              <th style={{textAlign: 'right'}}>LWOP</th>
              <th style={{textAlign: 'right'}}>Total</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map(w => (
              <tr key={w.ws}>
                <td className="day">{TC.fmtRange(w.ws, w.we)}</td>
                <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(w.work)}</td>
                <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(w.pto)}</td>
                <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(w.sick)}</td>
                <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(w.holiday || 0)}</td>
                <td className="tnum" style={{textAlign: 'right', color: (w.lwop || 0) > 0 ? 'var(--trp-stone-700)' : undefined}}>{TC.fmtHours(w.lwop || 0)}</td>
                <td className="tnum total" style={{textAlign: 'right'}}>{TC.fmtHours(w.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(totals.work)}</td>
              <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(totals.pto)}</td>
              <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(totals.sick)}</td>
              <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(totals.holiday || 0)}</td>
              <td className="tnum" style={{textAlign: 'right', color: (totals.lwop || 0) > 0 ? 'var(--trp-stone-700)' : undefined}}>{TC.fmtHours(totals.lwop || 0)}</td>
              <td className="tnum total-val" style={{textAlign: 'right'}}>{TC.fmtHours(totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <h3 className="card-title" style={{marginBottom: 12}}>Daily detail</h3>
      <div className="card" style={{padding: 0, marginBottom: 24}}>
        <DailyDetail weeks={weeks} />
      </div>

      <SignatureBlock approver={approver} employee={employee} pp={pp} totals={totals} onSign={onSign} />
    </div>
  );
}

function DailyDetail({ weeks }) {
  const rows = [];
  weeks.forEach(w => {
    (w.days || []).forEach(d => {
      const hasContent = (d.sessions && d.sessions.length) || (d.leaves && d.leaves.length);
      if (!hasContent) return;
      rows.push({ ...d, weekLabel: TC.fmtRange(w.ws, w.we) });
    });
  });

  if (rows.length === 0) {
    return <div className="empty"><h3>No daily detail in payload</h3></div>;
  }

  return (
    <table className="ts-table">
      <thead>
        <tr>
          <th>Day</th>
          <th>Sessions</th>
          <th style={{textAlign: 'right'}}>Hours</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => {
          const dayHrs = (r.sessions || []).reduce((a, s) => a + sessionHours(s), 0)
            + (r.leaves || []).reduce((a, l) => a + l.h, 0);
          const anyEdited = (r.sessions || []).some(s => s.ed);
          const anyEst = (r.sessions || []).some(s => s.est);
          return (
            <tr key={r.d}>
              <td className="day">{TC.fmtDayShort(r.d)}</td>
              <td>
                {(r.sessions || []).map((s, i) => (
                  <div key={i} className="tiny" style={{margin: '3px 0'}}>
                    <span className="tnum">{TC.fmtTime(s.in)} → {s.out ? TC.fmtTime(s.out) : '—'}</span>
                    {s.br > 0 && <span className="muted"> · break {s.br}m</span>}
                    {s.est ? <span className="manual-flag" style={{background: 'var(--trp-orange-100)', color: 'var(--trp-orange-700)'}}>Estimate</span>
                      : s.ed ? <span className="manual-flag">Edited</span> : null}
                  </div>
                ))}
                {(r.leaves || []).map((l, i) => {
                  const meta = l.t === 'pto'
                    ? { label: 'PTO', color: 'var(--trp-orange-700)' }
                    : l.t === 'sick'
                      ? { label: 'Sick', color: 'var(--trp-pacific-700)' }
                      : l.t === 'lwop'
                        ? { label: 'LWOP', color: 'var(--trp-stone-700)' }
                        : { label: 'Holiday', color: 'var(--trp-coral-700)' };
                  return (
                    <div key={'l'+i} className="tiny" style={{margin: '3px 0'}}>
                      <strong style={{textTransform: 'uppercase', fontFamily: 'var(--font-display)', letterSpacing: 'var(--tracking-caps)', fontSize: 11, color: meta.color}}>
                        {meta.label}
                      </strong>
                      {' · '}{TC.fmtHours(l.h)} hrs
                      {l.n && <span className="muted" style={{marginLeft: 6}}>· {l.n}</span>}
                    </div>
                  );
                })}
              </td>
              <td className="tnum total" style={{textAlign: 'right'}}>{TC.fmtHours(dayHrs)}</td>
              <td className="tiny muted">
                {anyEst && <span>Includes estimated time for upcoming day(s).</span>}
                {!anyEst && anyEdited && <span>Manually edited sessions.</span>}
                {!anyEst && !anyEdited && <span>—</span>}
              </td>
            </tr>
          );
        })}
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

function ApprovalSignedPage({ payload, signature }) {
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

  // Pre-built emails back to Erika — Gmail compose URL (opens Gmail tab)
  // plus a plain mailto: fallback.
  const subject = `Approved: ${payload.employee.name} timecard · ${payload.pp.label}`;
  const body =
    `Hi ${payload.employee.name.split(/\s+|-/)[0]},\n\n` +
    `Approved ${payload.pp.label} (${TC.fmtRange(payload.pp.periodStart, payload.pp.periodEnd)}) — ${TC.fmtHours(signature.totalHours)} hrs.\n\n` +
    `Click the link below to record the approval in your Timecard app:\n\n${receiptLink}\n\n` +
    `The signed PDF for payroll opened in a separate window — save it as PDF and forward to payroll.\n\n` +
    `${signature.signedName}\n${signature.signedTitle}`;
  const gmailErika = 'https://mail.google.com/mail/?view=cm&fs=1' +
    `&to=${encodeURIComponent(payload.employee.email)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;
  const mailtoErika = `mailto:${encodeURIComponent(payload.employee.email)}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  return (
    <div className="page approval-page">
      <div className="signed-hero">
        <div className="signed-badge">✓ Signed</div>
        <h1 style={{margin: '12px 0 4px'}}>Timecard approved</h1>
        <p className="lead" style={{maxWidth: 560}}>
          You signed off on <strong>{payload.employee.name}</strong>'s pay period
          for <strong>{payload.pp.label}</strong> at {signedAtLabel}. The signed
          PDF receipt opened in a print dialog — save it for payroll.
        </p>
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

      <h3 className="card-title" style={{marginTop: 28, marginBottom: 12}}>What to do next</h3>
      <div className="next-grid">
        <NextStepCard
          num="1"
          color="coral"
          title="Email approval back to Erika (Gmail)"
          desc="Opens Gmail with the message + one-click approval link already filled in. Just hit Send."
          cta="Open Gmail"
          href={gmailErika}
          target="_blank"
        />
        <NextStepCard
          num="2"
          color="pacific"
          title="Forward the signed PDF to payroll"
          desc="The PDF opened in a print dialog. Save it (Save as PDF), then attach to payroll's email."
          cta="Re-open PDF"
          onClick={() => window.printApprovalPDF(payload, signature)}
        />
        <NextStepCard
          num="3"
          color="cream"
          title="Done — close this tab"
          desc="Everything's signed. The link can't be re-used; Erika will receive the approval notification."
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
