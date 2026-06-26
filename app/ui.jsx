// app/ui.jsx — shared UI primitives

const { useState, useEffect, useRef } = React;

function Badge({ status, children, live }) {
  const labels = {
    draft: 'Draft',
    submitted: 'Submitted',
    approved: 'Approved',
    rejected: 'Rejected',
    changes_requested: 'Changes Requested',
    live: 'Live',
  };
  if (live) {
    return (
      <span className="badge live">
        <span className="dot" />
        Live
      </span>
    );
  }
  return (
    <span className={`badge ${status}`}>
      <span className="dot" />
      {children || labels[status] || status}
    </span>
  );
}

function Modal({ title, subtitle, onClose, children, maxWidth }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose && onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      <div className="modal" style={maxWidth ? { maxWidth } : {}}>
        {title && <h3>{title}</h3>}
        {subtitle && <p className="lead">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

// Decision modal for director: collect comment for reject / changes_requested
function DecisionModal({ open, decision, onCancel, onConfirm, title }) {
  const [comment, setComment] = useState('');
  useEffect(() => { if (open) setComment(''); }, [open, decision]);
  if (!open) return null;
  const required = decision === 'rejected' || decision === 'changes_requested';
  const decisionLabel = {
    approved: 'Approve',
    rejected: 'Reject',
    changes_requested: 'Request Changes',
  }[decision];
  return (
    <Modal
      title={title || `${decisionLabel} submission`}
      subtitle={required ? 'A comment is required so the employee knows what to address.' : 'Add an optional note for the record.'}
      onClose={onCancel}
    >
      <label className="field">
        <span className="lbl">Comment {required && <span style={{color: 'var(--trp-coral)'}}>*</span>}</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={decision === 'rejected'
            ? 'e.g. Wed shows 9.5 hrs but I only see you in the office until 5:30. Please correct and resubmit.'
            : 'Add any context here…'}
          rows={4}
          autoFocus
        />
      </label>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
        <button
          className={`btn ${decision === 'approved' ? '' : decision === 'rejected' ? 'warn' : 'warm'}`}
          disabled={required && !comment.trim()}
          onClick={() => onConfirm(comment.trim())}
        >
          {decisionLabel}
        </button>
      </div>
    </Modal>
  );
}

function confirmLockedEdit(state, dateIso, userId) {
  if (!isDayLocked(state, dateIso, userId)) return true;
  const msg = dayLockMessage(state, dateIso, userId);
  return window.confirm(
    (msg || 'This pay period is locked for payroll.') +
    '\n\nUnlock for editing anyway? Use only if a correction is needed.'
  );
}

function Confirm({ open, title, message, confirmLabel = 'Confirm', danger, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{message}</p>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className={`btn ${danger ? 'warn' : ''}`} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

// Pretty status banner for a week (under/at/over 40). Approval is pay-period
// level — this banner tracks hours only, not weekly sign-off.
function WeekStatusBanner({ totals, state, userId, weekStart }) {
  const total = totals.total;
  let kind = 'under', headline = `${TC.fmtHours(total)} HOURS THiS WEEK`;
  if (total === 40) { kind = 'exact'; headline = 'EXACTLY 40 HOURS'; }
  else if (total > 40) { kind = 'over'; headline = `${TC.fmtHours(total)} HOURS — ${TC.fmtHours(total - 40)} OVER 40`; }
  else { headline = `${TC.fmtHours(total)} HOURS — ${TC.fmtHours(40 - total)} TO GO`; }

  const pp = payPeriodForDate(weekStart, state.settings);
  const rec = payPeriodRecord(state, pp.periodStart, userId);
  let note = 'Edit any day below · send the whole pay period from Home when ready';
  if (rec && rec.status === 'approved' && rec.signedViaReceipt) {
    note = `${pp.label} signed by Katrina · locked for payroll (editable with override)`;
  } else if (rec && rec.status === 'awaiting_approval') {
    note = `${pp.label} with Katrina · fully editable until she signs`;
  }

  return (
    <div className={`week-banner ${kind}`}>
      <div>
        <div className="meta">Weekly hours · 40 hr standard</div>
        <div className="headline">{headline}</div>
        <div className="tiny muted" style={{marginTop: 6, textTransform: 'none', letterSpacing: 0, fontWeight: 400}}>{note}</div>
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
        <div className="total-num">{TC.fmtHours(total)}</div>
      </div>
    </div>
  );
}

// Pay-period totals for send card, approval modal, and Katrina's review page.
// Emphasizes: period total → worked vs time off → confirmed vs assumed (early submit).
function PayPeriodTotalsSummary({ totals, todayIso, periodEnd, variant = 'full', align = 'left' }) {
  const timeOff = payPeriodTimeOffTotal(totals);
  const assumed = totals.assumed || 0;
  const confirmed = totals.confirmed != null ? totals.confirmed : Math.max(0, totals.total - assumed);
  const offParts = payPeriodTimeOffParts(totals);
  const compact = variant === 'compact';

  const alignStyle = align === 'right' ? { textAlign: 'right' } : undefined;

  return (
    <div className={`pp-totals-summary ${compact ? 'compact' : 'full'}`} style={alignStyle}>
      <div className="pp-total-hero">
        <div className="pp-total-label">Pay Period Total</div>
        <div className="pp-total-num">{TC.fmtHours(totals.total)}<span className="pp-total-unit">hrs</span></div>
        {!compact && totals.total > 0 && totals.total !== 80 && (
          <div className="tiny muted" style={{marginTop: 4}}>
            Semi-monthly periods are typically 80 hrs when full-time
          </div>
        )}
      </div>

      <div className="pp-worked-off" style={{marginTop: compact ? 8 : 14}}>
        <div className="pp-row">
          <span className="pp-row-label">Worked</span>
          <span className="pp-row-val tnum">{TC.fmtHours(totals.work)} hrs</span>
        </div>
        <div className="pp-row">
          <span className="pp-row-label">Time off</span>
          <span className="pp-row-val tnum">{TC.fmtHours(timeOff)} hrs</span>
        </div>
        {offParts.length > 0 && (
          <div className="pp-off-parts tiny muted">
            {offParts.map((p, i) => (
              <span key={p.label}>
                {i > 0 && ' · '}
                {TC.fmtHours(p.hours)} {p.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {assumed > 0 && (
        <div className="pp-confirmed-assumed" style={{marginTop: compact ? 10 : 16}}>
          <div className="pp-row confirmed">
            <span className="pp-row-label">Confirmed</span>
            <span className="pp-row-val tnum">{TC.fmtHours(confirmed)} hrs</span>
          </div>
          <div className="pp-assumed-block">
            <div className="pp-row assumed">
              <span className="pp-row-label">Assumed</span>
              <span className="pp-row-val tnum">{TC.fmtHours(assumed)} hrs</span>
            </div>
            <div className="pp-assumed-note tiny">
              Estimated for upcoming days in this pay period
              {todayIso && periodEnd ? ` (${TC.fmtDayShort(todayIso)} → ${TC.fmtDayShort(periodEnd)})` : ''}
              {' '}— submitted early for approval deadline.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Badge, Modal, DecisionModal, Confirm, confirmLockedEdit, WeekStatusBanner, PayPeriodTotalsSummary });
