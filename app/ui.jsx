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

// Pretty status banner for a week (under/at/over 40)
function WeekStatusBanner({ totals, submission }) {
  const total = totals.total;
  let kind = 'under', headline = `${TC.fmtHours(total)} HOURS THiS WEEK`;
  if (total === 40) { kind = 'exact'; headline = 'EXACTLY 40 HOURS'; }
  else if (total > 40) { kind = 'over'; headline = `${TC.fmtHours(total)} HOURS — ${TC.fmtHours(total - 40)} OVER 40`; }
  else { headline = `${TC.fmtHours(total)} HOURS — ${TC.fmtHours(40 - total)} TO GO`; }
  const status = submission ? submission.status : 'draft';
  return (
    <div className={`week-banner ${kind}`}>
      <div>
        <div className="meta">Weekly status · 40 hr standard</div>
        <div className="headline">{headline}</div>
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
        <div className="total-num">{TC.fmtHours(total)}</div>
        <Badge status={status} />
      </div>
    </div>
  );
}

Object.assign(window, { Badge, Modal, DecisionModal, Confirm, WeekStatusBanner });
