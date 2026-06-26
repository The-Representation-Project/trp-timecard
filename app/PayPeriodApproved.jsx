// app/PayPeriodApproved.jsx — the "signed off / approved" state for a pay period.
// Renders as a stamped payroll receipt: top approval strip, hours, signature line,
// and a checklist of the constituent weeks. Surfaced on:
//  - Employee Home (most-recent approved period)
//  - Director Queue (between fresh queue and Recent Decisions)

function PayPeriodApprovedCard({ payPeriod, state, viewerRole = 'employee', defaultOpen = false }) {
  const [open, setOpen] = React.useState(defaultOpen);

  const user = state.users.find(u => u.id === payPeriod.userId);
  const dir = state.users.find(u => u.role === 'director');
  const pp = payPeriodForDate(payPeriod.periodStart, state.settings);
  const totals = payPeriodTotals(state, payPeriod.periodStart, payPeriod.userId);
  const dayRows = payPeriodDayRows(state, payPeriod.periodStart, payPeriod.userId);

  const decidedAt = payPeriod.decidedAt ? new Date(payPeriod.decidedAt) : null;
  const decidedLabel = decidedAt
    ? decidedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
  const decidedTimeLabel = decidedAt
    ? decidedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : '';

  // Captured at signing time on the payPeriod record; fall back to the
  // current director if the record predates the signature feature.
  const signedName = payPeriod.signedName || (dir ? dir.name : 'Director');
  const signedTitle = payPeriod.signedTitle || (dir ? dir.title : 'Director');
  const signedAt = payPeriod.signedAt || payPeriod.decidedAt;
  const signedAtFull = signedAt
    ? new Date(signedAt).toLocaleString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : '—';
  const payDate = TC.parseDate(pp.payDate);
  const payDateLabel = payDate.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  // "Days until payday" — purely informational
  const today = new Date();
  const daysToPay = Math.round((payDate - today) / (24 * 60 * 60 * 1000));
  let payCopy;
  if (daysToPay > 1) payCopy = `Payday in ${daysToPay} days`;
  else if (daysToPay === 1) payCopy = 'Payday tomorrow';
  else if (daysToPay === 0) payCopy = 'Paid today';
  else if (daysToPay === -1) payCopy = 'Paid yesterday';
  else payCopy = `Paid ${Math.abs(daysToPay)} days ago`;

  const isEmployee = viewerRole === 'employee';

  return (
    <div className="pp-approved" style={{
      background: 'white',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      marginBottom: 16,
      boxShadow: '0 1px 2px rgba(0, 62, 86, 0.05), 0 4px 16px rgba(0, 62, 86, 0.06)',
    }}>
      {/* Top approval strip — Pacific Blue */}
      <div style={{
        background: 'var(--trp-pacific-blue)',
        color: 'white',
        padding: '14px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative stripe pattern */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 14px, rgba(255,255,255,0.07) 14px 16px)',
          pointerEvents: 'none',
        }} />
        <div style={{display: 'flex', alignItems: 'center', gap: 14, position: 'relative'}}>
          <div style={{
            width: 36, height: 36,
            borderRadius: '50%',
            background: 'white',
            color: 'var(--trp-pacific-700)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 20, lineHeight: 1,
            flexShrink: 0,
          }}>✓</div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps)',
              fontSize: 11,
              opacity: 0.85,
              marginBottom: 2,
            }}>
              Pay Period · Signed Off
            </div>
            <div style={{
              fontFamily: 'var(--font-display)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps)',
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1.05,
            }}>
              {pp.label} · {TC.parseDate(pp.periodStart).getFullYear()}
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 18,
          position: 'relative', flexWrap: 'wrap',
        }}>
          <div style={{textAlign: 'right'}}>
            <div style={{
              fontFamily: 'var(--font-display)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps)',
              fontSize: 10,
              opacity: 0.8,
              marginBottom: 2,
            }}>
              Pay Date
            </div>
            <div style={{
              fontFamily: 'var(--font-display)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps)',
              fontSize: 14,
              fontWeight: 700,
            }}>
              {payDateLabel}
            </div>
          </div>
          <div style={{
            display: 'inline-block',
            padding: '6px 12px',
            border: '2px solid white',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-display)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps)',
            fontSize: 10,
            fontWeight: 700,
            background: 'rgba(255,255,255,0.08)',
          }}>
            {payCopy}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{padding: '22px 22px 18px'}}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: 24,
          alignItems: 'start',
          marginBottom: 14,
        }}>
          <div>
            <div className="eyebrow" style={{marginBottom: 4}}>
              {isEmployee ? 'Your timesheet for' : `${user ? user.name : 'Employee'} · timesheet for`}
            </div>
            <h3 style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps)',
              fontWeight: 700,
              fontSize: 22,
              color: 'var(--trp-navy)',
              lineHeight: 1.1,
            }}>
              {TC.fmtRange(pp.periodStart, pp.periodEnd)}
            </h3>
            <div style={{
              marginTop: 8,
              fontSize: 13,
              color: 'var(--fg-2)',
              maxWidth: 480,
            }}>
              {isEmployee
                ? 'Everything in this period is locked for payroll. You can still override individual days on Timesheet if a correction is needed.'
                : 'This period is closed for payroll. Constituent weeks remain approved and edits are locked. Reopen only if payroll needs revisions.'}
            </div>
          </div>
          <div style={{textAlign: 'right'}}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 48,
              lineHeight: 0.95,
              color: 'var(--trp-navy)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {TC.fmtHours(totals.total)}
            </div>
            <div style={{
              fontFamily: 'var(--font-display)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps)',
              fontWeight: 700,
              fontSize: 10,
              color: 'var(--trp-stone-500)',
              marginTop: 4,
            }}>
              Total hours paid
            </div>
          </div>
        </div>

        {/* Hours breakdown chips */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 8,
          marginBottom: 16,
        }}>
          <BreakdownChip label="Worked" value={totals.work} color="pacific" />
          <BreakdownChip label="PTO" value={totals.pto} color="orange" />
          <BreakdownChip label="Sick" value={totals.sick} color="cream" />
        </div>

        {/* Director signature line */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 12,
          padding: '14px 16px',
          background: 'var(--trp-cream-50)',
          border: '1px solid var(--border-soft)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 14,
          alignItems: 'center',
        }}>
          <div style={{minWidth: 0}}>
            <div style={{
              fontFamily: 'var(--font-display)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps)',
              fontWeight: 700,
              fontSize: 10,
              color: 'var(--trp-stone-500)',
              marginBottom: 4,
            }}>
              Electronically signed by
            </div>
            <div style={{
              fontFamily: "'Brush Script MT', 'Apple Chancery', cursive",
              fontSize: 28,
              color: 'var(--trp-pacific-700)',
              lineHeight: 1,
              marginBottom: 4,
              paddingBottom: 2,
              borderBottom: '1px solid var(--border-soft)',
              maxWidth: 'fit-content',
              paddingRight: 24,
            }}>
              /s/ {signedName}
            </div>
            <div style={{fontSize: 13, color: 'var(--trp-navy)', fontWeight: 700, marginTop: 4}}>
              {signedName} <span style={{color: 'var(--fg-3)', fontWeight: 400}}>· {signedTitle}</span>
            </div>
          </div>
          <div style={{textAlign: 'right', whiteSpace: 'nowrap', borderLeft: '1px solid var(--border-soft)', paddingLeft: 14}}>
            <div style={{
              fontFamily: 'var(--font-display)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tracking-caps)',
              fontWeight: 700,
              fontSize: 10,
              color: 'var(--trp-stone-500)',
              marginBottom: 4,
            }}>
              Approval Timestamp
            </div>
            <div className="tnum" style={{fontSize: 14, color: 'var(--trp-navy)', fontWeight: 700}}>
              {decidedLabel}
            </div>
            <div className="tiny muted tnum">{decidedTimeLabel}</div>
            <div className="tiny" style={{color: 'var(--trp-pacific-700)', marginTop: 4, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontWeight: 700, fontSize: 9}}>
              Permanent record
            </div>
          </div>
        </div>

        {/* Optional director comment */}
        {payPeriod.directorComment && (
          <div className="comment-block" style={{marginTop: 0, marginBottom: 14}}>
            <span className="from">Note from {dir ? dir.name.split(' ')[0] : 'Director'}</span>
            {payPeriod.directorComment}
          </div>
        )}

        {/* Toggle pay-period days */}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--tracking-caps)',
            fontWeight: 700,
            fontSize: 11,
            color: 'var(--trp-pacific-700)',
            padding: 0,
          }}
        >
          {open ? '▾' : '▸'} {dayRows.length} day{dayRows.length === 1 ? '' : 's'} in {pp.label}
        </button>

        {open && (
          <table className="mini-table" style={{marginTop: 10, marginBottom: 0}}>
            <thead>
              <tr>
                <th></th>
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
                  <td style={{width: 18}}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 16, height: 16, borderRadius: '50%',
                      background: '#d8efdf', color: '#1b6b3a', fontSize: 10, fontWeight: 700,
                    }}>✓</span>
                  </td>
                  <td style={{
                    fontFamily: 'var(--font-display)',
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--tracking-caps)',
                    fontWeight: 700, fontSize: 11,
                    color: 'var(--trp-navy)',
                  }}>
                    {TC.fmtDayShort(d.dateIso)}
                  </td>
                  <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(d.work)}</td>
                  <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(d.pto)}</td>
                  <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(d.sick)}</td>
                  <td className="tnum" style={{textAlign: 'right'}}>{TC.fmtHours(d.holiday || 0)}</td>
                  <td className="tnum" style={{textAlign: 'right', color: (d.lwop || 0) > 0 ? 'var(--trp-stone-700)' : undefined}}>{TC.fmtHours(d.lwop || 0)}</td>
                  <td className="tnum" style={{textAlign: 'right', fontWeight: 700, color: 'var(--trp-navy)'}}>
                    {TC.fmtHours(d.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer actions */}
      <div style={{
        background: 'var(--trp-cream-50)',
        borderTop: '1px solid var(--border-soft)',
        padding: '12px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{fontSize: 12, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 8}}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: '#1b6b3a',
          }} />
          Locked · payroll record
        </div>
        <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
          <button
            className="btn ghost small"
            onClick={() => window.printPayPeriodReceipt(state, payPeriod)}
          >
            ↓ Re-print signed PDF
          </button>
          <button
            className="btn ghost small"
            onClick={() => window.downloadPayPeriodExcel(state, payPeriod)}
          >
            ↓ Download Excel
          </button>
        </div>
      </div>
    </div>
  );
}

function BreakdownChip({ label, value, color }) {
  const palette = {
    pacific: {
      bg: 'var(--trp-pacific-50)',
      border: 'var(--trp-pacific-100)',
      eyebrow: 'var(--trp-pacific-700)',
      value: 'var(--trp-pacific-900)',
    },
    orange: {
      bg: 'var(--trp-orange-100)',
      border: 'var(--trp-orange)',
      eyebrow: 'var(--trp-orange-700)',
      value: 'var(--trp-stone-900)',
    },
    cream: {
      bg: 'var(--trp-cream-100)',
      border: 'var(--trp-cream-200)',
      eyebrow: 'var(--trp-stone-700)',
      value: 'var(--trp-navy)',
    },
  }[color] || {};
  return (
    <div style={{
      background: palette.bg,
      border: `1px solid ${palette.border}`,
      borderRadius: 'var(--radius-sm)',
      padding: '10px 14px',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        textTransform: 'uppercase',
        letterSpacing: 'var(--tracking-caps)',
        fontWeight: 700,
        fontSize: 10,
        color: palette.eyebrow,
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div className="tnum" style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 22,
        color: palette.value,
        lineHeight: 1,
      }}>
        {TC.fmtHours(value)}<span style={{fontSize: 12, marginLeft: 4, opacity: 0.5}}>hrs</span>
      </div>
    </div>
  );
}

Object.assign(window, { PayPeriodApprovedCard });
